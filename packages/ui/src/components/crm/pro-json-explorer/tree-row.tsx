import * as React from "react";
import { ChevronRight, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { preview, type ChangeKind, type FlatRow, type JsonType } from "@/lib/json-explorer";

const TYPE_STYLE: Record<JsonType, string> = {
  object: "text-crm-soft border-crm-border",
  array: "text-crm-soft border-crm-border",
  string: "text-crm-success border-crm-success/30",
  number: "text-crm-primary border-crm-primary/40",
  boolean: "text-crm-warning border-crm-warning/30",
  null: "text-crm-subtle border-crm-border",
};
const TYPE_LABEL: Record<JsonType, string> = {
  object: "obj",
  array: "arr",
  string: "str",
  number: "num",
  boolean: "bool",
  null: "null",
};
const VALUE_STYLE: Record<JsonType, string> = {
  object: "text-crm-muted-fg",
  array: "text-crm-muted-fg",
  string: "text-crm-success",
  number: "text-crm-fg",
  boolean: "text-crm-warning",
  null: "text-crm-subtle italic",
};
const CHANGE_STYLE: Record<ChangeKind, string> = {
  added: "bg-crm-success/15 text-crm-success",
  removed: "bg-crm-danger/15 text-crm-danger",
  modified: "bg-crm-warning/15 text-crm-warning",
  moved: "bg-crm-primary/15 text-crm-primary",
};

export function TypeBadge({ type }: { type: JsonType }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 shrink-0 items-center rounded border px-1 font-mono text-[10px] leading-none uppercase",
        TYPE_STYLE[type],
      )}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}

export interface TreeRowProps {
  row: FlatRow;
  domId: string;
  active: boolean;
  match: boolean;
  currentMatch: boolean;
  change?: ChangeKind;
  issues?: string[];
  editing: boolean;
  editable: boolean;
  indent: number;
  onToggle: (id: string) => void;
  onSelect: (index: number) => void;
  onStartEdit: (index: number) => void;
  onCommitEdit: (text: string) => void;
  onCancelEdit: () => void;
  index: number;
  style: React.CSSProperties;
}

function EditBox({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = React.useState(initial);
  const done = React.useRef(false);
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(text);
    else onCancel();
  };
  return (
    <input
      autoFocus
      aria-label="Edit value (JSON literal)"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(true);
        else if (e.key === "Escape") finish(false);
      }}
      onBlur={() => finish(true)}
      className="h-6 min-w-0 flex-1 rounded-crm border border-crm-primary bg-crm-bg px-1.5 font-mono text-xs text-crm-fg outline-none"
    />
  );
}

function TreeRowImpl(p: TreeRowProps) {
  const { row } = p;
  const container = row.type === "object" || row.type === "array";
  const keyLabel =
    row.key === null ? "root" : typeof row.key === "number" ? `[${row.key}]` : row.key;
  return (
    <div
      id={p.domId}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-setsize={row.setSize}
      aria-posinset={row.pos}
      aria-expanded={container ? row.expanded : undefined}
      aria-selected={p.active}
      data-index={p.index}
      style={p.style}
      onClick={() => p.onSelect(p.index)}
      onDoubleClick={() => (container ? p.onToggle(row.id) : p.editable && p.onStartEdit(p.index))}
      className={cn(
        "absolute top-0 left-0 flex w-full cursor-default items-center gap-1.5 pr-3 font-mono text-xs",
        p.active ? "bg-crm-muted" : "hover:bg-crm-raised",
        p.match && "bg-crm-warning/10",
        p.currentMatch && "ring-1 ring-crm-warning ring-inset",
      )}
    >
      <span style={{ width: row.depth * p.indent }} className="shrink-0" aria-hidden />
      {container ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={(e) => {
            e.stopPropagation();
            p.onToggle(row.id);
          }}
          className="grid size-4 shrink-0 place-items-center rounded text-crm-subtle hover:text-crm-fg"
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform", row.expanded && "rotate-90")}
          />
        </button>
      ) : (
        <span className="size-4 shrink-0" aria-hidden />
      )}
      <span
        className={cn(
          "max-w-[40%] shrink-0 truncate",
          typeof row.key === "number" ? "text-crm-subtle" : "text-crm-icon",
        )}
      >
        {keyLabel}
      </span>
      <span className="text-crm-faint">:</span>
      <TypeBadge type={row.type} />
      {p.editing ? (
        <EditBox
          initial={row.type === "string" ? String(row.value) : JSON.stringify(row.value)}
          onCommit={p.onCommitEdit}
          onCancel={p.onCancelEdit}
        />
      ) : (
        <span className={cn("min-w-0 flex-1 truncate", VALUE_STYLE[row.type])}>
          {container ? (
            <span className="text-crm-muted-fg">
              {row.type === "array" ? `[${row.size}]` : `{${row.size}}`}
              {!row.expanded && row.size > 0 && (
                <span className="ml-2 text-crm-faint">{summary(row.value)}</span>
              )}
            </span>
          ) : (
            preview(row.value, 160)
          )}
        </span>
      )}
      {p.change && (
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-px text-[10px] font-medium",
            CHANGE_STYLE[p.change],
          )}
        >
          {p.change}
        </span>
      )}
      {p.issues?.length ? (
        <span
          className="flex shrink-0 items-center gap-1 text-crm-danger"
          title={p.issues.join("\n")}
        >
          <CircleAlert className="size-3.5" aria-hidden />
          <span className="sr-only">Schema error: {p.issues.join("; ")}</span>
        </span>
      ) : null}
    </div>
  );
}

function summary(v: unknown): string {
  if (Array.isArray(v)) return v.length ? `${preview(v[0], 30)}${v.length > 1 ? ", …" : ""}` : "";
  const keys = Object.keys(v as object);
  return keys.slice(0, 4).join(", ") + (keys.length > 4 ? ", …" : "");
}

export const TreeRow = React.memo(TreeRowImpl);
