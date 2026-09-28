import * as React from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActiveFilter {
  id: string;
  /** Field name, e.g. "Stage". */
  field: string;
  /** Operator, e.g. "is", "is not", ">". */
  operator?: string;
  /** Display value, e.g. "Proposal, Negotiation". */
  value: string;
}

export interface FilterChipsProps {
  filters: ActiveFilter[];
  onRemove: (id: string) => void;
  onClearAll?: () => void;
  /** Clicking a chip body (e.g. to open an editor). */
  onEdit?: (id: string) => void;
  /** Rendered after the chips, e.g. a DropdownMenu trigger. Defaults to an "Add filter" button when onAdd is set. */
  addSlot?: React.ReactNode;
  onAdd?: () => void;
  className?: string;
}

/**
 * Row of applied filters ("Stage is Proposal ×"). Backspace or Delete on a focused chip removes it
 * and moves focus to the next one.
 */
export function FilterChips({
  filters,
  onRemove,
  onClearAll,
  onEdit,
  addSlot,
  onAdd,
  className,
}: FilterChipsProps) {
  const refs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const remove = (i: number) => {
    const f = filters[i];
    if (!f) return;
    const neighbour = filters[i + 1] ?? filters[i - 1];
    onRemove(f.id);
    if (neighbour) requestAnimationFrame(() => refs.current.get(neighbour.id)?.focus());
  };
  return (
    <div
      role="group"
      aria-label="Active filters"
      className={cn("flex flex-wrap items-center gap-1.5 font-crm", className)}
    >
      {filters.map((f, i) => (
        <span
          key={f.id}
          className="inline-flex h-7 items-center overflow-hidden rounded-full border border-crm-input/60 bg-crm-raised text-xs shadow-crm-raised"
        >
          <button
            type="button"
            ref={(el) => {
              if (el) refs.current.set(f.id, el);
              else refs.current.delete(f.id);
            }}
            onClick={onEdit ? () => onEdit(f.id) : undefined}
            onKeyDown={(e) => {
              if (e.key === "Backspace" || e.key === "Delete") {
                e.preventDefault();
                remove(i);
              }
            }}
            aria-label={`${f.field} ${f.operator ?? "is"} ${f.value}. Press Delete to remove.`}
            className={cn(
              "flex h-full items-center gap-1 pr-1 pl-2.5 outline-none focus-visible:bg-crm-muted",
              onEdit ? "cursor-pointer hover:bg-crm-muted" : "cursor-default",
            )}
          >
            <span className="text-crm-soft">{f.field}</span>
            <span className="text-crm-subtle">{f.operator ?? "is"}</span>
            <span className="max-w-[180px] truncate font-medium text-crm-fg">{f.value}</span>
          </button>
          <button
            type="button"
            aria-label={`Remove ${f.field} filter`}
            onClick={() => remove(i)}
            className="grid h-full w-6 cursor-pointer place-items-center text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:bg-crm-muted focus-visible:text-crm-fg"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {addSlot ??
        (onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-dashed border-crm-input/70 px-2.5 text-xs text-crm-soft outline-none hover:border-crm-input hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            <Plus className="size-3" />
            Add filter
          </button>
        ) : null)}
      {onClearAll && filters.length > 1 ? (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-1 cursor-pointer rounded text-xs text-crm-subtle outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}
