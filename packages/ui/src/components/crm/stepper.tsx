import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  title: string;
  description?: string;
}

export interface StepperProps {
  steps: Step[];
  /** 0-based index of the active step. Steps before it are complete. */
  current: number;
  orientation?: "horizontal" | "vertical";
  /** Make completed steps clickable to go back. */
  onStepClick?: (index: number) => void;
  className?: string;
}

/** Numbered progress through a multi-step flow (onboarding, deal wizard, import). */
export function Stepper({
  steps,
  current,
  orientation = "horizontal",
  onStepClick,
  className,
}: StepperProps) {
  const vertical = orientation === "vertical";
  return (
    <ol
      aria-label="Progress"
      className={cn("flex font-crm", vertical ? "flex-col" : "items-start", className)}
    >
      {steps.map((s, i) => {
        const state = i < current ? "complete" : i === current ? "current" : "upcoming";
        const clickable = !!onStepClick && state === "complete";
        const marker = (
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium tabular-nums transition-colors duration-150",
              state === "complete" && "bg-crm-primary text-crm-primary-fg shadow-crm-primary",
              state === "current" && "bg-crm-raised text-crm-fg ring-2 ring-crm-primary",
              state === "upcoming" && "bg-crm-muted text-crm-subtle",
            )}
          >
            {state === "complete" ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
          </span>
        );
        const text = (
          <span className="flex flex-col gap-1 text-left">
            <span
              className={cn(
                "text-sm",
                state === "upcoming" ? "text-crm-subtle" : "font-medium text-crm-fg",
              )}
            >
              {s.title}
            </span>
            {s.description ? <span className="text-xs text-crm-soft">{s.description}</span> : null}
          </span>
        );
        const last = i === steps.length - 1;
        return (
          <li
            key={s.title}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "relative flex",
              vertical ? "gap-3 pb-6 last:pb-0" : "flex-1 flex-col gap-2",
            )}
          >
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute",
                  vertical ? "top-7 bottom-1 left-3 w-px" : "top-3 right-2 left-8 h-px",
                  i < current ? "bg-crm-primary" : "bg-crm-border",
                )}
              />
            ) : null}
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick(i)}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                  !vertical && "flex-col gap-2",
                )}
              >
                {marker}
                {text}
              </button>
            ) : (
              <>
                {marker}
                {text}
              </>
            )}
            <span className="sr-only">
              {state === "complete" ? "(completed)" : state === "current" ? "(current)" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
