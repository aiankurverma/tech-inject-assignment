import * as React from "react";
import { produce } from "immer";
import { parseCsvFile, type ParseHandle } from "@/components/crm/pro-csv-importer/csv-parser";
import { detectHeader, suggestMapping } from "@/components/crm/pro-csv-importer/matching";
import type {
  CellErrors,
  ColumnMapping,
  ImportStep,
  ImporterField,
  ParseOptions,
} from "@/components/crm/pro-csv-importer/types";

export interface CsvImportState {
  step: ImportStep;
  fileName: string;
  fileSize: number;
  progress: { bytes: number; total: number; rows: number };
  parseError: string | null;
  inWorker: boolean;
  truncated: boolean;
  delimiter: string;
  hasHeader: boolean;
  mapping: ColumnMapping;
  confidence: (number | null)[];
  /** Bumped whenever the big row store changes, so memoised views refresh. */
  version: number;
  validating: boolean;
  validated: number;
  errorRows: number;
  errorCells: number;
  inFileDupes: number;
  existingDupes: number;
  excluded: number;
}

type Action =
  | { type: "start"; name: string; size: number }
  | { type: "progress"; bytes: number; total: number; rows: number }
  | { type: "parsed"; delimiter: string; truncated: boolean; inWorker: boolean }
  | { type: "parse-error"; message: string }
  | { type: "mapping"; mapping: ColumnMapping; confidence?: (number | null)[]; hasHeader?: boolean }
  | { type: "map"; col: number; key: string | null }
  | { type: "step"; step: ImportStep }
  | { type: "validation"; patch: Partial<CsvImportState> }
  | { type: "bump" }
  | { type: "reset" };

const initial: CsvImportState = {
  step: "upload",
  fileName: "",
  fileSize: 0,
  progress: { bytes: 0, total: 0, rows: 0 },
  parseError: null,
  inWorker: true,
  truncated: false,
  delimiter: ",",
  hasHeader: true,
  mapping: [],
  confidence: [],
  version: 0,
  validating: false,
  validated: 0,
  errorRows: 0,
  errorCells: 0,
  inFileDupes: 0,
  existingDupes: 0,
  excluded: 0,
};

const reducer = produce((s: CsvImportState, a: Action) => {
  switch (a.type) {
    case "start":
      Object.assign(s, initial, { step: "parsing", fileName: a.name, fileSize: a.size });
      break;
    case "progress":
      s.progress = { bytes: a.bytes, total: a.total, rows: a.rows };
      break;
    case "parsed":
      s.delimiter = a.delimiter;
      s.truncated = a.truncated;
      s.inWorker = a.inWorker;
      break;
    case "parse-error":
      s.parseError = a.message;
      s.step = "upload";
      break;
    case "mapping":
      s.mapping = a.mapping;
      if (a.confidence) s.confidence = a.confidence;
      if (a.hasHeader !== undefined) s.hasHeader = a.hasHeader;
      s.step = "mapping";
      break;
    case "map":
      // One column per field: taking a field releases it from any other column.
      if (a.key) s.mapping = s.mapping.map((k) => (k === a.key ? null : k));
      s.mapping[a.col] = a.key;
      s.confidence[a.col] = a.key ? 0 : null;
      break;
    case "step":
      s.step = a.step;
      break;
    case "validation":
      Object.assign(s, a.patch);
      break;
    case "bump":
      s.version++;
      break;
    case "reset":
      return initial;
  }
});

export interface UseCsvImportOptions {
  fields: readonly ImporterField[];
  /** Field keys whose combined value identifies a record (e.g. ["email"]). */
  dedupeKeys?: readonly string[];
  /** Keys already in the CRM, normalised the same way (lower-cased, trimmed, joined by "|"). */
  existingKeys?: ReadonlySet<string>;
  parseOptions?: ParseOptions;
}

const VALIDATE_SLICE = 4000;

/**
 * Import state machine: parse (worker, chunked) -> detect header + fuzzy map -> validate every
 * cell with the field's zod schema in time-sliced batches -> dedupe. Large data lives in refs;
 * small UI state goes through an immer reducer.
 */
export function useCsvImport({
  fields,
  dedupeKeys,
  existingKeys,
  parseOptions,
}: UseCsvImportOptions) {
  const [state, dispatch] = React.useReducer(reducer, initial);
  const rowsRef = React.useRef<string[][]>([]);
  const errorsRef = React.useRef<CellErrors>(new Map());
  const dupesRef = React.useRef({ inFile: new Set<number>(), existing: new Set<number>() });
  const excludedRef = React.useRef(new Set<number>());
  const parseRef = React.useRef<ParseHandle | null>(null);
  const runRef = React.useRef(0);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  const fieldByKey = React.useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);

  React.useEffect(() => () => parseRef.current?.cancel(), []);

  const bodyStart = state.hasHeader ? 1 : 0;
  const headers = React.useMemo(() => {
    const first = rowsRef.current[0] ?? [];
    const width = Math.max(first.length, ...rowsRef.current.slice(0, 50).map((r) => r.length));
    return Array.from({ length: width }, (_, i) =>
      state.hasHeader ? first[i]?.trim() || `Column ${i + 1}` : `Column ${i + 1}`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hasHeader, state.step === "mapping", state.version]);

  const loadFile = React.useCallback(
    (file: File) => {
      parseRef.current?.cancel();
      rowsRef.current = [];
      errorsRef.current = new Map();
      excludedRef.current = new Set();
      dispatch({ type: "start", name: file.name, size: file.size });
      let inWorker = true;
      const handle = parseCsvFile(file, parseOptions ?? {}, (msg) => {
        if (msg.type === "rows") {
          for (const r of msg.rows) rowsRef.current.push(r);
        } else if (msg.type === "progress") {
          dispatch({ type: "progress", bytes: msg.bytes, total: msg.total, rows: msg.rows });
        } else if (msg.type === "error") {
          dispatch({ type: "parse-error", message: msg.message });
        } else {
          dispatch({
            type: "parsed",
            delimiter: msg.delimiter,
            truncated: msg.truncated,
            inWorker,
          });
          const rows = rowsRef.current;
          if (rows.length === 0) {
            dispatch({ type: "parse-error", message: "The file has no rows." });
            return;
          }
          const hasHeader = detectHeader(rows);
          const width = rows[0]!.length;
          const headerRow = hasHeader
            ? rows[0]!
            : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
          const { mapping, confidence } = suggestMapping(headerRow, fields);
          dispatch({ type: "mapping", mapping, confidence, hasHeader });
        }
      });
      inWorker = handle.inWorker;
      parseRef.current = handle;
    },
    [fields, parseOptions],
  );

  const keyOf = React.useCallback(
    (row: string[], mapping: ColumnMapping) => {
      if (!dedupeKeys?.length) return "";
      const parts: string[] = [];
      for (const k of dedupeKeys) {
        const col = mapping.indexOf(k);
        parts.push(col < 0 ? "" : (row[col] ?? "").trim().toLowerCase());
      }
      return parts.every((p) => !p) ? "" : parts.join("|");
    },
    [dedupeKeys],
  );

  /** Validate one row; returns field -> message, or undefined when clean. */
  const validateRow = React.useCallback(
    (row: string[], mapping: ColumnMapping) => {
      let errs: Record<string, string> | undefined;
      for (let col = 0; col < mapping.length; col++) {
        const key = mapping[col];
        if (!key) continue;
        const field = fieldByKey.get(key);
        if (!field) continue;
        const raw = (row[col] ?? "").trim();
        if (!raw) {
          if (field.required) (errs ??= {})[key] = "Required";
          continue;
        }
        if (field.schema) {
          const r = field.schema.safeParse(raw);
          if (!r.success) (errs ??= {})[key] = r.error.issues[0]?.message ?? "Invalid value";
        }
      }
      return errs;
    },
    [fieldByKey],
  );

  const recomputeDupes = React.useCallback(
    (mapping: ColumnMapping, start: number) => {
      const inFile = new Set<number>();
      const existing = new Set<number>();
      if (dedupeKeys?.length) {
        const seen = new Set<string>();
        const rows = rowsRef.current;
        for (let i = start; i < rows.length; i++) {
          if (excludedRef.current.has(i)) continue;
          const k = keyOf(rows[i]!, mapping);
          if (!k) continue;
          if (existingKeys?.has(k)) existing.add(i);
          if (seen.has(k)) inFile.add(i);
          else seen.add(k);
        }
      }
      dupesRef.current = { inFile, existing };
      return { inFileDupes: inFile.size, existingDupes: existing.size };
    },
    [dedupeKeys, existingKeys, keyOf],
  );

  const countErrors = () => {
    let cells = 0;
    let rows = 0;
    for (const [i, e] of errorsRef.current) {
      if (excludedRef.current.has(i)) continue;
      rows++;
      cells += Object.keys(e).length;
    }
    return { errorRows: rows, errorCells: cells };
  };

  /** Validate every row in time slices so a 300k-row file never freezes the page. */
  const validateAll = React.useCallback(() => {
    const run = ++runRef.current;
    const { mapping, hasHeader } = stateRef.current;
    const rows = rowsRef.current;
    const start = hasHeader ? 1 : 0;
    const errors: CellErrors = new Map();
    errorsRef.current = errors;
    dispatch({ type: "validation", patch: { validating: true, validated: 0, step: "review" } });
    let i = start;
    const tick = () => {
      if (run !== runRef.current) return;
      const end = Math.min(rows.length, i + VALIDATE_SLICE);
      for (; i < end; i++) {
        const e = validateRow(rows[i]!, mapping);
        if (e) errors.set(i, e);
      }
      if (i < rows.length) {
        dispatch({ type: "validation", patch: { validated: i - start } });
        setTimeout(tick, 0);
      } else {
        dispatch({
          type: "validation",
          patch: {
            validating: false,
            validated: rows.length - start,
            ...countErrors(),
            ...recomputeDupes(mapping, start),
          },
        });
        dispatch({ type: "bump" });
      }
    };
    tick();
  }, [validateRow, recomputeDupes]);

  const setCell = React.useCallback(
    (rowIndex: number, col: number, value: string) => {
      const { mapping, hasHeader } = stateRef.current;
      const rows = rowsRef.current;
      const prev = rows[rowIndex];
      if (!prev) return;
      const next = prev.slice();
      while (next.length <= col) next.push("");
      next[col] = value;
      rows[rowIndex] = next;
      const e = validateRow(next, mapping);
      if (e) errorsRef.current.set(rowIndex, e);
      else errorsRef.current.delete(rowIndex);
      const key = mapping[col];
      const dupePatch =
        key && dedupeKeys?.includes(key) ? recomputeDupes(mapping, hasHeader ? 1 : 0) : {};
      dispatch({ type: "validation", patch: { ...countErrors(), ...dupePatch } });
      dispatch({ type: "bump" });
    },
    [validateRow, dedupeKeys, recomputeDupes],
  );

  const setExcluded = React.useCallback(
    (indexes: Iterable<number>, excluded: boolean) => {
      for (const i of indexes) {
        if (excluded) excludedRef.current.add(i);
        else excludedRef.current.delete(i);
      }
      const { mapping, hasHeader } = stateRef.current;
      dispatch({
        type: "validation",
        patch: {
          excluded: excludedRef.current.size,
          ...countErrors(),
          ...recomputeDupes(mapping, hasHeader ? 1 : 0),
        },
      });
      dispatch({ type: "bump" });
    },
    [recomputeDupes],
  );

  const setHasHeader = React.useCallback(
    (hasHeader: boolean) => {
      const first = rowsRef.current[0] ?? [];
      const headerRow = hasHeader ? first : first.map((_, i) => `Column ${i + 1}`);
      const { mapping, confidence } = suggestMapping(headerRow, fields);
      dispatch({ type: "mapping", mapping, confidence, hasHeader });
    },
    [fields],
  );

  /** Build typed records (schema outputs) for rows that are valid, kept and not duplicates. */
  const buildRecords = React.useCallback(
    (opts: { skipDuplicates: boolean }) => {
      const { mapping, hasHeader } = stateRef.current;
      const rows = rowsRef.current;
      const out: Record<string, unknown>[] = [];
      let invalid = 0;
      let dupes = 0;
      for (let i = hasHeader ? 1 : 0; i < rows.length; i++) {
        if (excludedRef.current.has(i)) continue;
        if (errorsRef.current.has(i)) {
          invalid++;
          continue;
        }
        if (
          opts.skipDuplicates &&
          (dupesRef.current.inFile.has(i) || dupesRef.current.existing.has(i))
        ) {
          dupes++;
          continue;
        }
        const row = rows[i]!;
        const rec: Record<string, unknown> = {};
        for (let col = 0; col < mapping.length; col++) {
          const key = mapping[col];
          if (!key) continue;
          const field = fieldByKey.get(key)!;
          const raw = (row[col] ?? "").trim();
          if (!raw) {
            rec[key] = undefined;
            continue;
          }
          const r = field.schema
            ? field.schema.safeParse(raw)
            : { success: true as const, data: raw };
          rec[key] = r.success ? r.data : raw;
        }
        out.push(rec);
      }
      return { records: out, invalid, dupes };
    },
    [fieldByKey],
  );

  const reset = React.useCallback(() => {
    parseRef.current?.cancel();
    runRef.current++;
    rowsRef.current = [];
    errorsRef.current = new Map();
    excludedRef.current = new Set();
    dispatch({ type: "reset" });
  }, []);

  return {
    state,
    headers,
    bodyStart,
    rows: rowsRef,
    errors: errorsRef,
    duplicates: dupesRef,
    excludedRows: excludedRef,
    loadFile,
    setHasHeader,
    mapColumn: (col: number, key: string | null) => dispatch({ type: "map", col, key }),
    goTo: (step: ImportStep) => dispatch({ type: "step", step }),
    validateAll,
    setCell,
    setExcluded,
    buildRecords,
    reset,
  };
}

export type CsvImportController = ReturnType<typeof useCsvImport>;
