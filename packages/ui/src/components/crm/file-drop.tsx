import * as React from "react";
import { Building2, CheckCircle2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileDropProps {
  accept?: string;
  /** Max size in bytes. */
  maxSize?: number;
  hint?: string;
  buttonLabel?: string;
  /** Heading shown inside the drop zone. */
  title?: string;
  onFile: (file: File) => void;
  /** Called when the selected file is cleared. */
  onRemove?: () => void;
  className?: string;
}

const fmtBytes = (b: number) =>
  b < 1024
    ? `${b} B`
    : b < 1024 ** 2
      ? `${(b / 1024).toFixed(1)} KB`
      : `${(b / 1024 ** 2).toFixed(1)} MB`;

/**
 * Image upload drop zone: dashed target with drag-over state, themed "Upload" button, preview tile,
 * selected-file row (name, size, replace, remove), and type / size validation with inline errors.
 */
export function FileDrop({
  accept = "image/png,image/jpeg,image/webp,image/svg+xml",
  maxSize = 2 * 1024 * 1024,
  hint = "PNG, JPG, WebP or SVG up to 2 MB",
  buttonLabel = "Upload logo",
  title = "Drag your company logo here",
  onFile,
  onRemove,
  className,
}: FileDropProps) {
  const input = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<{ name: string; size: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [over, setOver] = React.useState(false);

  React.useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const take = (f: File | undefined) => {
    if (!f) return;
    if (!accept.split(",").includes(f.type)) return setError("This file type is not supported.");
    if (f.size > maxSize)
      return setError(`File is larger than ${Math.round(maxSize / 1024 / 1024)} MB.`);
    setError(null);
    setPreview(URL.createObjectURL(f));
    setFile({ name: f.name, size: f.size });
    onFile(f);
  };

  const clear = () => {
    setPreview(null);
    setFile(null);
    setError(null);
    if (input.current) input.current.value = "";
    onRemove?.();
  };

  return (
    <div className={cn("flex w-full max-w-md flex-col gap-2 font-crm text-crm-fg", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-crm border border-dashed px-6 py-7 text-center transition-colors",
          over
            ? "border-crm-primary bg-crm-primary/10"
            : error
              ? "border-crm-danger/60 bg-crm-danger/5"
              : "border-crm-border bg-crm-card",
        )}
      >
        <span className="grid size-14 place-items-center overflow-hidden rounded-xl border border-crm-border bg-crm-muted text-crm-subtle shadow-crm-raised">
          {preview ? (
            <img src={preview} alt="Selected file preview" className="size-full object-cover" />
          ) : over ? (
            <UploadCloud className="size-5 text-crm-primary" aria-hidden />
          ) : (
            <Building2 className="size-5" aria-hidden />
          )}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{over ? "Drop to upload" : title}</span>
          <span className="text-xs text-crm-subtle">{hint}</span>
        </span>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-crm border border-crm-border bg-crm-raised px-3 text-xs font-medium text-crm-fg outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          <UploadCloud className="size-3.5" aria-hidden />
          {file ? "Replace file" : buttonLabel}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-crm-danger">
          {error}
        </p>
      ) : null}

      {file ? (
        <div className="flex items-center gap-2.5 rounded-crm border border-crm-border bg-crm-card px-3 py-2">
          <CheckCircle2 className="size-4 shrink-0 text-crm-success" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{file.name}</span>
            <span className="text-[11px] text-crm-subtle tabular-nums">
              {fmtBytes(file.size)} · ready
            </span>
          </span>
          <button
            type="button"
            onClick={clear}
            aria-label={`Remove ${file.name}`}
            className="grid size-7 cursor-pointer place-items-center rounded-full text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-crm-subtle">No file selected.</p>
      )}

      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => take(e.target.files?.[0])}
      />
    </div>
  );
}
