import * as React from "react";
import { format } from "date-fns";
import { Download, ExternalLink, Link2 } from "lucide-react";
import { FileIcon } from "@/components/crm/pro-file-manager/file-views";
import { extension, formatSize, type FileNode } from "@/components/crm/pro-file-manager/types";

export interface PreviewPaneProps {
  items: FileNode[];
  childCount: (folderId: string) => number;
  pathOf: (node: FileNode) => string;
  onOpen: (node: FileNode) => void;
  renderPreview?: (node: FileNode) => React.ReactNode;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-xs">
      <dt className="text-crm-muted-fg">{label}</dt>
      <dd className="min-w-0 truncate text-right text-crm-fg">{value}</dd>
    </div>
  );
}

/** Details / preview for the current selection (single item, multi-selection summary, or none). */
export function PreviewPane({
  items,
  childCount,
  pathOf,
  onOpen,
  renderPreview,
}: PreviewPaneProps) {
  if (items.length === 0) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-xs text-crm-muted-fg">
        Select a file to see its details.
      </div>
    );
  }
  if (items.length > 1) {
    const bytes = items.reduce((s, n) => s + (n.size ?? 0), 0);
    const folders = items.filter((n) => n.kind === "folder").length;
    return (
      <div className="h-full overflow-y-auto p-4" aria-live="polite">
        <h3 className="text-sm font-semibold text-crm-fg">{items.length} items selected</h3>
        <dl className="mt-3 divide-y divide-crm-border">
          <Row label="Files" value={items.length - folders} />
          <Row label="Folders" value={folders} />
          <Row label="Total size" value={formatSize(bytes)} />
        </dl>
        <p className="mt-4 text-xs text-crm-muted-fg">
          Drag the selection onto a folder to move it.
        </p>
      </div>
    );
  }
  const n = items[0]!;
  return (
    <div className="flex h-full flex-col overflow-y-auto" aria-live="polite">
      <div className="grid aspect-[4/3] shrink-0 place-items-center overflow-hidden border-b border-crm-border bg-crm-raised">
        {renderPreview?.(n) ??
          (n.thumbnailUrl ? (
            <img src={n.thumbnailUrl} alt={n.name} className="size-full object-contain" />
          ) : (
            <FileIcon node={n} className="size-16" />
          ))}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-semibold break-all text-crm-fg">{n.name}</h3>
        <p className="mt-0.5 text-xs text-crm-muted-fg">
          {n.kind === "folder"
            ? "Folder"
            : `${extension(n.name) || "File"} · ${formatSize(n.size)}`}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onOpen(n)}
            className="inline-flex h-8 items-center gap-1.5 rounded-crm bg-crm-primary px-3 text-xs font-medium text-white"
          >
            <ExternalLink className="size-3.5" aria-hidden /> Open
          </button>
          {n.url ? (
            <a
              href={n.url}
              download={n.name}
              className="inline-flex h-8 items-center gap-1.5 rounded-crm border border-crm-border px-3 text-xs text-crm-fg hover:bg-crm-muted"
            >
              <Download className="size-3.5" aria-hidden /> Download
            </a>
          ) : null}
        </div>
        <dl className="mt-4 divide-y divide-crm-border">
          <Row label="Location" value={pathOf(n)} />
          {n.kind === "folder" ? <Row label="Items" value={childCount(n.id)} /> : null}
          <Row label="Modified" value={format(n.modifiedAt, "MMM d, yyyy HH:mm")} />
          {n.owner ? <Row label="Owner" value={n.owner} /> : null}
          {n.mimeType ? <Row label="Type" value={n.mimeType} /> : null}
          {n.linkedRecord ? (
            <Row
              label="Linked to"
              value={
                <span className="inline-flex items-center gap-1">
                  <Link2 className="size-3" aria-hidden /> {n.linkedRecord}
                </span>
              }
            />
          ) : null}
        </dl>
      </div>
    </div>
  );
}
