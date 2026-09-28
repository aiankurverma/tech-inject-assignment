import * as React from "react";
import { cn } from "@/lib/utils";

const sides = {
  top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2",
  left: "right-full top-1/2 mr-1.5 -translate-y-1/2",
  right: "left-full top-1/2 ml-1.5 -translate-y-1/2",
} as const;

export interface TooltipProps {
  content: React.ReactNode;
  side?: keyof typeof sides;
  /** Hover delay in ms before showing. */
  delay?: number;
  /** A single focusable element (button, link, input). */
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  className?: string;
}

/**
 * Lightweight tooltip with no extra dependency. Shows on hover (after `delay`) and on keyboard
 * focus, hides on Escape, and links itself to the trigger with aria-describedby.
 */
export function Tooltip({ content, side = "top", delay = 300, children, className }: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = React.useId();
  const show = (wait: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), wait);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };
  React.useEffect(() => () => clearTimeout(timer.current), []);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const p = children.props;
  const trigger = React.cloneElement(children, {
    "aria-describedby": open ? id : p["aria-describedby"],
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      p.onMouseEnter?.(e);
      show(delay);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      p.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      p.onFocus?.(e);
      show(0);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      p.onBlur?.(e);
      hide();
    },
  });
  return (
    <span className="relative inline-flex">
      {trigger}
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 w-max max-w-[240px] rounded-lg border border-crm-border bg-crm-popover px-2 py-1.5",
            "animate-crm-in font-crm text-xs leading-4 text-crm-fg shadow-crm-overlay",
            sides[side],
            className,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
