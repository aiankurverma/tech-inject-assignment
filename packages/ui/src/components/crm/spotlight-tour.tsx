import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";

export interface SpotlightStep {
  id: string;
  /** CSS selector of the element to highlight. Missing targets fall back to a centred card. */
  target?: string;
  title: string;
  body: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
  /** Extra pixels around the highlighted element. */
  padding?: number;
}

export interface SpotlightTourProps {
  steps: SpotlightStep[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step?: number;
  defaultStep?: number;
  onStepChange?: (index: number, step: SpotlightStep) => void;
  /** Fired when the user completes the last step (not when skipping). */
  onComplete?: () => void;
  /** Fired with the index the user skipped at; useful for tour analytics. */
  onSkip?: (index: number) => void;
  /** Let clicks pass through to the highlighted element. */
  interactive?: boolean;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_W = 320;
const GAP = 12;

function place(rect: Rect | null, placement: SpotlightStep["placement"], cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - 32);
  if (!rect) return { top: vh / 2 - cardH / 2, left: vw / 2 - w / 2, width: w };
  const order: NonNullable<SpotlightStep["placement"]>[] = [
    placement ?? "bottom",
    "bottom",
    "top",
    "right",
    "left",
  ];
  for (const p of order) {
    let top = 0;
    let left = 0;
    if (p === "bottom") {
      top = rect.top + rect.height + GAP;
      left = rect.left + rect.width / 2 - w / 2;
    } else if (p === "top") {
      top = rect.top - cardH - GAP;
      left = rect.left + rect.width / 2 - w / 2;
    } else if (p === "right") {
      top = rect.top + rect.height / 2 - cardH / 2;
      left = rect.left + rect.width + GAP;
    } else {
      top = rect.top + rect.height / 2 - cardH / 2;
      left = rect.left - w - GAP;
    }
    const fits = top >= 8 && top + cardH <= vh - 8 && left >= 8 && left + w <= vw - 8;
    if (fits || p === order[order.length - 1]) {
      return {
        top: Math.min(Math.max(8, top), vh - cardH - 8),
        left: Math.min(Math.max(8, left), vw - w - 8),
        width: w,
      };
    }
  }
  return { top: 8, left: 8, width: w };
}

/**
 * Onboarding coachmarks. Dims the page with a cut-out around each step's target, scrolls it
 * into view, follows resize/scroll, and positions the card on the side with room. Keyboard:
 * ←/→ to move, Esc to skip. Focus moves into the card and is restored when the tour ends.
 */
export function SpotlightTour({
  steps,
  open,
  onOpenChange,
  step,
  defaultStep = 0,
  onStepChange,
  onComplete,
  onSkip,
  interactive = false,
}: SpotlightTourProps) {
  const [inner, setInner] = React.useState(defaultStep);
  const index = Math.min(step ?? inner, Math.max(0, steps.length - 1));
  const current = steps[index];
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [cardH, setCardH] = React.useState(180);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();

  const go = React.useCallback(
    (n: number) => {
      const s = steps[n];
      if (!s) return;
      if (step === undefined) setInner(n);
      onStepChange?.(n, s);
    },
    [steps, step, onStepChange],
  );

  const close = React.useCallback(
    (completed: boolean) => {
      if (completed) onComplete?.();
      else onSkip?.(index);
      onOpenChange(false);
    },
    [index, onComplete, onSkip, onOpenChange],
  );

  React.useEffect(() => {
    if (open) restoreRef.current = document.activeElement as HTMLElement | null;
    else restoreRef.current?.focus?.();
  }, [open]);

  React.useLayoutEffect(() => {
    if (!open || !current) return;
    const el = current.target ? document.querySelector<HTMLElement>(current.target) : null;
    const pad = current.padding ?? 6;
    const measure = () => {
      if (!el) return setRect(null);
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - pad,
        left: r.left - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      });
    };
    el?.scrollIntoView({ block: "center", behavior: "auto" });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const ro = el ? new ResizeObserver(measure) : null;
    if (el) ro?.observe(el);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      ro?.disconnect();
    };
  }, [open, current]);

  React.useLayoutEffect(() => {
    if (!open) return;
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
    cardRef.current?.focus();
  }, [open, index]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      else if (e.key === "ArrowRight") {
        if (index < steps.length - 1) go(index + 1);
        else close(true);
      } else if (e.key === "ArrowLeft" && index > 0) go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, steps.length, go, close]);

  if (!open || !current || typeof window === "undefined") return null;
  const pos = place(rect, current.placement, cardH);
  const last = index === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[60] font-crm" aria-live="polite">
      {/* Dim layer with a hole: a huge box-shadow around the highlight box. */}
      {rect ? (
        <div
          aria-hidden
          className={cn(
            "fixed rounded-crm ring-2 ring-crm-primary transition-all duration-200 ease-crm",
            !interactive && "pointer-events-none",
          )}
          style={{ ...rect, boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/60" />
      )}
      {/* Click blocker outside the hole. */}
      {!interactive || !rect ? (
        <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />
      ) : null}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fixed flex flex-col gap-3 rounded-xl border border-crm-border bg-crm-sidebar p-4 text-crm-fg shadow-crm-overlay outline-none transition-[top,left] duration-200 ease-crm data-[state=open]:animate-crm-in"
        style={{ top: pos.top, left: pos.left, width: pos.width }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="crm-eyebrow text-[11px] text-crm-subtle">
              Step {index + 1} of {steps.length}
            </span>
            <h2 id={titleId} className="text-sm font-semibold">
              {current.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Skip tour"
            onClick={() => close(false)}
            className="rounded-full p-1 text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="text-[13px] leading-5 text-crm-soft">{current.body}</div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1" aria-hidden>
            {steps.map((s, n) => (
              <span
                key={s.id}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  n === index ? "w-4 bg-crm-primary" : "w-1.5 bg-crm-track",
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => go(index - 1)}>
                Back
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => close(false)}>
                Skip
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              onClick={() => (last ? close(true) : go(index + 1))}
            >
              {last ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
