import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = { sm: "size-3.5", md: "size-4", lg: "size-5" } as const;

export interface RatingProps {
  /** Controlled value (0 = no rating). */
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Number of stars. */
  max?: number;
  /** Display only: supports fractional values such as 3.5. */
  readOnly?: boolean;
  disabled?: boolean;
  size?: keyof typeof sizes;
  /** Accessible name of the control. */
  label?: string;
  className?: string;
}

/**
 * Star rating. Interactive mode is a radio group with roving focus: arrow keys move, Home/End jump,
 * Delete/Backspace or clicking the current star clears it. Read-only mode renders fractional fills.
 */
export function Rating({
  value,
  defaultValue = 0,
  onValueChange,
  max = 5,
  readOnly = false,
  disabled = false,
  size = "md",
  label = "Rating",
  className,
}: RatingProps) {
  const [inner, setInner] = React.useState(defaultValue);
  const [hover, setHover] = React.useState<number | null>(null);
  const current = value ?? inner;
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const stars = Array.from({ length: max }, (_, i) => i + 1);

  const set = (v: number) => {
    const next = Math.max(0, Math.min(max, v));
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };

  if (readOnly) {
    return (
      <span
        role="img"
        aria-label={`${label}: ${current} out of ${max}`}
        className={cn("inline-flex items-center gap-0.5", className)}
      >
        {stars.map((s) => {
          const fill = Math.max(0, Math.min(1, current - (s - 1)));
          return (
            <span key={s} className={cn("relative inline-flex", sizes[size])}>
              <Star className="size-full text-crm-faint" />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className={cn("fill-crm-warning text-crm-warning", sizes[size])} />
              </span>
            </span>
          );
        })}
      </span>
    );
  }

  const focusIndex = Math.max(0, Math.round(current) - 1);
  const onKeyDown = (e: React.KeyboardEvent) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(max, current + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(1, current - 1);
    else if (e.key === "Home") next = 1;
    else if (e.key === "End") next = max;
    else if (e.key === "Delete" || e.key === "Backspace") next = 0;
    if (next === null) return;
    e.preventDefault();
    set(next);
    refs.current[Math.max(0, next - 1)]?.focus();
  };
  const shown = hover ?? current;

  return (
    <span
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onMouseLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
      className={cn("inline-flex items-center gap-0.5", disabled && "opacity-50", className)}
    >
      {stars.map((s, i) => (
        <button
          key={s}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={Math.round(current) === s}
          aria-label={`${s} star${s === 1 ? "" : "s"}`}
          tabIndex={i === focusIndex ? 0 : -1}
          disabled={disabled}
          onMouseEnter={() => setHover(s)}
          onClick={() => set(current === s ? 0 : s)}
          className="cursor-pointer rounded-[3px] p-px outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed"
        >
          <Star
            className={cn(
              "transition-colors",
              sizes[size],
              s <= shown ? "fill-crm-warning text-crm-warning" : "text-crm-faint",
            )}
          />
        </button>
      ))}
    </span>
  );
}
