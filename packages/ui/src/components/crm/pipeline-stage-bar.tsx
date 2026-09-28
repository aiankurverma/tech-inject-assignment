import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PipelineStage {
  id: string;
  label: string;
}

export interface PipelineStageBarProps {
  stages: PipelineStage[];
  /** id of the stage the deal is in. */
  current: string;
  /** Closed outcome overrides the colours of the final state. */
  outcome?: "won" | "lost";
  /** Makes stages clickable to move the deal. */
  onStageChange?: (id: string) => void;
  className?: string;
}

/**
 * Chevron bar showing where a deal sits in the pipeline (Lead → Qualified → Proposal → …).
 * With onStageChange it is a keyboard-operable list of buttons.
 */
export function PipelineStageBar({
  stages,
  current,
  outcome,
  onStageChange,
  className,
}: PipelineStageBarProps) {
  const idx = Math.max(
    0,
    stages.findIndex((s) => s.id === current),
  );
  return (
    <ol aria-label="Pipeline stage" className={cn("flex w-full font-crm", className)}>
      {stages.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        const first = i === 0;
        const last = i === stages.length - 1;
        const tone =
          active && outcome === "lost"
            ? "bg-crm-danger/20 text-crm-danger"
            : active && outcome === "won"
              ? "bg-crm-success/20 text-crm-success"
              : active
                ? "bg-crm-primary text-crm-primary-fg"
                : done
                  ? "bg-crm-primary/25 text-crm-fg"
                  : "bg-crm-muted text-crm-subtle";
        const clip = cn(
          first ? "" : "-ml-1.5",
          "[clip-path:polygon(0_0,calc(100%-8px)_0,100%_50%,calc(100%-8px)_100%,0_100%,8px_50%)]",
          first &&
            "[clip-path:polygon(0_0,calc(100%-8px)_0,100%_50%,calc(100%-8px)_100%,0_100%)] rounded-l-full",
          last &&
            !first &&
            "[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,8px_50%)] rounded-r-full",
        );
        const inner = (
          <>
            {done ? <Check className="size-3 shrink-0" strokeWidth={3} aria-hidden /> : null}
            <span className="truncate">{s.label}</span>
          </>
        );
        const cls = cn(
          "flex h-8 w-full items-center justify-center gap-1 pr-3 pl-4 text-xs font-medium transition-colors duration-150 ease-crm",
          tone,
          clip,
        );
        return (
          <li key={s.id} className="min-w-0 flex-1" aria-current={active ? "step" : undefined}>
            {onStageChange ? (
              <button
                type="button"
                onClick={() => onStageChange(s.id)}
                className={cn(
                  cls,
                  "cursor-pointer outline-none hover:brightness-125 focus-visible:brightness-150 focus-visible:underline",
                )}
              >
                {inner}
              </button>
            ) : (
              <span className={cls}>{inner}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
