import * as React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/crm/button";
import { FileDrop } from "@/components/crm/file-drop";
import { Progress } from "@/components/crm/progress";
import { Select } from "@/components/crm/select";
import { Stepper } from "@/components/crm/stepper";
import { Switch } from "@/components/crm/switch";
import { Textarea } from "@/components/crm/textarea";
import { cn } from "@/lib/utils";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "email" | "number" | "date";
  /** Header names that auto-map to this field (case-insensitive). */
  aliases?: string[];
}

export type ImportRow = Record<string, string>;

export interface CsvImportResult {
  imported: number;
  skipped: number;
}

export interface CsvImportFlowProps {
  fields: ImportField[];
  /** Existing values of the dedupe key (e.g. emails already in the CRM). */
  existingKeys?: string[];
  /** Field used to detect duplicates. */
  dedupeKey?: string;
  /** Called with valid, mapped rows; resolve with counts. Receives a progress callback (0-1). */
  onImport: (rows: ImportRow[], onProgress: (p: number) => void) => Promise<CsvImportResult>;
  maxRows?: number;
  onDone?: () => void;
  className?: string;
}

/** RFC 4180-ish CSV parser: quoted fields, escaped quotes, CRLF, comma or semicolon. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf("\n") >>> 0);
  const delim =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function autoMap(headers: string[], fields: ImportField[]) {
  const map: Record<string, string> = {};
  for (const f of fields) {
    const names = [f.key, f.label, ...(f.aliases ?? [])].map(norm);
    const idx = headers.findIndex((h) => names.includes(norm(h)));
    if (idx >= 0 && !Object.values(map).includes(String(idx))) map[f.key] = String(idx);
  }
  return map;
}

function checkValue(f: ImportField, v: string): string | null {
  if (!v.trim()) return f.required ? `${f.label} is required` : null;
  if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return `Invalid email`;
  if (f.type === "number" && Number.isNaN(Number(v.replace(/[$,\s]/g, ""))))
    return `${f.label} not a number`;
  if (f.type === "date" && Number.isNaN(Date.parse(v))) return `${f.label} not a date`;
  return null;
}

const STEPS = [
  // Short, description-free titles keep the stepper single-line in narrow cards.
  { title: "Upload" },
  { title: "Map" },
  { title: "Review" },
  { title: "Import" },
];

/** Four-step CSV import: parse, auto-map columns, validate + dedupe, then import with progress. */
export function CsvImportFlow({
  fields,
  existingKeys = [],
  dedupeKey,
  onImport,
  maxRows = 5000,
  onDone,
  className,
}: CsvImportFlowProps) {
  const [step, setStep] = React.useState(0);
  const [raw, setRaw] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [table, setTable] = React.useState<string[][]>([]);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [skipDupes, setSkipDupes] = React.useState(true);
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<CsvImportResult | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);

  const headers = table[0] ?? [];
  const body = React.useMemo(() => table.slice(1), [table]);

  const load = (text: string) => {
    const rows = parseCsv(text);
    if (rows.length < 2) return setParseError("Need a header row and at least one data row.");
    if (rows.length - 1 > maxRows)
      return setParseError(`File has ${rows.length - 1} rows; the limit is ${maxRows}.`);
    setParseError(null);
    setTable(rows);
    setMapping(autoMap(rows[0]!, fields));
    setStep(1);
  };

  const missingRequired = fields.filter((f) => f.required && mapping[f.key] === undefined);

  const reviewed = React.useMemo(() => {
    const seen = new Set(existingKeys.map((k) => k.toLowerCase().trim()));
    return body.map((cells, i) => {
      const row: ImportRow = {};
      const errors: string[] = [];
      for (const f of fields) {
        const idx = mapping[f.key];
        const v = idx === undefined ? "" : (cells[Number(idx)] ?? "").trim();
        row[f.key] = v;
        const e = checkValue(f, v);
        if (e) errors.push(e);
      }
      let duplicate = false;
      if (dedupeKey && row[dedupeKey]) {
        const k = row[dedupeKey]!.toLowerCase();
        duplicate = seen.has(k);
        seen.add(k);
      }
      return { line: i + 2, row, errors, duplicate };
    });
  }, [body, fields, mapping, dedupeKey, existingKeys]);

  const errorRows = reviewed.filter((r) => r.errors.length);
  const dupeRows = reviewed.filter((r) => !r.errors.length && r.duplicate);
  const ready = reviewed.filter((r) => !r.errors.length && !(skipDupes && r.duplicate));

  const run = async () => {
    setStep(3);
    setRunning(true);
    setImportError(null);
    setProgress(0);
    try {
      const res = await onImport(
        ready.map((r) => r.row),
        (p) => setProgress(Math.round(Math.min(1, Math.max(0, p)) * 100)),
      );
      setProgress(100);
      setResult(res);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    setStep(0);
    setRaw("");
    setFileName(null);
    setTable([]);
    setMapping({});
    setResult(null);
    setImportError(null);
    setProgress(0);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-5 rounded-crm border border-crm-border bg-crm-card p-5 font-crm",
        className,
      )}
    >
      <Stepper steps={STEPS} current={step} onStepClick={running || result ? undefined : setStep} />

      {step === 0 ? (
        <div className="flex flex-col gap-3">
          <FileDrop
            accept=".csv,text/csv"
            hint={fileName ? `Loaded ${fileName}` : `Up to ${maxRows.toLocaleString("en-US")} rows`}
            buttonLabel="Choose CSV"
            onFile={(f) => {
              setFileName(f.name);
              f.text().then(load, () => setParseError("Couldn't read that file."));
            }}
          />
          <span className="text-center text-xs text-crm-subtle">or paste CSV</span>
          <Textarea
            aria-label="Paste CSV"
            rows={5}
            className="font-mono text-xs"
            placeholder={`${fields.map((f) => f.label).join(",")}\n...`}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          {parseError ? (
            <p role="alert" className="text-xs text-crm-danger">
              {parseError}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button variant="primary" disabled={!raw.trim()} onClick={() => load(raw)}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-crm-soft">
            {body.length} rows · {headers.length} columns. We matched {Object.keys(mapping).length}{" "}
            of {fields.length} fields automatically.
          </p>
          <div className="overflow-x-auto rounded-crm border border-crm-border">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs text-crm-subtle">
                  <th className="px-3 py-2 font-normal">CRM field</th>
                  <th className="px-3 py-2 font-normal">CSV column</th>
                  <th className="px-3 py-2 font-normal">Sample</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => {
                  const idx = mapping[f.key];
                  const used = new Set(
                    Object.entries(mapping)
                      .filter(([k]) => k !== f.key)
                      .map(([, v]) => v),
                  );
                  return (
                    <tr key={f.key} className="border-t border-crm-border">
                      <td className="px-3 py-2 text-crm-fg">
                        {f.label}
                        {f.required ? <span className="text-crm-danger"> *</span> : null}
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          aria-label={`Column for ${f.label}`}
                          className="h-8"
                          invalid={f.required && idx === undefined}
                          value={idx ?? "__none"}
                          options={[
                            { value: "__none", label: "Don't import" },
                            ...headers
                              .map((h, i) => ({ value: String(i), label: h || `Column ${i + 1}` }))
                              .filter((o) => !used.has(o.value)),
                          ]}
                          onValueChange={(v) =>
                            setMapping((m) => {
                              const next = { ...m };
                              if (v === "__none") delete next[f.key];
                              else next[f.key] = v;
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2 text-xs text-crm-subtle">
                        {idx !== undefined ? body[0]?.[Number(idx)] : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {missingRequired.length ? (
            <p className="text-xs text-crm-danger">
              Map required fields: {missingRequired.map((f) => f.label).join(", ")}
            </p>
          ) : null}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              variant="primary"
              disabled={missingRequired.length > 0}
              onClick={() => setStep(2)}
            >
              Review {body.length} rows
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Ready", ready.length, "text-crm-success"],
              ["Errors", errorRows.length, errorRows.length ? "text-crm-danger" : "text-crm-fg"],
              ["Duplicates", dupeRows.length, dupeRows.length ? "text-crm-warning" : "text-crm-fg"],
            ].map(([k, v, tone]) => (
              <div key={k as string} className="rounded-crm bg-crm-raised p-3 shadow-crm-raised">
                <div className="text-xs text-crm-subtle">{k}</div>
                <div className={cn("text-lg font-medium tabular-nums", tone as string)}>{v}</div>
              </div>
            ))}
          </div>
          {dedupeKey ? (
            <Switch
              size="sm"
              label="Skip duplicates"
              description={`Match on ${fields.find((f) => f.key === dedupeKey)?.label ?? dedupeKey}, against existing records and within the file`}
              checked={skipDupes}
              onCheckedChange={setSkipDupes}
            />
          ) : null}
          {errorRows.length ? (
            <div className="max-h-48 overflow-auto rounded-crm border border-crm-border">
              <ul className="divide-y divide-crm-border text-xs">
                {errorRows.slice(0, 50).map((r) => (
                  <li key={r.line} className="flex gap-3 px-3 py-2">
                    <span className="w-14 shrink-0 text-crm-subtle tabular-nums">Row {r.line}</span>
                    <span className="text-crm-danger">{r.errors.join(" · ")}</span>
                  </li>
                ))}
              </ul>
              {errorRows.length > 50 ? (
                <p className="px-3 py-2 text-xs text-crm-subtle">
                  +{errorRows.length - 50} more rows with errors
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-crm-success">No validation errors.</p>
          )}
          <p className="text-xs text-crm-subtle">Rows with errors are skipped.</p>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="primary" disabled={ready.length === 0} onClick={run}>
              Import {ready.length} records
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" aria-live="polite">
          {importError ? (
            <>
              <AlertTriangle className="size-8 text-crm-danger" aria-hidden />
              <p className="text-sm text-crm-fg">{importError}</p>
              <Button variant="primary" onClick={run}>
                Retry
              </Button>
            </>
          ) : result ? (
            <>
              <CheckCircle2 className="size-8 text-crm-success" aria-hidden />
              <p className="text-sm font-medium text-crm-fg">
                Imported {result.imported.toLocaleString("en-US")} records
              </p>
              <p className="text-xs text-crm-soft">
                {result.skipped + (reviewed.length - ready.length)} skipped ·{" "}
                {fileName ?? "pasted data"}
              </p>
              <div className="flex gap-2">
                <Button onClick={reset}>Import another</Button>
                {onDone ? (
                  <Button variant="primary" onClick={onDone}>
                    View records
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex w-full max-w-sm flex-col gap-2">
              <p className="text-sm text-crm-fg">Importing {ready.length} records…</p>
              <Progress value={progress} label="Import progress" showValue />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
