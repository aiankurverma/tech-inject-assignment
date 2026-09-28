import * as React from "react";
import {
  Check,
  Download,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
  RotateCw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileItem {
  id: string;
  name: string;
  /** Bytes. */
  size: number;
  mimeType?: string;
  uploadedAt?: Date | string;
  uploadedBy?: string;
  url?: string;
  /** 0-100 while uploading. */
  progress?: number;
  status?: "ready" | "uploading" | "error";
  error?: string;
}

export type FileSort = "name" | "size" | "date";

export interface FileListProps {
  files: FileItem[];
  onOpen?: (file: FileItem) => void;
  onDownload?: (file: FileItem) => void;
  onRemove?: (file: FileItem) => void;
  onRetry?: (file: FileItem) => void;
  /** Enable checkboxes and bulk actions. */
  selectable?: boolean;
  onBulkDownload?: (files: FileItem[]) => void;
  onBulkRemove?: (files: FileItem[]) => void;
  defaultSort?: FileSort;
  locale?: string;
  emptyText?: string;
  className?: string;
}

export function formatBytes(bytes: number, locale?: string): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / 1024 ** i;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: i === 0 || v >= 100 ? 0 : 1 }).format(v)} ${units[i]}`;
}

const ext = (name: string) =>
  name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";

function kindOf(f: FileItem) {
  const e = ext(f.name);
  const m = f.mimeType ?? "";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(e))
    return { Icon: FileImage, tone: "text-tag-purple-text bg-tag-purple-bg" };
  if (m.startsWith("video/") || ["mp4", "mov", "webm"].includes(e))
    return { Icon: FileVideo, tone: "text-tag-orange-text bg-tag-orange-bg" };
  if (["xls", "xlsx", "csv", "numbers"].includes(e))
    return { Icon: FileSpreadsheet, tone: "text-tag-green-text bg-tag-green-bg" };
  if (["ppt", "pptx", "key"].includes(e))
    return { Icon: Presentation, tone: "text-tag-amber-text bg-tag-amber-bg" };
  if (["zip", "rar", "7z", "gz", "tar"].includes(e))
    return { Icon: FileArchive, tone: "text-tag-yellow-text bg-tag-yellow-bg" };
  if (e === "pdf") return { Icon: FileText, tone: "text-tag-red-text bg-tag-red-bg" };
  if (["doc", "docx", "txt", "md", "rtf"].includes(e))
    return { Icon: FileText, tone: "text-tag-blue-text bg-tag-blue-bg" };
  return { Icon: File, tone: "text-crm-chip bg-crm-muted" };
}

/**
 * Attachment list with type-aware icons, human file sizes, upload progress and error/retry states,
 * sorting, multi-select with bulk download/remove and a running total size.
 */
export function FileList({
  files,
  onOpen,
  onDownload,
  onRemove,
  onRetry,
  selectable,
  onBulkDownload,
  onBulkRemove,
  defaultSort = "date",
  locale,
  emptyText = "No attachments yet.",
  className,
}: FileListProps) {
  const [sort, setSort] = React.useState<FileSort>(defaultSort);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const dateFmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const time = (f: FileItem) => (f.uploadedAt ? new Date(f.uploadedAt).getTime() : 0);

  const sorted = React.useMemo(() => {
    const list = [...files];
    if (sort === "name")
      list.sort((a, b) => a.name.localeCompare(b.name, locale, { numeric: true }));
    else if (sort === "size") list.sort((a, b) => b.size - a.size);
    else list.sort((a, b) => time(b) - time(a));
    return list;
  }, [files, sort, locale]);

  const readyIds = files.filter((f) => (f.status ?? "ready") === "ready").map((f) => f.id);
  const live = new Set(files.map((f) => f.id));
  const sel = [...selected].filter((id) => live.has(id));
  const selFiles = files.filter((f) => sel.includes(f.id));
  const total = files.reduce((s, f) => s + f.size, 0);
  const allChecked = readyIds.length > 0 && readyIds.every((id) => selected.has(id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className={cn("font-crm", className)} aria-label="Attachments">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-crm-muted-fg">
          {selectable && files.length ? (
            <CrmCheckbox
              label="Select all files"
              checked={allChecked}
              onChange={() => setSelected(allChecked ? new Set() : new Set(readyIds))}
            />
          ) : null}
          {sel.length ? (
            <span className="text-crm-fg">{sel.length} selected</span>
          ) : (
            <span>
              {files.length} {files.length === 1 ? "file" : "files"} · {formatBytes(total, locale)}
            </span>
          )}
          {sel.length && onBulkDownload ? (
            <button
              type="button"
              onClick={() => onBulkDownload(selFiles)}
              className="cursor-pointer rounded text-crm-soft hover:text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              Download
            </button>
          ) : null}
          {sel.length && onBulkRemove ? (
            <button
              type="button"
              onClick={() => {
                onBulkRemove(selFiles);
                setSelected(new Set());
              }}
              className="cursor-pointer rounded text-crm-danger hover:underline outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              Remove
            </button>
          ) : null}
        </div>
        <label className="flex items-center gap-1 text-xs text-crm-muted-fg">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as FileSort)}
            className="h-6 cursor-pointer rounded-full border border-crm-border bg-crm-raised px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            <option value="date">Newest</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
          </select>
        </label>
      </div>
      {files.length === 0 ? (
        <p className="rounded-crm border border-dashed border-crm-border py-6 text-center text-sm text-crm-muted-fg">
          {emptyText}
        </p>
      ) : (
        <ul className="divide-y divide-crm-border rounded-crm border border-crm-border bg-crm-card">
          {sorted.map((f) => {
            const { Icon, tone } = kindOf(f);
            const status = f.status ?? "ready";
            return (
              <li
                key={f.id}
                className={cn(
                  "group flex items-center gap-2.5 px-2.5 py-2",
                  selected.has(f.id) && "bg-crm-primary/10",
                )}
              >
                {selectable ? (
                  <CrmCheckbox
                    label={`Select ${f.name}`}
                    disabled={status !== "ready"}
                    checked={selected.has(f.id)}
                    onChange={() => toggle(f.id)}
                  />
                ) : null}
                <span
                  className={cn("grid size-8 shrink-0 place-items-center rounded-crm", tone)}
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onOpen?.(f)}
                    disabled={status !== "ready"}
                    title={f.name}
                    className="block max-w-full cursor-pointer truncate rounded text-left text-sm text-crm-fg outline-none hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-default disabled:no-underline"
                  >
                    {f.name}
                  </button>
                  {status === "uploading" ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        role="progressbar"
                        aria-label={`Uploading ${f.name}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(f.progress ?? 0)}
                        className="h-1 flex-1 overflow-hidden rounded-full bg-crm-track"
                      >
                        <span
                          className="block h-full bg-crm-primary transition-[width] duration-300"
                          style={{ width: `${f.progress ?? 0}%` }}
                        />
                      </span>
                      <span className="text-[11px] text-crm-muted-fg tabular-nums">
                        {Math.round(f.progress ?? 0)}%
                      </span>
                    </div>
                  ) : status === "error" ? (
                    <p role="alert" className="text-[11px] text-crm-danger">
                      {f.error ?? "Upload failed"}
                    </p>
                  ) : (
                    <p className="truncate text-[11px] text-crm-muted-fg">
                      {formatBytes(f.size, locale)}
                      {f.uploadedAt ? ` · ${dateFmt.format(new Date(f.uploadedAt))}` : ""}
                      {f.uploadedBy ? ` · ${f.uploadedBy}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  {status === "error" && onRetry ? (
                    <ActionBtn label={`Retry ${f.name}`} onClick={() => onRetry(f)}>
                      <RotateCw />
                    </ActionBtn>
                  ) : null}
                  {status === "ready" && onDownload ? (
                    <ActionBtn label={`Download ${f.name}`} onClick={() => onDownload(f)}>
                      <Download />
                    </ActionBtn>
                  ) : null}
                  {onRemove ? (
                    <ActionBtn
                      label={`${status === "uploading" ? "Cancel" : "Remove"} ${f.name}`}
                      onClick={() => onRemove(f)}
                      danger
                    >
                      <Trash2 />
                    </ActionBtn>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ActionBtn({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-7 cursor-pointer place-items-center rounded-full text-crm-muted-fg outline-none [&_svg]:size-3.5",
        "focus-visible:ring-2 focus-visible:ring-crm-ring/60",
        danger
          ? "hover:bg-crm-danger/15 hover:text-crm-danger"
          : "hover:bg-crm-muted hover:text-crm-fg",
      )}
    >
      {children}
    </button>
  );
}

function CrmCheckbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <span className="relative grid size-4 shrink-0 place-items-center">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="peer size-4 cursor-pointer appearance-none rounded-[4px] border border-crm-border bg-crm-input outline-none transition-colors checked:border-crm-primary checked:bg-crm-primary hover:border-crm-faint focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed disabled:border-crm-border/50 disabled:bg-crm-muted/40"
      />
      <Check
        aria-hidden
        strokeWidth={3}
        className="pointer-events-none absolute size-3 text-crm-primary-fg opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
}
