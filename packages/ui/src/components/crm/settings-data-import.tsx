import * as React from "react";
import { CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/crm/alert";
import { Button } from "@/components/crm/button";
import { Progress } from "@/components/crm/progress";
import { RadioGroup } from "@/components/crm/radio-group";
import { Select } from "@/components/crm/select";
import { Stepper } from "@/components/crm/stepper";
import { Tag } from "@/components/crm/tag";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "email" | "phone" | "number" | "date";
  /** Extra header names that should auto-map to this field. */
  aliases?: string[];
}

export type DedupeStrategy = "skip" | "update" | "create";

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
}

export interface SettingsDataImportProps {
  /** Object being imported, e.g. "contacts". */
  objectName?: string;
  fields: ImportField[];
  /** Field used to detect duplicates. */
  matchKey?: string;
  maxRows?: number;
  /** Import valid rows. Call onProgress(0-1) while working. */
  onImport: (
    rows: Record<string, string>[],
    options: { dedupe: DedupeStrategy },
    onProgress: (fraction: number) => void,
  ) => Promise<ImportResult>;
  /** Download a template CSV built from the fields. */
  showTemplate?: boolean;
  className?: string;
}

/** RFC 4180-ish CSV parser: quoted fields, escaped quotes, CRLF, and ; or tab delimiters (auto-detected). */
export function parseCsv(text: string): string[][] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const first = clean.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, first.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0]?.[0] ?? ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const toCsv = (rows: string[][]) =>
  rows
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
    .join("\n");

function validate(value: string, field: ImportField): string | null {
  const v = value.trim();
  if (!v) return field.required ? `${field.label} is required` : null;
  switch (field.type) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : `Invalid email "${v}"`;
    case "phone":
      return v.replace(/\D/g, "").length >= 7 ? null : `Invalid phone "${v}"`;
    case "number":
      return Number.isFinite(Number(v.replace(/[,$€£₹\s]/g, ""))) ? null : `Not a number "${v}"`;
    case "date":
      return Number.isNaN(Date.parse(v)) ? `Invalid date "${v}"` : null;
    default:
      return null;
  }
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const STEPS = [
  { title: "Upload", description: "CSV file" },
  { title: "Map columns", description: "Match to fields" },
  { title: "Review", description: "Fix and dedupe" },
  { title: "Import", description: "Done" },
];
const SKIP = "__skip";

/** CSV import wizard: parse, auto-map columns, per-row validation, in-file duplicate detection, dedupe strategy, error export and progress. */
export function SettingsDataImport({
  objectName = "contacts",
  fields,
  matchKey = "email",
  maxRows = 10000,
  onImport,
  showTemplate = true,
  className,
}: SettingsDataImportProps) {
  const id = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [step, setStep] = React.useState(0);
  const [fileName, setFileName] = React.useState("");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [data, setData] = React.useState<string[][]>([]);
  const [mapping, setMapping] = React.useState<Record<number, string>>({});
  const [dedupe, setDedupe] = React.useState<DedupeStrategy>("update");
  const [error, setError] = React.useState<string | null>(null);
  const [over, setOver] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/\.(csv|tsv|txt)$/i.test(file.name))
      return setError("Upload a .csv file. Export from Excel with File → Save as → CSV UTF-8.");
    if (file.size > 10 * 1024 * 1024)
      return setError("File is larger than 10 MB. Split it into smaller files.");
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return setError("The file needs a header row and at least one data row.");
    if (rows.length - 1 > maxRows)
      return setError(
        `This file has ${(rows.length - 1).toLocaleString()} rows. The limit is ${maxRows.toLocaleString()} per import.`,
      );
    const hdr = (rows[0] ?? []).map((h) => h.trim());
    const auto: Record<number, string> = {};
    const used = new Set<string>();
    hdr.forEach((h, i) => {
      const f = fields.find(
        (f) =>
          !used.has(f.key) &&
          [f.key, f.label, ...(f.aliases ?? [])].some((a) => norm(a) === norm(h)),
      );
      if (f) {
        auto[i] = f.key;
        used.add(f.key);
      }
    });
    setFileName(file.name);
    setHeaders(hdr);
    setData(rows.slice(1));
    setMapping(auto);
    setStep(1);
  };

  const mappedKeys = React.useMemo(
    () => Object.values(mapping).filter((k) => k !== SKIP),
    [mapping],
  );
  const missingRequired = fields.filter((f) => f.required && !mappedKeys.includes(f.key));
  const dupTargets = mappedKeys.filter((k, i) => mappedKeys.indexOf(k) !== i);

  const analysis = React.useMemo(() => {
    if (step < 2) return null;
    const seen = new Map<string, number>();
    const valid: Record<string, string>[] = [];
    const invalid: { line: number; errors: string[]; raw: string[] }[] = [];
    let inFileDupes = 0;
    data.forEach((raw, r) => {
      const rec: Record<string, string> = {};
      const errs: string[] = [];
      headers.forEach((_, c) => {
        const key = mapping[c];
        if (!key || key === SKIP) return;
        rec[key] = (raw[c] ?? "").trim();
      });
      fields.forEach((f) => {
        const e = validate(rec[f.key] ?? "", f);
        if (e && (f.required || mappedKeys.includes(f.key))) errs.push(e);
      });
      const mk = rec[matchKey]?.toLowerCase();
      if (mk) {
        if (seen.has(mk)) {
          inFileDupes++;
          errs.push(`Duplicate of row ${(seen.get(mk) ?? 0) + 2}`);
        } else seen.set(mk, r);
      }
      if (errs.length) invalid.push({ line: r + 2, errors: errs, raw });
      else valid.push(rec);
    });
    return { valid, invalid, inFileDupes };
  }, [step, data, headers, mapping, fields, matchKey, mappedKeys]);

  const run = async () => {
    if (!analysis) return;
    setStep(3);
    setRunning(true);
    setProgress(0);
    setError(null);
    try {
      const res = await onImport(analysis.valid, { dedupe }, (f) =>
        setProgress(Math.round(Math.min(1, Math.max(0, f)) * 100)),
      );
      setProgress(100);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
      setStep(2);
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    setStep(0);
    setHeaders([]);
    setData([]);
    setMapping({});
    setResult(null);
    setError(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const matchLabel = fields.find((f) => f.key === matchKey)?.label ?? matchKey;

  return (
    <div
      className={cn(
        "flex w-full max-w-4xl flex-col gap-6 rounded-xl border border-crm-border bg-crm-card p-4 font-crm shadow-crm-raised sm:p-6",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-crm-fg">Import {objectName}</h2>
          <p className="text-xs text-crm-soft">
            Up to {maxRows.toLocaleString()} rows per file. Duplicates are matched on {matchLabel}.
          </p>
        </div>
        {showTemplate ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              download(`${objectName}-template.csv`, toCsv([fields.map((f) => f.label)]))
            }
          >
            <Download />
            Template CSV
          </Button>
        ) : null}
      </header>

      <Stepper steps={STEPS} current={step} />

      {error ? (
        <Alert tone="danger" title="Something needs attention" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {step === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void readFile(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-xl border border-dashed border-crm-input/60 p-10 text-center transition-colors",
            over && "border-crm-primary bg-crm-primary/5",
          )}
        >
          <FileSpreadsheet className="size-8 text-crm-subtle" aria-hidden />
          <p className="text-sm text-crm-fg">Drop a CSV here or choose a file</p>
          <p className="text-xs text-crm-soft">
            UTF-8 CSV with a header row. Comma, semicolon and tab delimiters are detected.
          </p>
          <input
            ref={inputRef}
            id={`${id}-file`}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="sr-only"
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
          <Button variant="primary" onClick={() => inputRef.current?.click()}>
            <Upload />
            Choose file
          </Button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-crm-soft">
            <span className="text-crm-fg">{fileName}</span> · {data.length.toLocaleString()} rows ·{" "}
            {headers.length} columns · {mappedKeys.length} mapped automatically
          </p>
          <div className="overflow-x-auto rounded-xl border border-crm-border">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="text-crm-subtle">
                <tr className="border-b border-crm-border">
                  <th scope="col" className="px-3 py-2 font-medium">
                    Column in file
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Sample values
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Import as
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crm-border">
                {headers.map((h, i) => (
                  <tr key={`${h}-${i}`}>
                    <td className="px-3 py-2 text-crm-fg">
                      {h || <span className="text-crm-subtle">(no header)</span>}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-crm-soft">
                      {data
                        .slice(0, 3)
                        .map((r) => r[i])
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        aria-label={`Map column ${h}`}
                        className="w-48"
                        value={mapping[i] ?? SKIP}
                        invalid={!!mapping[i] && dupTargets.includes(mapping[i] ?? "")}
                        onValueChange={(val) => setMapping((m) => ({ ...m, [i]: val }))}
                        options={[
                          { value: SKIP, label: "Don't import" },
                          ...fields.map((f) => ({
                            value: f.key,
                            label: f.required ? `${f.label} *` : f.label,
                          })),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {missingRequired.length ? (
            <Alert tone="warning" title="Required fields not mapped">
              Map a column to: {missingRequired.map((f) => f.label).join(", ")}.
            </Alert>
          ) : null}
          {dupTargets.length ? (
            <Alert tone="warning" title="Two columns map to the same field">
              {Array.from(new Set(dupTargets))
                .map((k) => fields.find((f) => f.key === k)?.label ?? k)
                .join(", ")}{" "}
              can only be mapped once.
            </Alert>
          ) : null}
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={reset}>
              Choose another file
            </Button>
            <Button
              variant="primary"
              disabled={!!missingRequired.length || !!dupTargets.length}
              onClick={() => setStep(2)}
            >
              Review data
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 && analysis ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-crm bg-crm-raised p-3 shadow-crm-raised">
              <p className="crm-caption text-crm-subtle">Ready to import</p>
              <p className="text-xl font-semibold text-crm-success tabular-nums">
                {analysis.valid.length.toLocaleString()}
              </p>
            </div>
            <div className="rounded-crm bg-crm-raised p-3 shadow-crm-raised">
              <p className="crm-caption text-crm-subtle">Rows with errors</p>
              <p className="text-xl font-semibold text-crm-danger tabular-nums">
                {analysis.invalid.length.toLocaleString()}
              </p>
            </div>
            <div className="rounded-crm bg-crm-raised p-3 shadow-crm-raised">
              <p className="crm-caption text-crm-subtle">Duplicates in file</p>
              <p className="text-xl font-semibold text-crm-warning tabular-nums">
                {analysis.inFileDupes.toLocaleString()}
              </p>
            </div>
          </div>

          {analysis.invalid.length ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-crm-soft">
                  Rows below will be skipped. Showing first {Math.min(5, analysis.invalid.length)}.
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    download(
                      `${objectName}-errors.csv`,
                      toCsv([
                        ["Row", "Errors", ...headers],
                        ...analysis.invalid.map((r) => [
                          String(r.line),
                          r.errors.join("; "),
                          ...r.raw,
                        ]),
                      ]),
                    )
                  }
                >
                  <Download />
                  Download error rows
                </Button>
              </div>
              <ul className="divide-y divide-crm-border rounded-xl border border-crm-border text-xs">
                {analysis.invalid.slice(0, 5).map((r) => (
                  <li key={r.line} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <Tag size="sm" color="red">
                      Row {r.line}
                    </Tag>
                    <span className="text-crm-soft">{r.errors.join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs text-crm-soft">
              When a {objectName.replace(/s$/, "")} with the same {matchLabel} already exists
            </legend>
            <RadioGroup
              label="Duplicate handling"
              value={dedupe}
              onValueChange={(d) => setDedupe(d as DedupeStrategy)}
              options={[
                {
                  value: "update",
                  label: "Update the existing record",
                  description: "Empty cells never overwrite existing data.",
                },
                {
                  value: "skip",
                  label: "Skip the row",
                  description: "Keep existing records untouched.",
                },
                {
                  value: "create",
                  label: "Create a duplicate",
                  description: "Not recommended - you can merge later.",
                },
              ]}
            />
          </fieldset>

          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back to mapping
            </Button>
            <Button variant="primary" disabled={!analysis.valid.length} onClick={() => void run()}>
              Import {analysis.valid.length.toLocaleString()} {objectName}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-4" aria-live="polite">
          {running || !result ? (
            <>
              <p className="text-sm text-crm-fg">
                Importing {objectName}... you can leave this page, we'll email you when it's done.
              </p>
              <Progress value={progress} label="Import progress" showValue />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-crm-success">
                <CheckCircle2 className="size-5" aria-hidden />
                <p className="text-sm font-medium">Import complete</p>
              </div>
              <dl className="grid grid-cols-3 gap-3 text-center">
                {(
                  [
                    ["Created", result.created, "text-crm-success"],
                    ["Updated", result.updated, "text-crm-fg"],
                    ["Skipped", result.skipped + (analysis?.invalid.length ?? 0), "text-crm-soft"],
                  ] as const
                ).map(([label, n, cls]) => (
                  <div key={label} className="rounded-crm bg-crm-raised p-3 shadow-crm-raised">
                    <dt className="crm-caption text-crm-subtle">{label}</dt>
                    <dd className={cn("text-xl font-semibold tabular-nums", cls)}>
                      {n.toLocaleString()}
                    </dd>
                  </div>
                ))}
              </dl>
              <Button className="self-start" onClick={reset}>
                Import another file
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
