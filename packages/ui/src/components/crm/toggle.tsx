import * as React from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: {
    off: "bg-transparent text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg",
    on: "bg-crm-muted text-crm-fg shadow-crm-raised",
  },
  outline: {
    off: "border border-crm-border bg-transparent text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg",
    on: "border border-crm-primary/60 bg-crm-primary/15 text-crm-fg",
  },
  primary: {
    off: "bg-crm-raised text-crm-fg shadow-crm-raised hover:bg-crm-muted",
    on: "bg-crm-primary text-crm-primary-fg shadow-crm-primary",
  },
} as const;

const sizes = {
  sm: "h-7 min-w-7 px-2 text-xs gap-1",
  md: "h-[30px] min-w-[30px] px-2.5 text-xs gap-1.5",
  lg: "h-9 min-w-9 px-3 text-sm gap-2",
} as const;

export interface ToggleProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "value" | "children"
> {
  pressed?: boolean;
  defaultPressed?: boolean;
  /**
   * Called with the next state. Return a promise to make the toggle optimistic: it flips
   * immediately, shows a busy state and rolls back if the promise rejects.
   */
  onPressedChange?: (pressed: boolean) => void | Promise<unknown>;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  /** Icon shown before the label; `pressedIcon` swaps it when on (e.g. Star vs filled star). */
  icon?: React.ReactNode;
  pressedIcon?: React.ReactNode;
  /** Label content. Pass `pressedChildren` to change text when on ("Follow" / "Following"). */
  children?: React.ReactNode;
  pressedChildren?: React.ReactNode;
  /** Numeric counter shown after the label (e.g. followers). Adjusts by ±1 as the state flips. */
  count?: number;
  /** Called when an async onPressedChange rejects (after rollback). */
  onError?: (error: unknown) => void;
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Two-state button (aria-pressed) for things like Follow, Star, Pin or Mute. Supports controlled /
 * uncontrolled use, per-state icon and label, a live counter, and optimistic async updates with
 * rollback on failure.
 */
export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  {
    pressed,
    defaultPressed = false,
    onPressedChange,
    variant = "default",
    size = "md",
    icon,
    pressedIcon,
    children,
    pressedChildren,
    count,
    onError,
    disabled,
    className,
    onClick,
    ...props
  },
  ref,
) {
  const [inner, setInner] = React.useState(defaultPressed);
  const [optimistic, setOptimistic] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);
  const base = pressed ?? inner;
  const on = optimistic ?? base;
  const initial = React.useRef(base);

  // Controlled: the parent owns `count` for the committed state, so only offset the optimistic flip.
  // Uncontrolled: `count` is static, so offset relative to the initial state.
  const reference = pressed !== undefined ? base : initial.current;
  const shownCount =
    count === undefined ? undefined : Math.max(0, count + (on === reference ? 0 : on ? 1 : -1));

  const handle = async (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || disabled || busy) return;
    const next = !on;
    const result = onPressedChange?.(next);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setOptimistic(next);
      setBusy(true);
      try {
        await result;
        if (pressed === undefined) setInner(next);
      } catch (err) {
        onError?.(err);
      } finally {
        setOptimistic(null);
        setBusy(false);
      }
      return;
    }
    if (pressed === undefined) setInner(next);
  };

  const label = on && pressedChildren !== undefined ? pressedChildren : children;
  const glyph = on && pressedIcon ? pressedIcon : icon;
  const tone = variants[variant];

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={on}
      aria-busy={busy || undefined}
      disabled={disabled}
      data-state={on ? "on" : "off"}
      onClick={handle}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full font-crm font-medium whitespace-nowrap select-none",
        "outline-none transition-[background-color,color,box-shadow,border-color] duration-150 ease-crm",
        "focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed disabled:opacity-50",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        on ? tone.on : tone.off,
        sizes[size],
        busy && "cursor-progress",
        className,
      )}
      {...props}
    >
      {glyph ? (
        <span aria-hidden className="inline-flex">
          {glyph}
        </span>
      ) : null}
      {label}
      {shownCount !== undefined ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[10px] tabular-nums",
            on && variant === "primary" ? "bg-white/20" : "bg-crm-muted text-crm-soft",
          )}
          aria-label={`${shownCount.toLocaleString("en-US")}`}
        >
          {compact.format(shownCount)}
        </span>
      ) : null}
    </button>
  );
});
