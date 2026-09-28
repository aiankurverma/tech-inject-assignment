import * as React from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Progress } from "@/components/crm/progress";
import { Stepper } from "@/components/crm/stepper";

export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  /** Optional steps can be skipped; required steps must validate. */
  optional?: boolean;
  content: React.ReactNode;
  /** Return an error message to block "Continue", or null when the step is valid. */
  validate?: () => string | null;
  /** Estimated minutes, summed into "about N min left". */
  minutes?: number;
}

export interface ShellOnboardingProps {
  steps: OnboardingStep[];
  /** Controlled active step index. */
  current?: number;
  defaultCurrent?: number;
  onStepChange?: (index: number) => void;
  /** Called after the last step validates. May return a promise; the button shows loading. */
  onComplete?: () => void | Promise<void>;
  /** Shows a close button; called when the user leaves setup early. */
  onExit?: () => void;
  brand?: React.ReactNode;
  title?: string;
  className?: string;
}

/** Full-page onboarding layout: step rail, validated step content, progress and time remaining. */
export function ShellOnboarding({
  steps,
  current,
  defaultCurrent = 0,
  onStepChange,
  onComplete,
  onExit,
  brand,
  title = "Set up your workspace",
  className,
}: ShellOnboardingProps) {
  const [inner, setInner] = React.useState(defaultCurrent);
  const [skipped, setSkipped] = React.useState<Set<string>>(() => new Set());
  const [error, setError] = React.useState<string | null>(null);
  const [finishing, setFinishing] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const index = Math.min(Math.max(current ?? inner, 0), Math.max(steps.length - 1, 0));
  const step = steps[index];
  const last = index === steps.length - 1;

  const go = (i: number) => {
    setError(null);
    if (current === undefined) setInner(i);
    onStepChange?.(i);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const next = async (skip = false) => {
    if (!step) return;
    if (!skip) {
      const msg = step.validate?.() ?? null;
      if (msg) {
        setError(msg);
        return;
      }
    }
    setSkipped((s) => {
      const n = new Set(s);
      if (skip) n.add(step.id);
      else n.delete(step.id);
      return n;
    });
    if (!last) return go(index + 1);
    try {
      setFinishing(true);
      await onComplete?.();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish setup. Try again.");
    } finally {
      setFinishing(false);
    }
  };

  const minutesLeft = steps.slice(index).reduce((sum, s) => sum + (s.minutes ?? 0), 0);
  const pct = done ? 100 : Math.round((index / Math.max(steps.length, 1)) * 100);

  if (!step) {
    return (
      <div className={cn("grid place-items-center p-10 font-crm text-sm text-crm-soft", className)}>
        No setup steps configured.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-[560px] flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg font-crm text-crm-fg md:flex-row",
        className,
      )}
    >
      <aside className="flex shrink-0 flex-col gap-5 border-b border-crm-border bg-crm-card p-5 md:w-72 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">{brand}</div>
          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              aria-label="Exit setup"
              className="grid size-7 place-items-center rounded-md text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <p className="crm-eyebrow">{title}</p>
          <Progress value={pct} size="sm" label="Setup progress" />
          <p className="text-xs text-crm-soft tabular-nums">
            {done
              ? "All done"
              : `Step ${index + 1} of ${steps.length}${minutesLeft ? ` · about ${minutesLeft} min left` : ""}`}
          </p>
        </div>
        <Stepper
          className="hidden md:flex"
          orientation="vertical"
          current={done ? steps.length : index}
          onStepClick={done ? undefined : (i: number) => (i <= index ? go(i) : undefined)}
          steps={steps.map((s) => ({
            title: s.title,
            description: skipped.has(s.id) ? "Skipped" : s.optional ? "Optional" : s.description,
          }))}
        />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {done ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-crm-success/15 text-crm-success">
              <Check className="size-5" />
            </span>
            <h2 className="text-lg font-semibold">You are all set</h2>
            <p className="max-w-sm text-sm text-crm-soft">
              {skipped.size
                ? `${skipped.size} optional step${skipped.size > 1 ? "s were" : " was"} skipped. You can finish ${skipped.size > 1 ? "them" : "it"} later from Settings.`
                : "Every step is complete. Your workspace is ready."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6 md:p-8">
              <div className="flex flex-col gap-1">
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-lg font-semibold tracking-tight outline-none"
                >
                  {step.title}
                </h2>
                {step.description ? (
                  <p className="text-sm text-crm-soft">{step.description}</p>
                ) : null}
              </div>
              <div>{step.content}</div>
              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-tag-red-border bg-tag-red-bg px-3 py-2 text-xs text-tag-red-text"
                >
                  {error}
                </p>
              ) : null}
            </div>
            <footer className="flex items-center justify-between gap-2 border-t border-crm-border bg-crm-card px-6 py-3">
              <Button variant="ghost" onClick={() => go(index - 1)} disabled={index === 0}>
                <ArrowLeft className="size-3.5" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                {step.optional ? (
                  <Button variant="secondary" onClick={() => void next(true)} disabled={finishing}>
                    Skip
                  </Button>
                ) : null}
                <Button onClick={() => void next(false)} loading={finishing}>
                  {last ? "Finish setup" : "Continue"}
                  {!last ? <ArrowRight className="size-3.5" /> : null}
                </Button>
              </div>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
