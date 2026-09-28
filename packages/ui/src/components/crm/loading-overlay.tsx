import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/crm/spinner";

export interface LoadingOverlayProps {
  loading: boolean;
  children: React.ReactNode;
  /** Short status, e.g. "Recalculating forecast…". */
  label?: string;
  /** 0–100 determinate progress; omit for indeterminate. */
  progress?: number;
  /** Wait this long before showing, so fast requests never flash (ms). */
  delay?: number;
  /** Once shown, stay visible at least this long to avoid flicker (ms). */
  minDuration?: number;
  /** Blur the content underneath. */
  blur?: boolean;
  /** Renders a Cancel control while loading. */
  onCancel?: () => void;
  className?: string;
}

/**
 * Blocks a region (table, card, form) while work is in flight. Content stays mounted but is made
 * inert and aria-busy, with delayed show / minimum duration to avoid flicker.
 */
export function LoadingOverlay({
  loading,
  children,
  label = "Loading",
  progress,
  delay = 150,
  minDuration = 400,
  blur = true,
  onCancel,
  className,
}: LoadingOverlayProps) {
  const [visible, setVisible] = React.useState(false);
  const shownAt = React.useRef(0);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let t: number | undefined;
    if (loading) {
      t = window.setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delay);
    } else if (visible) {
      const remaining = Math.max(0, minDuration - (Date.now() - shownAt.current));
      t = window.setTimeout(() => setVisible(false), remaining);
    }
    return () => window.clearTimeout(t);
  }, [loading, delay, minDuration, visible]);

  // `inert` keeps keyboard and pointer out of the blocked content; move focus out if it was inside.
  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (visible) {
      el.setAttribute("inert", "");
      if (el.contains(document.activeElement)) overlayRef.current?.focus();
    } else el.removeAttribute("inert");
  }, [visible]);

  const pct = progress == null ? null : Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className={cn("relative isolate", className)} aria-busy={loading || undefined}>
      <div
        ref={contentRef}
        className={cn(
          "transition-[filter,opacity] duration-200",
          visible && "opacity-60 select-none",
          visible && blur && "blur-[1.5px]",
        )}
      >
        {children}
      </div>
      {visible && (
        <div
          ref={overlayRef}
          tabIndex={-1}
          className="absolute inset-0 z-10 grid place-items-center rounded-[inherit] bg-crm-surface/55 p-4 outline-none"
        >
          <div
            role="status"
            aria-live="polite"
            className="flex max-w-xs min-w-44 flex-col items-center gap-2 rounded-crm border border-crm-border bg-crm-raised px-4 py-3 text-center font-crm shadow-crm-raised"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-crm-fg">
              <Spinner size="sm" tone="primary" label="" />
              <span>{label}</span>
              {pct != null && <span className="text-crm-subtle tabular-nums">{pct}%</span>}
            </div>
            {pct != null && (
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label={label}
                className="h-1 w-full overflow-hidden rounded-full bg-crm-muted"
              >
                <div
                  className="h-full rounded-full bg-crm-primary transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary [&_svg]:size-3"
              >
                <X /> Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
