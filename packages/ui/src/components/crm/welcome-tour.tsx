import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";

export interface TourStep {
  /** CSS selector of the element to highlight. Missing targets fall back to a centred card. */
  target?: string;
  title: string;
  body: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
}

export interface WelcomeTourProps {
  steps: TourStep[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired when the last step is finished (not when skipped). */
  onComplete?: () => void;
  /** Fired on every step change, e.g. for analytics. */
  onStepChange?: (index: number) => void;
  initialStep?: number;
  /** Padding around the highlighted element, px. */
  padding?: number;
  className?: string;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_W = 320;
const GAP = 12;

function place(box: Box | null, placement: TourStep["placement"], cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - 32);
  if (!box) return { top: Math.max(16, (vh - cardH) / 2), left: (vw - w) / 2, width: w };
  let p = placement ?? "bottom";
  if (p === "bottom" && box.top + box.height + GAP + cardH > vh) p = "top";
  if (p === "top" && box.top - GAP - cardH < 0) p = "bottom";
  if (p === "right" && box.left + box.width + GAP + w > vw) p = "bottom";
  if (p === "left" && box.left - GAP - w < 0) p = "bottom";
  let top = 0;
  let left = 0;
  if (p === "bottom" || p === "top") {
    top = p === "bottom" ? box.top + box.height + GAP : box.top - GAP - cardH;
    left = box.left + box.width / 2 - w / 2;
  } else {
    top = box.top + box.height / 2 - cardH / 2;
    left = p === "right" ? box.left + box.width + GAP : box.left - GAP - w;
  }
  const clamp = (v: number, max: number) => Math.min(Math.max(16, v), Math.max(16, max));
  return { top: clamp(top, vh - cardH - 16), left: clamp(left, vw - w - 16), width: w };
}

/** Product tour that spotlights real UI elements by selector, repositions on scroll/resize, supports arrow/Esc keys and falls back to a centred card. */
export function WelcomeTour({
  steps,
  open,
  onOpenChange,
  onComplete,
  onStepChange,
  initialStep = 0,
  padding = 6,
  className,
}: WelcomeTourProps) {
  const [index, setIndex] = React.useState(initialStep);
  const [box, setBox] = React.useState<Box | null>(null);
  const [cardH, setCardH] = React.useState(180);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const step = steps[index];
  const last = index === steps.length - 1;

  React.useEffect(() => {
    if (open) setIndex(Math.min(initialStep, Math.max(0, steps.length - 1)));
  }, [open, initialStep, steps.length]);

  const measure = React.useCallback(() => {
    const el = step?.target ? document.querySelector(step.target) : null;
    if (!el) return setBox(null);
    const r = el.getBoundingClientRect();
    setBox({
      top: r.top - padding,
      left: r.left - padding,
      width: r.width + padding * 2,
      height: r.height + padding * 2,
    });
  }, [step, padding]);

  React.useLayoutEffect(() => {
    if (!open || !step) return;
    const el = step.target ? document.querySelector(step.target) : null;
    if (el) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: reduce ? "auto" : "smooth",
      });
    }
    measure();
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
    cardRef.current?.focus();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, measure]);

  if (!open || !step) return null;

  const go = (i: number) => {
    setIndex(i);
    onStepChange?.(i);
  };
  const close = () => onOpenChange(false);
  const next = () => {
    if (last) {
      onComplete?.();
      close();
    } else go(index + 1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === "Tab") {
      const nodes = cardRef.current?.querySelectorAll<HTMLElement>("button");
      if (!nodes?.length) return;
      const first = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        lastNode?.focus();
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  const pos = place(box, step.placement, cardH);

  return (
    <div className="fixed inset-0 z-50 font-crm" onKeyDown={onKeyDown}>
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-crm ring-2 ring-crm-primary transition-all duration-200 ease-crm motion-reduce:transition-none"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/60" />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "fixed flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-popover p-4 text-crm-fg shadow-crm-raised outline-none",
          "transition-[top,left] duration-200 ease-crm motion-reduce:transition-none",
          className,
        )}
        style={{ top: pos.top, left: pos.left, width: pos.width }}
      >
        <div className="flex items-start gap-2">
          <h2 id={titleId} className="flex-1 text-sm font-medium">
            {step.title}
          </h2>
          <button
            type="button"
            aria-label="Close tour"
            onClick={close}
            className="grid size-6 cursor-pointer place-items-center rounded-md text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="text-xs leading-5 text-crm-muted-fg">{step.body}</div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={`${s.title}-${i}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-4 bg-crm-primary" : "w-1.5 bg-crm-muted",
                )}
              />
            ))}
          </div>
          <span className="sr-only" aria-live="polite">
            Step {index + 1} of {steps.length}
          </span>
          {index === 0 ? (
            <Button size="sm" variant="ghost" onClick={close}>
              Skip tour
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => go(index - 1)}>
              Back
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={next}>
            {last ? "Done" : `Next · ${index + 1}/${steps.length}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
