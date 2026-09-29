import * as React from "react";
import { AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatValue, isNumeric, toTime } from "@/components/crm/pro-data-grid/engine";
import type { GridColumn } from "@/components/crm/pro-data-grid/types";

/* ------------------------------------------------------------------ display */

export function CellValue<TData>({
  spec,
  value,
  row,
  currency,
}: {
  spec: GridColumn<TData>;
  value: unknown;
  row: TData;
  currency: string;
}) {
  if (spec.render) return <>{spec.render(value, row)}</>;
  const type = spec.type ?? "text";
  if (type === "boolean") {
    return (
      <span
        className={cn(
          "inline-flex h-5 items-center rounded-full px-2 text-xs",
          value ? "bg-tag-green-bg text-tag-green-text" : "bg-crm-muted text-crm-muted-fg",
        )}
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }
  if (type === "enum" && value) {
    return (
      <span className="inline-flex h-5 max-w-full items-center truncate rounded-full border border-crm-border bg-crm-muted px-2 text-xs text-crm-chip">
        {String(value)}
      </span>
    );
  }
  const text = formatValue(type, value, spec.currency ?? currency);
  return text ? (
    <span className="truncate">{text}</span>
  ) : (
    <span className="text-crm-faint" aria-label="empty">
      —
    </span>
  );
}

export function GroupCellValue({
  label,
  count,
  expanded,
  depth,
  onToggle,
}: {
  label: string;
  count: number;
  expanded: boolean;
  depth: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onToggle}
      aria-expanded={expanded}
      style={{ paddingInlineStart: depth * 16 }}
      className="flex min-w-0 items-center gap-1 font-medium text-crm-fg outline-none"
    >
      <ChevronRight
        className={cn("size-4 shrink-0 transition-transform duration-150", expanded && "rotate-90")}
        aria-hidden
      />
      <span className="truncate">{label || "(blank)"}</span>
      <span className="shrink-0 rounded-full bg-crm-muted px-1.5 text-[11px] text-crm-muted-fg tabular-nums">
        {count.toLocaleString()}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------- editor */

/** Draft text for a value, in the form the editor expects. */
export function toDraft(type: GridColumn<unknown>["type"], value: unknown): string {
  if (value === null || value === undefined) return "";
  if (type === "percent" && typeof value === "number") return String(+(value * 100).toFixed(4));
  if (type === "date") {
    const t = toTime(value);
    return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
  }
  return String(value);
}

/** Draft text -> typed value (before schema validation). */
export function fromDraft(type: GridColumn<unknown>["type"], draft: string): unknown {
  const trimmed = draft.trim();
  switch (type) {
    case "number":
    case "currency":
    case "percent": {
      if (!trimmed) return null;
      const n = Number(trimmed.replace(/[,$€£%\s]/g, ""));
      if (Number.isNaN(n)) return trimmed; // let the schema report it
      return type === "percent" ? n / 100 : n;
    }
    case "boolean":
      return trimmed === "true";
    case "date":
      return trimmed || null;
    default:
      return draft;
  }
}

export type EditMove = "down" | "up" | "right" | "left" | "none";

export interface CellEditorProps<TData> {
  spec: GridColumn<TData>;
  draft: string;
  error: string | null;
  onDraftChange: (draft: string) => void;
  onCommit: (move: EditMove) => void;
  onCancel: () => void;
}

export function CellEditor<TData>({
  spec,
  draft,
  error,
  onDraftChange,
  onCommit,
  onCancel,
}: CellEditorProps<TData>) {
  const ref = React.useRef<HTMLInputElement & HTMLSelectElement>(null);
  const type = spec.type ?? "text";
  React.useEffect(() => {
    const el: HTMLElement | null = ref.current;
    if (!el) return;
    el.focus();
    if (el instanceof HTMLInputElement && el.type === "text") {
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit(e.shiftKey ? "up" : "down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      onCommit(e.shiftKey ? "left" : "right");
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };
  const errorId = React.useId();
  const common = {
    onKeyDown,
    onBlur: () => onCommit("none"),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    "aria-label": `Edit ${spec.header}`,
    className: cn(
      "h-full w-full rounded-[4px] border bg-crm-bg px-2 text-sm text-crm-fg outline-none",
      error ? "border-crm-danger" : "border-crm-primary",
      isNumeric(type) && "text-right tabular-nums",
    ),
  };

  let control: React.ReactNode;
  if (type === "enum" || type === "boolean") {
    const options = type === "boolean" ? ["true", "false"] : (spec.options ?? []);
    control = (
      <select ref={ref} value={draft} onChange={(e) => onDraftChange(e.target.value)} {...common}>
        {!options.includes(draft) && <option value={draft}>{draft || "—"}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {type === "boolean" ? (o === "true" ? "Yes" : "No") : o}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        ref={ref}
        type={type === "date" ? "date" : "text"}
        inputMode={isNumeric(type) ? "decimal" : undefined}
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        {...common}
      />
    );
  }

  return (
    <div className="relative h-full w-full py-0.5">
      {control}
      {error && (
        <div
          id={errorId}
          role="alert"
          className="absolute top-full left-0 z-20 mt-1 flex max-w-72 items-start gap-1.5 rounded-[6px] border border-crm-danger/40 bg-crm-popover px-2 py-1 text-xs text-crm-danger shadow-crm-overlay"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </div>
      )}
    </div>
  );
}
