import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Leading icon or avatar. */
  icon?: React.ReactNode;
  /** Pressed state when the chip is selectable. */
  selected?: boolean;
  /** Makes the chip a toggle button (aria-pressed). */
  onSelectedChange?: (selected: boolean) => void;
  /** Shows a remove button; Backspace/Delete on a selectable chip also triggers it. */
  onRemove?: () => void;
  /** Accessible name for the remove button. Defaults to "Remove <text>". */
  removeLabel?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

/**
 * Compact pill for choices and values. Selectable chips act as toggle buttons, removable chips
 * expose a labelled remove button.
 */
export function Chip({
  icon,
  selected = false,
  onSelectedChange,
  onRemove,
  removeLabel,
  disabled = false,
  size = "md",
  className,
  children,
  ...props
}: ChipProps) {
  const text = typeof children === "string" ? children : undefined;
  const body = (
    <>
      {onSelectedChange && selected ? <Check className="size-3 shrink-0" /> : icon}
      <span className="truncate">{children}</span>
    </>
  );
  const inner = cn(
    "flex h-full min-w-0 items-center gap-1 outline-none [&_svg]:size-3 [&_svg]:shrink-0",
    size === "md" ? "px-2.5" : "px-2",
    onRemove && "pr-1",
  );
  return (
    <span
      data-selected={selected || undefined}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center overflow-hidden rounded-full border font-crm transition-colors",
        size === "md" ? "h-7 text-xs" : "h-6 text-[11px]",
        selected
          ? "border-crm-primary/70 bg-crm-primary/15 text-crm-fg"
          : "border-crm-input/60 bg-crm-raised text-crm-chip shadow-crm-raised",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {onSelectedChange ? (
        <button
          type="button"
          aria-pressed={selected}
          disabled={disabled}
          onClick={() => onSelectedChange(!selected)}
          onKeyDown={(e) => {
            if (onRemove && (e.key === "Backspace" || e.key === "Delete")) {
              e.preventDefault();
              onRemove();
            }
          }}
          className={cn(
            inner,
            "cursor-pointer hover:bg-crm-muted/60 focus-visible:bg-crm-muted disabled:cursor-not-allowed",
          )}
        >
          {body}
        </button>
      ) : (
        <span className={inner}>{body}</span>
      )}
      {onRemove ? (
        <button
          type="button"
          disabled={disabled}
          aria-label={removeLabel ?? (text ? `Remove ${text}` : "Remove")}
          onClick={onRemove}
          className="grid h-full w-6 shrink-0 cursor-pointer place-items-center text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:bg-crm-muted focus-visible:text-crm-fg disabled:cursor-not-allowed"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}
