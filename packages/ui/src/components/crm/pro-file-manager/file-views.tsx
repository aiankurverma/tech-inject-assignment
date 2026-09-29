import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FILE_DRAG_MIME,
  extension,
  fileCategory,
  formatSize,
  type FileNode,
  type FileSort,
  type FileSortKey,
} from "@/components/crm/pro-file-manager/types";

export function FileIcon({ node, className }: { node: FileNode; className?: string }) {
  const c = fileCategory(node);
  const Icon =
    c === "folders"
      ? Folder
      : c === "images"
        ? FileImage
        : c === "spreadsheets"
          ? FileSpreadsheet
          : c === "documents"
            ? FileText
            : File;
  const color =
    c === "folders"
      ? "text-[#e0b252]"
      : c === "images"
        ? "text-[#c77dff]"
        : c === "spreadsheets"
          ? "text-crm-success"
          : node.mimeType?.includes("pdf")
            ? "text-crm-danger"
            : "text-[#6aa6ff]";
  return <Icon className={cn("shrink-0", color, className)} aria-hidden />;
}

export interface ViewProps {
  rows: FileNode[];
  selected: ReadonlySet<string>;
  focused: string | null;
  renamingId: string | null;
  onItemClick: (id: string, e: React.MouseEvent) => void;
  onOpen: (node: FileNode) => void;
  onRenameCommit: (id: string, name: string | null) => void;
  onMoveInto: (ids: string[], folderId: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  scrollToIndex: number | null;
  label: string;
}

function RenameInput({ node, onDone }: { node: FileNode; onDone: (name: string | null) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const dot = node.kind === "file" ? node.name.lastIndexOf(".") : -1;
    el.setSelectionRange(0, dot > 0 ? dot : node.name.length);
  }, [node]);
  return (
    <input
      ref={ref}
      defaultValue={node.name}
      aria-label={`Rename ${node.name}`}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") onDone(e.currentTarget.value);
        else if (e.key === "Escape") onDone(null);
      }}
      onBlur={(e) => onDone(e.currentTarget.value)}
      className="h-6 w-full min-w-0 rounded border border-crm-primary bg-crm-bg px-1.5 text-sm text-crm-fg outline-none"
    />
  );
}

/** Shared drag/drop wiring: selected items drag together; folders accept drops. */
function useDnd(props: ViewProps, node: FileNode) {
  const [over, setOver] = React.useState(false);
  const isFolder = node.kind === "folder";
  return {
    over,
    handlers: {
      draggable: props.renamingId !== node.id,
      onDragStart: (e: React.DragEvent) => {
        const ids = props.selected.has(node.id) ? [...props.selected] : [node.id];
        e.dataTransfer.setData(FILE_DRAG_MIME, JSON.stringify(ids));
        e.dataTransfer.effectAllowed = "move";
      },
      onDragOver: isFolder
        ? (e: React.DragEvent) => {
            if (!e.dataTransfer.types.includes(FILE_DRAG_MIME)) return;
            e.preventDefault();
            setOver(true);
          }
        : undefined,
      onDragLeave: isFolder ? () => setOver(false) : undefined,
      onDrop: isFolder
        ? (e: React.DragEvent) => {
            setOver(false);
            const raw = e.dataTransfer.getData(FILE_DRAG_MIME);
            if (!raw) return;
            e.preventDefault();
            e.stopPropagation();
            const ids = (JSON.parse(raw) as string[]).filter((id) => id !== node.id);
            if (ids.length) props.onMoveInto(ids, node.id);
          }
        : undefined,
    },
  };
}

const HEADERS: { key: FileSortKey | null; label: string; className: string }[] = [
  { key: "name", label: "Name", className: "flex-1 min-w-0" },
  { key: "modifiedAt", label: "Modified", className: "w-36 hidden md:block" },
  { key: null, label: "Owner", className: "w-32 hidden lg:block" },
  { key: "type", label: "Type", className: "w-16 hidden sm:block" },
  { key: "size", label: "Size", className: "w-20 text-right" },
];

function ListRow({ node, props, index }: { node: FileNode; props: ViewProps; index: number }) {
  const { over, handlers } = useDnd(props, node);
  const sel = props.selected.has(node.id);
  return (
    <div
      role="row"
      id={`fm-${node.id}`}
      aria-selected={sel}
      aria-rowindex={index + 2}
      {...handlers}
      onClick={(e) => props.onItemClick(node.id, e)}
      onDoubleClick={() => props.onOpen(node)}
      className={cn(
        "flex h-full cursor-default items-center gap-3 border-b border-crm-border/60 px-3 text-sm select-none",
        sel ? "bg-crm-primary/20" : "hover:bg-crm-raised",
        props.focused === node.id && "outline outline-1 -outline-offset-1 outline-crm-primary",
        over && "bg-crm-primary/30",
      )}
    >
      <div role="gridcell" className="flex min-w-0 flex-1 items-center gap-2">
        <FileIcon node={node} className="size-4" />
        {props.renamingId === node.id ? (
          <RenameInput node={node} onDone={(n) => props.onRenameCommit(node.id, n)} />
        ) : (
          <span className="truncate text-crm-fg">{node.name}</span>
        )}
        {node.linkedRecord ? (
          <span className="hidden truncate rounded-full bg-crm-muted px-2 text-[11px] text-crm-soft xl:inline">
            {node.linkedRecord}
          </span>
        ) : null}
      </div>
      <div role="gridcell" className="hidden w-36 text-xs text-crm-soft md:block">
        {format(node.modifiedAt, "MMM d, yyyy HH:mm")}
      </div>
      <div role="gridcell" className="hidden w-32 truncate text-xs text-crm-soft lg:block">
        {node.owner}
      </div>
      <div role="gridcell" className="hidden w-16 text-xs text-crm-muted-fg sm:block">
        {node.kind === "folder" ? "Folder" : extension(node.name)}
      </div>
      <div role="gridcell" className="w-20 text-right text-xs text-crm-soft tabular-nums">
        {node.kind === "folder" ? "" : formatSize(node.size)}
      </div>
    </div>
  );
}

/** Virtualised details list (@tanstack/react-virtual), ARIA grid with multi-select. */
export function ListView(
  props: ViewProps & { sort: FileSort; onSort: (key: FileSortKey) => void },
) {
  const parent = React.useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: props.rows.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 36,
    overscan: 12,
  });
  React.useEffect(() => {
    if (props.scrollToIndex != null) v.scrollToIndex(props.scrollToIndex, { align: "auto" });
  }, [props.scrollToIndex, v]);

  return (
    <div
      role="grid"
      aria-label={props.label}
      aria-multiselectable
      aria-rowcount={props.rows.length + 1}
      aria-activedescendant={props.focused ? `fm-${props.focused}` : undefined}
      tabIndex={0}
      onKeyDown={props.onKeyDown}
      className="flex h-full min-h-0 flex-col outline-none focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:ring-inset"
    >
      <div
        role="row"
        aria-rowindex={1}
        className="flex h-9 shrink-0 items-center gap-3 border-b border-crm-border bg-crm-card px-3 text-xs font-medium text-crm-muted-fg"
      >
        {HEADERS.map((h) => {
          const active = h.key && props.sort.key === h.key;
          return (
            <div
              key={h.label}
              role="columnheader"
              aria-sort={active ? (props.sort.desc ? "descending" : "ascending") : undefined}
              className={h.className}
            >
              {h.key ? (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => props.onSort(h.key!)}
                  className={cn(
                    "inline-flex items-center gap-1 hover:text-crm-fg",
                    active && "text-crm-fg",
                  )}
                >
                  {h.label}
                  {active ? (
                    props.sort.desc ? (
                      <ArrowDown className="size-3" />
                    ) : (
                      <ArrowUp className="size-3" />
                    )
                  ) : null}
                </button>
              ) : (
                h.label
              )}
            </div>
          );
        })}
      </div>
      <div ref={parent} className="min-h-0 flex-1 overflow-auto" role="rowgroup">
        <div style={{ height: v.getTotalSize(), position: "relative" }}>
          {v.getVirtualItems().map((it) => (
            <div
              key={props.rows[it.index]!.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: it.size,
                transform: `translateY(${it.start}px)`,
              }}
            >
              <ListRow node={props.rows[it.index]!} props={props} index={it.index} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GridTile({ node, props }: { node: FileNode; props: ViewProps }) {
  const { over, handlers } = useDnd(props, node);
  const sel = props.selected.has(node.id);
  return (
    <div
      role="gridcell"
      id={`fm-${node.id}`}
      aria-selected={sel}
      {...handlers}
      onClick={(e) => props.onItemClick(node.id, e)}
      onDoubleClick={() => props.onOpen(node)}
      title={node.name}
      className={cn(
        "flex h-full cursor-default flex-col overflow-hidden rounded-crm border select-none",
        sel
          ? "border-crm-primary bg-crm-primary/15"
          : "border-crm-border bg-crm-card hover:border-crm-input",
        props.focused === node.id && "ring-2 ring-crm-primary",
        over && "border-crm-primary bg-crm-primary/30",
      )}
    >
      <div className="grid flex-1 place-items-center overflow-hidden bg-crm-raised">
        {node.thumbnailUrl ? (
          <img src={node.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <FileIcon node={node} className="size-10" />
        )}
      </div>
      <div className="flex h-9 shrink-0 items-center gap-1.5 px-2">
        <FileIcon node={node} className="size-3.5" />
        {props.renamingId === node.id ? (
          <RenameInput node={node} onDone={(n) => props.onRenameCommit(node.id, n)} />
        ) : (
          <span className="truncate text-xs text-crm-fg">{node.name}</span>
        )}
      </div>
    </div>
  );
}

/** Virtualised thumbnail grid: rows of N tiles where N follows the container width. */
export function GridView(props: ViewProps & { columns: number }) {
  const parent = React.useRef<HTMLDivElement>(null);
  const cols = Math.max(1, props.columns);
  const rowCount = Math.ceil(props.rows.length / cols);
  const v = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parent.current,
    estimateSize: () => 148,
    overscan: 4,
  });
  React.useEffect(() => {
    if (props.scrollToIndex != null) v.scrollToIndex(Math.floor(props.scrollToIndex / cols));
  }, [props.scrollToIndex, v, cols]);

  return (
    <div
      ref={parent}
      role="grid"
      aria-label={props.label}
      aria-multiselectable
      aria-activedescendant={props.focused ? `fm-${props.focused}` : undefined}
      tabIndex={0}
      onKeyDown={props.onKeyDown}
      className="h-full min-h-0 overflow-auto p-3 outline-none focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:ring-inset"
    >
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map((r) => (
          <div
            key={r.index}
            role="row"
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: r.size - 12,
              transform: `translateY(${r.start}px)`,
            }}
          >
            {props.rows.slice(r.index * cols, r.index * cols + cols).map((n) => (
              <GridTile key={n.id} node={n} props={props} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
