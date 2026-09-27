import * as React from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileDropProps {
  accept?: string;
  /** Max size in bytes. */
  maxSize?: number;
  hint?: string;
  buttonLabel?: string;
  onFile: (file: File) => void;
  className?: string;
}

/** Image upload: preview tile, "Upload" button, drag-and-drop, type and size checks. */
export function FileDrop({
  accept = "image/png,image/jpeg,image/webp,image/svg+xml",
  maxSize = 2 * 1024 * 1024,
  hint = "PNG, JPG, WebP or SVG up to 2 MB. You can also drop a file here.",
  buttonLabel = "Upload logo",
  onFile,
  className,
}: FileDropProps) {
  const input = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [over, setOver] = React.useState(false);

  React.useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const take = (file: File | undefined) => {
    if (!file) return;
    if (!accept.split(",").includes(file.type)) return setError("This file type is not supported.");
    if (file.size > maxSize)
      return setError(`File is larger than ${Math.round(maxSize / 1024 / 1024)} MB.`);
    setError(null);
    setPreview(URL.createObjectURL(file));
    onFile(file);
  };

  return (
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
        "flex items-center gap-4 rounded-crm font-crm",
        over && "ring-2 ring-crm-primary/60 ring-offset-4 ring-offset-crm-sidebar",
        className,
      )}
    >
      <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-crm-muted text-crm-subtle shadow-crm-raised">
        {preview ? (
          <img src={preview} alt="Selected file preview" className="size-full object-cover" />
        ) : (
          <Building2 className="size-5" aria-hidden />
        )}
      </span>
      <span className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="h-7 cursor-pointer rounded-full bg-crm-fg px-2.5 text-xs font-semibold text-crm-bg outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          {buttonLabel}
        </button>
        <span
          className={cn("text-xs", error ? "text-crm-danger" : "text-crm-subtle")}
          role={error ? "alert" : undefined}
        >
          {error ?? hint}
        </span>
      </span>
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
