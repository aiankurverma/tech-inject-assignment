import * as React from "react";
import { useDropzone, type Accept, type FileRejection } from "react-dropzone";
import { FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailAttachment } from "@/components/crm/pro-email-composer/types";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

let seq = 0;
const nextId = () => `att_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export interface AttachmentDropzoneProps {
  value: EmailAttachment[];
  onChange: (next: EmailAttachment[]) => void;
  /** Total size budget across all attachments. */
  maxTotalBytes: number;
  maxFiles: number;
  accept?: Accept;
  disabled?: boolean;
}

/** Drag-and-drop + click-to-browse attachments with size, count and type limits. */
export function AttachmentDropzone({
  value,
  onChange,
  maxTotalBytes,
  maxFiles,
  accept,
  disabled,
}: AttachmentDropzoneProps) {
  const [errors, setErrors] = React.useState<string[]>([]);
  const used = React.useMemo(() => value.reduce((s, a) => s + a.file.size, 0), [value]);

  const onDrop = React.useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      const errs = rejected.map(
        (r) => `${r.file.name}: ${r.errors.map((e) => e.message).join(", ")}`,
      );
      const next = [...value];
      let total = used;
      for (const file of accepted) {
        if (next.length >= maxFiles) {
          errs.push(`${file.name}: limit of ${maxFiles} attachments reached`);
          continue;
        }
        if (next.some((a) => a.file.name === file.name && a.file.size === file.size)) continue;
        if (total + file.size > maxTotalBytes) {
          errs.push(`${file.name}: exceeds the ${formatBytes(maxTotalBytes)} total limit`);
          continue;
        }
        total += file.size;
        next.push({ id: nextId(), file });
      }
      setErrors(errs);
      if (next.length !== value.length) onChange(next);
    },
    [value, used, maxFiles, maxTotalBytes, onChange],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    disabled,
    maxSize: maxTotalBytes,
  });

  return (
    <div className="flex flex-col gap-2">
      <div
        {...getRootProps({
          "aria-label": "Add attachments: drop files here or press Enter to browse",
        })}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-2 rounded-crm border border-dashed border-crm-input px-3 py-3 text-sm text-crm-muted-fg transition-colors focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none",
          isDragActive && "border-crm-primary bg-crm-primary/10 text-crm-fg",
          isDragReject && "border-crm-danger bg-tag-red-bg",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <input {...getInputProps()} />
        <Paperclip className="size-4" aria-hidden />
        {isDragActive ? (
          <span>Drop to attach</span>
        ) : (
          <span>
            Drop files or <span className="text-crm-fg underline">browse</span>
            <span className="ml-2 text-xs text-crm-subtle">
              {formatBytes(used)} / {formatBytes(maxTotalBytes)}
            </span>
          </span>
        )}
      </div>
      {errors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-0.5 text-xs text-crm-danger">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {value.length > 0 && (
        <ul aria-label="Attachments" className="flex flex-wrap gap-1.5">
          {value.map((a) => {
            const Icon = a.file.type.startsWith("image/") ? ImageIcon : FileText;
            return (
              <li
                key={a.id}
                className="flex max-w-[16rem] items-center gap-1.5 rounded-[6px] border border-crm-border bg-crm-raised py-1 pr-1 pl-2 text-xs text-crm-soft shadow-crm-raised"
              >
                <Icon className="size-3.5 shrink-0 text-crm-icon" aria-hidden />
                <span className="truncate text-crm-fg">{a.file.name}</span>
                <span className="shrink-0 text-crm-subtle">{formatBytes(a.file.size)}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((x) => x.id !== a.id))}
                  aria-label={`Remove ${a.file.name}`}
                  className="rounded p-0.5 text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                >
                  <X className="size-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
