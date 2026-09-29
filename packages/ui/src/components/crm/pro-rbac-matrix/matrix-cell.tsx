import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CellState, TriState } from "@/lib/rbac-matrix";

export interface CellCommon {
  id: string;
  rowIndex: number;
  colIndex: number;
  focused: boolean;
  disabled: boolean;
  width: number;
  onActivate: (rowIndex: number, colIndex: number) => void;
  onFocusCell: (rowIndex: number, colIndex: number) => void;
}

/** A permission cell: explicit grant, inherited grant, or none. */
export const PermissionCell = React.memo(function PermissionCell(
  p: CellCommon & { state: CellState; dirty: boolean; label: string },
) {
  const { state } = p;
  const on = state.kind !== "none";
  const title =
    state.kind === "inherited"
      ? `Inherited from ${state.from} (click to grant explicitly)`
      : state.kind === "explicit"
        ? state.alsoInherited
          ? `Explicit (also inherited from ${state.alsoInherited})`
          : "Explicitly granted"
        : "Not granted";
  return (
    <div
      id={p.id}
      role="gridcell"
      aria-colindex={p.colIndex + 1}
      aria-checked={on}
      aria-disabled={p.disabled || undefined}
      aria-label={`${p.label}: ${title}`}
      tabIndex={p.focused ? 0 : -1}
      title={title}
      onClick={() => {
        p.onFocusCell(p.rowIndex, p.colIndex);
        if (!p.disabled) p.onActivate(p.rowIndex, p.colIndex);
      }}
      style={{ width: p.width }}
      className={cn(
        "relative grid h-full shrink-0 cursor-pointer place-items-center border-l border-crm-border outline-none",
        "focus-visible:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:ring-inset",
        p.dirty && "bg-crm-warning/10",
        p.disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "grid size-[18px] place-items-center rounded-[5px] border transition-colors",
          state.kind === "explicit" && "border-crm-primary bg-crm-primary text-crm-primary-fg",
          state.kind === "inherited" && "border-dashed border-crm-soft bg-crm-raised text-crm-soft",
          state.kind === "none" && "border-crm-input bg-crm-bg",
        )}
        aria-hidden
      >
        {on && <Check className="size-3" strokeWidth={3} />}
      </span>
      {state.kind === "inherited" && (
        <span
          className="absolute right-1 bottom-0.5 rounded px-0.5 text-[9px] leading-none text-crm-muted-fg"
          aria-hidden
        >
          inh
        </span>
      )}
      {p.dirty && (
        <span className="absolute top-1 right-1 size-1.5 rounded-full bg-crm-warning" aria-hidden />
      )}
    </div>
  );
});

/** Tri-state group checkbox for one role across every permission of a resource. */
export const GroupCell = React.memo(function GroupCell(
  p: CellCommon & { state: TriState; label: string; count: string },
) {
  return (
    <div
      id={p.id}
      role="gridcell"
      aria-colindex={p.colIndex + 1}
      aria-checked={p.state}
      aria-disabled={p.disabled || undefined}
      aria-label={`${p.label}: ${p.count} granted`}
      tabIndex={p.focused ? 0 : -1}
      title={`${p.count} granted`}
      onClick={() => {
        p.onFocusCell(p.rowIndex, p.colIndex);
        if (!p.disabled) p.onActivate(p.rowIndex, p.colIndex);
      }}
      style={{ width: p.width }}
      className={cn(
        "grid h-full shrink-0 cursor-pointer place-items-center border-l border-crm-border outline-none",
        "focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:ring-inset",
        p.disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "grid size-4 place-items-center rounded-[4px] border",
          p.state === false
            ? "border-crm-input bg-crm-bg"
            : "border-crm-soft bg-crm-soft text-crm-bg",
        )}
        aria-hidden
      >
        {p.state === true && <Check className="size-3" strokeWidth={3} />}
        {p.state === "mixed" && <Minus className="size-3" strokeWidth={3} />}
      </span>
    </div>
  );
});
