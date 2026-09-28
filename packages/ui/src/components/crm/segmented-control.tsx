import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  /** Optional count shown after the label. */
  count?: number;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  size?: "sm" | "md";
  /** Stretch segments to fill the container width. */
  fullWidth?: boolean;
  /** Accessible name for the control. */
  label: string;
  className?: string;
}

/** Pill view switcher with a sliding thumb. Radio-group semantics: arrow keys move and select. */
export function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  size = "md",
  fullWidth,
  label,
  className,
}: SegmentedControlProps) {
  const [inner, setInner] = React.useState(defaultValue ?? options[0]?.value ?? "");
  const current = value ?? inner;
  // Keep one segment tabbable even when the value matches no enabled option.
  const tabbable = options.some((o) => o.value === current && !o.disabled)
    ? current
    : options.find((o) => !o.disabled)?.value;
  const listRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const [thumb, setThumb] = React.useState<{ left: number; width: number } | null>(null);

  const select = (v: string) => {
    if (value === undefined) setInner(v);
    onValueChange?.(v);
  };

  React.useLayoutEffect(() => {
    const list = listRef.current;
    const el = itemRefs.current.get(current);
    if (!list || !el) {
      setThumb(null);
      return;
    }
    const measure = () => setThumb({ left: el.offsetLeft, width: el.offsetWidth });
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(list);
    return () => ro?.disconnect();
  }, [current, options]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const enabled = options.filter((o) => !o.disabled);
    if (!enabled.length) return;
    const i = Math.max(
      0,
      enabled.findIndex((o) => o.value === current),
    );
    let n: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % enabled.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + enabled.length) % enabled.length;
    if (e.key === "Home") n = 0;
    if (e.key === "End") n = enabled.length - 1;
    if (n === null) return;
    e.preventDefault();
    const next = enabled[n];
    if (!next) return;
    select(next.value);
    itemRefs.current.get(next.value)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "relative isolate items-center rounded-full bg-crm-bg p-0.5 font-crm shadow-crm-raised",
        fullWidth ? "flex w-full" : "inline-flex",
        className,
      )}
    >
      {thumb ? (
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 -z-10 rounded-full bg-crm-muted shadow-crm-raised transition-[left,width] duration-200 ease-crm"
          style={{ left: thumb.left, width: thumb.width }}
        />
      ) : null}
      {options.map((o) => {
        const on = o.value === current;
        return (
          <button
            key={o.value}
            ref={(el) => {
              if (el) itemRefs.current.set(o.value, el);
              else itemRefs.current.delete(o.value);
            }}
            type="button"
            role="radio"
            aria-checked={on}
            data-state={on ? "on" : "off"}
            tabIndex={o.value === tabbable ? 0 : -1}
            disabled={o.disabled}
            onClick={() => select(o.value)}
            className={cn(
              "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full text-xs font-medium whitespace-nowrap outline-none select-none",
              "transition-colors duration-150 ease-crm focus-visible:ring-2 focus-visible:ring-crm-ring/60",
              "disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0",
              size === "sm" ? "h-6 px-2.5" : "h-7 px-3",
              fullWidth && "flex-1",
              on ? "text-crm-fg" : "text-crm-muted-fg hover:text-crm-fg",
            )}
          >
            {o.icon}
            {o.label}
            {o.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full bg-crm-raised px-1.5 text-[10px] leading-4 tabular-nums",
                  on ? "text-crm-chip" : "text-crm-subtle",
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
