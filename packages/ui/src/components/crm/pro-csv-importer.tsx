import * as React from "react";
import { ArrowLeft, Check, Loader2, RotateCcw, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCsvImport } from "@/hooks/use-csv-import";
import { DedupePanel } from "@/components/crm/pro-csv-importer/dedupe-panel";
import { MappingStep } from "@/components/crm/pro-csv-importer/mapping-step";
import { ReviewGrid, type ReviewFilter } from "@/components/crm/pro-csv-importer/review-grid";
import {
  btn,
  formatBytes,
  ParsingStep,
  primaryBtn,
  UploadStep,
} from "@/components/crm/pro-csv-importer/upload-step";
import type {
  ImportSummary,
  ImporterField,
  ParseOptions,
} from "@/components/crm/pro-csv-importer/types";

export type { ImporterField, ImportSummary } from "@/components/crm/pro-csv-importer/types";
export { parseCsvFile } from "@/components/crm/pro-csv-importer/csv-parser";
export { suggestMapping, detectHeader } from "@/components/crm/pro-csv-importer/matching";

export interface ProCsvImporterProps<TRecord extends Record<string, unknown>> {
  /** Destination fields: label, aliases for auto-mapping, required flag and zod schema. */
  fields: readonly ImporterField[];
  /** Receives the typed records (schema outputs) of every valid, kept row. */
  onImport: (records: TRecord[], summary: ImportSummary) => void | Promise<void>;
  /** Field keys that identify a record for de-duplication (e.g. ["email"]). */
  dedupeKeys?: readonly string[];
  /** Keys that already exist in the CRM (lower-cased, trimmed, multi-key joined with "|"). */
  existingKeys?: ReadonlySet<string>;
  /** Max upload size in bytes (default 50 MB). */
  maxFileSize?: number;
  parseOptions?: ParseOptions;
  /** Offer a "Try a sample file" button. */
  sampleFile?: () => File;
  /** Start with this file already loaded. */
  initialFile?: File;
  /** Review grid height in px. */
  gridHeight?: number;
  title?: string;
  className?: string;
}

const STEPS = [
  { id: "upload", label: "Upload" },
  { id: "mapping", label: "Map columns" },
  { id: "review", label: "Review & fix" },
] as const;

/**
 * Onboarding-grade CSV importer: dropzone upload, chunked parsing in a Blob web worker, header
 * detection and fuzzy auto-mapping, a virtualised fix-up grid with per-cell zod errors, and a
 * duplicate preview against the file and existing CRM keys.
 */
export function ProCsvImporter<TRecord extends Record<string, unknown>>({
  fields,
  onImport,
  dedupeKeys = [],
  existingKeys,
  maxFileSize = 50 * 1024 * 1024,
  parseOptions,
  sampleFile,
  initialFile,
  gridHeight = 420,
  title = "Import records",
  className,
}: ProCsvImporterProps<TRecord>) {
  const ctl = useCsvImport({ fields, dedupeKeys, existingKeys, parseOptions });
  const { state } = ctl;
  const [filter, setFilter] = React.useState<ReviewFilter>("all");
  const [skipDuplicates, setSkipDuplicates] = React.useState(true);
  const [importing, setImporting] = React.useState(false);
  const [summary, setSummary] = React.useState<ImportSummary | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);
  const labels = React.useMemo(() => new Map(fields.map((f) => [f.key, f.label])), [fields]);

  const started = React.useRef(false);
  React.useEffect(() => {
    if (initialFile && !started.current) {
      started.current = true;
      ctl.loadFile(initialFile);
    }
  }, [initialFile, ctl]);

  const totalRows = Math.max(0, ctl.rows.current.length - ctl.bodyStart);
  const mapped = new Set(state.mapping.filter(Boolean));
  const missingRequired = fields.some((f) => f.required && !mapped.has(f.key));
  const importable = Math.max(
    0,
    totalRows -
      state.excluded -
      state.errorRows -
      (skipDuplicates ? state.inFileDupes + state.existingDupes : 0),
  );

  const load = (file: File) => {
    setSummary(null);
    setImportError(null);
    setFilter("all");
    ctl.loadFile(file);
  };

  const runImport = async () => {
    const { records, invalid, dupes } = ctl.buildRecords({ skipDuplicates });
    const s: ImportSummary = {
      fileName: state.fileName,
      totalRows,
      imported: records.length,
      skippedInvalid: invalid,
      skippedDuplicates: dupes,
    };
    setImporting(true);
    setImportError(null);
    try {
      await onImport(records as TRecord[], s);
      setSummary(s);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const stepIndex = summary
    ? 3
    : state.step === "parsing"
      ? 0
      : STEPS.findIndex((s) => s.id === state.step);
  const tabs: { id: ReviewFilter; label: string; count: number }[] = [
    { id: "all", label: "All rows", count: totalRows - state.excluded },
    { id: "errors", label: "Errors", count: state.errorRows },
    { id: "duplicates", label: "Duplicates", count: state.inFileDupes + state.existingDupes },
    { id: "excluded", label: "Removed", count: state.excluded },
  ];

  return (
    <section
      aria-label={title}
      className={cn(
        "flex w-full min-w-0 flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-crm-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {state.fileName && (
          <span className="truncate text-xs text-crm-muted-fg">
            {state.fileName} · {formatBytes(state.fileSize)}
          </span>
        )}
        <ol className="ml-auto flex items-center gap-1 text-xs" aria-label="Import progress">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center gap-1"
              aria-current={i === stepIndex ? "step" : undefined}
            >
              {i > 0 && <span className="h-px w-4 bg-crm-border" aria-hidden />}
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full border text-[11px] tabular-nums",
                  i < stepIndex
                    ? "border-crm-primary bg-crm-primary text-crm-primary-fg"
                    : i === stepIndex
                      ? "border-crm-primary text-crm-fg"
                      : "border-crm-border text-crm-muted-fg",
                )}
              >
                {i < stepIndex ? <Check className="size-3" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden sm:inline",
                  i === stepIndex ? "text-crm-fg" : "text-crm-muted-fg",
                )}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      </header>

      {summary ? (
        <div className="grid min-h-64 place-items-center p-6 text-center" role="status">
          <div className="grid justify-items-center gap-2">
            <span className="grid size-10 place-items-center rounded-full bg-tag-green-bg text-tag-green-text">
              <Check className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-medium">
              Imported {summary.imported.toLocaleString()} of {summary.totalRows.toLocaleString()}{" "}
              rows
            </p>
            <p className="text-xs text-crm-muted-fg">
              {summary.skippedInvalid.toLocaleString()} skipped with errors ·{" "}
              {summary.skippedDuplicates.toLocaleString()} duplicates skipped
            </p>
            <button
              type="button"
              className={cn(btn, "mt-2")}
              onClick={() => {
                setSummary(null);
                ctl.reset();
              }}
            >
              <Upload className="size-4" aria-hidden /> Import another file
            </button>
          </div>
        </div>
      ) : state.step === "upload" ? (
        <UploadStep
          fields={fields}
          maxFileSize={maxFileSize}
          error={state.parseError}
          onFile={load}
          onSample={sampleFile ? () => load(sampleFile()) : undefined}
        />
      ) : state.step === "parsing" ? (
        <ParsingStep
          fileName={state.fileName}
          bytes={state.progress.bytes}
          total={state.progress.total}
          rows={state.progress.rows}
          onCancel={ctl.reset}
        />
      ) : state.step === "mapping" ? (
        <MappingStep
          headers={ctl.headers}
          samples={ctl.rows.current.slice(ctl.bodyStart, ctl.bodyStart + 5)}
          fields={fields}
          mapping={state.mapping}
          confidence={state.confidence}
          hasHeader={state.hasHeader}
          delimiter={state.delimiter}
          rowCount={totalRows}
          truncated={state.truncated}
          onMap={ctl.mapColumn}
          onHasHeaderChange={ctl.setHasHeader}
        />
      ) : (
        <div className="flex min-w-0 flex-col">
          <DedupePanel
            ctl={ctl}
            dedupeKeys={dedupeKeys}
            labels={labels}
            skipDuplicates={skipDuplicates}
            onSkipDuplicatesChange={setSkipDuplicates}
          />
          <div className="flex flex-wrap items-center gap-2 border-b border-crm-border px-4 py-2">
            <div role="tablist" aria-label="Filter rows" className="flex flex-wrap gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === t.id}
                  onClick={() => setFilter(t.id)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
                    filter === t.id
                      ? "bg-crm-primary/15 text-crm-fg"
                      : "text-crm-muted-fg hover:bg-crm-muted",
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 tabular-nums",
                      t.id === "errors" && t.count > 0
                        ? "bg-crm-danger/15 text-crm-danger"
                        : "bg-crm-muted",
                    )}
                  >
                    {t.count.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
            {state.validating && (
              <span
                className="ml-auto flex items-center gap-1.5 text-xs text-crm-muted-fg tabular-nums"
                role="status"
              >
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Validating {state.validated.toLocaleString()} / {totalRows.toLocaleString()}
              </span>
            )}
            {!state.validating && state.errorCells > 0 && (
              <span className="ml-auto text-xs text-crm-danger">
                {state.errorCells.toLocaleString()} cells need fixing — double-click or press Enter
                to edit
              </span>
            )}
          </div>
          <ReviewGrid ctl={ctl} fields={fields} filter={filter} height={gridHeight} />
        </div>
      )}

      {!summary && (state.step === "mapping" || state.step === "review") && (
        <footer className="flex flex-wrap items-center gap-2 border-t border-crm-border px-4 py-3">
          <button type="button" className={btn} onClick={ctl.reset}>
            <RotateCcw className="size-4" aria-hidden /> Start over
          </button>
          {state.step === "review" && (
            <button type="button" className={btn} onClick={() => ctl.goTo("mapping")}>
              <ArrowLeft className="size-4" aria-hidden /> Mapping
            </button>
          )}
          {importError && (
            <span role="alert" className="text-xs text-crm-danger">
              {importError}
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            {state.step === "review" && !state.validating && (
              <span className="hidden text-xs text-crm-muted-fg sm:inline tabular-nums">
                {state.errorRows > 0 &&
                  `${state.errorRows.toLocaleString()} rows with errors will be skipped · `}
                {importable.toLocaleString()} ready
              </span>
            )}
            {state.step === "mapping" ? (
              <button
                type="button"
                className={primaryBtn}
                disabled={missingRequired || mapped.size === 0}
                onClick={() => {
                  setFilter("all");
                  ctl.validateAll();
                }}
              >
                Validate {totalRows.toLocaleString()} rows
              </button>
            ) : (
              <button
                type="button"
                className={primaryBtn}
                disabled={state.validating || importing || importable === 0}
                onClick={() => void runImport()}
              >
                {importing && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Import {importable.toLocaleString()} rows
              </button>
            )}
          </div>
        </footer>
      )}
    </section>
  );
}
