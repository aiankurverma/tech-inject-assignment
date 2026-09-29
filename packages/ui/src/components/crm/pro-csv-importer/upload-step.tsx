import * as React from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { AlertCircle, FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImporterField } from "@/components/crm/pro-csv-importer/types";

export const btn =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-crm border border-crm-border bg-crm-raised px-3 text-sm text-crm-fg shadow-crm-raised outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring disabled:pointer-events-none disabled:opacity-50";
export const primaryBtn =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-crm bg-crm-primary px-3 text-sm font-medium text-crm-primary-fg outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-crm-ring disabled:pointer-events-none disabled:opacity-50";

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export interface UploadStepProps {
  fields: readonly ImporterField[];
  maxFileSize: number;
  error: string | null;
  disabled?: boolean;
  onFile: (file: File) => void;
  onSample?: () => void;
}

export function UploadStep({
  fields,
  maxFileSize,
  error,
  disabled,
  onFile,
  onSample,
}: UploadStepProps) {
  const [rejection, setRejection] = React.useState<string | null>(null);
  const onDrop = React.useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length) {
        const code = rejected[0]?.errors[0]?.code;
        setRejection(
          code === "file-too-large"
            ? `That file is larger than ${formatBytes(maxFileSize)}.`
            : code === "too-many-files"
              ? "Drop one file at a time."
              : "Only .csv, .tsv or .txt files can be imported.",
        );
        return;
      }
      setRejection(null);
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile, maxFileSize],
  );
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: maxFileSize,
    disabled,
    noClick: true,
    accept: {
      "text/csv": [".csv"],
      "text/tab-separated-values": [".tsv"],
      "text/plain": [".txt", ".csv"],
      "application/vnd.ms-excel": [".csv"],
    },
  });
  const message = rejection ?? error;
  const required = fields.filter((f) => f.required);

  return (
    <div className="grid gap-4 p-4 md:grid-cols-[1fr_260px]">
      <div
        {...getRootProps({
          className: cn(
            "flex min-h-64 flex-col items-center justify-center gap-3 rounded-crm border-2 border-dashed p-8 text-center transition-colors",
            isDragActive ? "border-crm-primary bg-crm-primary/10" : "border-crm-border bg-crm-bg",
          ),
        })}
      >
        <input {...getInputProps({ "aria-label": "CSV file" })} />
        <UploadCloud className="size-9 text-crm-muted-fg" aria-hidden />
        <div>
          <p className="text-sm font-medium text-crm-fg">
            {isDragActive ? "Drop to start parsing" : "Drag a CSV file here"}
          </p>
          <p className="mt-1 text-xs text-crm-muted-fg">
            CSV, TSV or TXT up to {formatBytes(maxFileSize)} · delimiter and header row are detected
            automatically
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={primaryBtn} onClick={open} disabled={disabled}>
            <FileSpreadsheet className="size-4" aria-hidden /> Choose file
          </button>
          {onSample && (
            <button type="button" className={btn} onClick={onSample} disabled={disabled}>
              Try a sample file
            </button>
          )}
        </div>
        {message && (
          <p
            role="alert"
            className="flex items-center gap-1.5 rounded-[6px] border border-crm-danger/40 bg-crm-danger/10 px-2.5 py-1.5 text-xs text-crm-danger"
          >
            <AlertCircle className="size-3.5" aria-hidden /> {message}
            {rejection && (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setRejection(null)}
                className="ml-1 rounded p-0.5 hover:bg-crm-danger/15"
              >
                <X className="size-3" aria-hidden />
              </button>
            )}
          </p>
        )}
      </div>
      <aside className="rounded-crm border border-crm-border bg-crm-bg p-3">
        <p className="text-xs font-medium tracking-wide text-crm-muted-fg uppercase">
          Expected columns
        </p>
        <ul className="mt-2 grid gap-1.5">
          {fields.map((f) => (
            <li key={f.key} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-crm-fg">
                {f.label}
                {f.required && (
                  <span className="text-crm-danger" aria-label="required">
                    {" "}
                    *
                  </span>
                )}
              </span>
              {f.example && <span className="truncate text-xs text-crm-muted-fg">{f.example}</span>}
            </li>
          ))}
        </ul>
        {required.length > 0 && (
          <p className="mt-3 text-xs text-crm-muted-fg">* required to import a row</p>
        )}
      </aside>
    </div>
  );
}

export function ParsingStep({
  fileName,
  bytes,
  total,
  rows,
  onCancel,
}: {
  fileName: string;
  bytes: number;
  total: number;
  rows: number;
  onCancel: () => void;
}) {
  const pct = total ? Math.round((bytes / total) * 100) : 0;
  return (
    <div className="grid min-h-64 place-items-center p-6">
      <div className="w-full max-w-md" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-medium text-crm-fg">
          <Loader2 className="size-4 animate-spin text-crm-primary" aria-hidden />
          Parsing {fileName}
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-crm-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Parsing progress"
        >
          <div className="h-full bg-crm-primary transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-crm-muted-fg tabular-nums">
          <span>
            {formatBytes(bytes)} of {formatBytes(total)}
          </span>
          <span>{rows.toLocaleString()} rows</span>
        </div>
        <button type="button" className={cn(btn, "mt-4")} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
