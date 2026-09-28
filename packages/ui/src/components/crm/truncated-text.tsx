import * as React from "react";
import { cn } from "@/lib/utils";

export interface TruncatedTextProps {
  children: React.ReactNode;
  /** Number of visible lines when collapsed. */
  lines?: number;
  /** Controlled expanded state. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  moreLabel?: string;
  lessLabel?: string;
  className?: string;
}

/**
 * Clamps text to a number of lines and shows a "Show more" toggle only when the text actually
 * overflows. The toggle is a real button wired with aria-expanded/aria-controls.
 */
export function TruncatedText({
  children,
  lines = 3,
  expanded,
  onExpandedChange,
  moreLabel = "Show more",
  lessLabel = "Show less",
  className,
}: TruncatedTextProps) {
  const [inner, setInner] = React.useState(false);
  const open = expanded ?? inner;
  const [overflows, setOverflows] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const id = React.useId();

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (!open) setOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, lines, children]);

  const toggle = () => {
    if (expanded === undefined) setInner(!open);
    onExpandedChange?.(!open);
  };

  return (
    <div className={cn("font-crm text-sm leading-5 text-crm-chip", className)}>
      <div
        id={id}
        ref={ref}
        className="overflow-hidden break-words"
        style={
          open
            ? undefined
            : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines }
        }
      >
        {children}
      </div>
      {overflows || open ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={toggle}
          className="mt-1 cursor-pointer rounded text-xs font-medium text-crm-soft outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          {open ? lessLabel : moreLabel}
        </button>
      ) : null}
    </div>
  );
}
