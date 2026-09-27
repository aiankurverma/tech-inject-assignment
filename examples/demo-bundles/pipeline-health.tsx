import { cn } from "@/lib/utils";

export interface StageHealth {
  label: string;
  /** 0-100 */
  value: number;
  tone: "danger" | "warning" | "success";
}

export interface PipelineHealthProps {
  /** Overall win probability, 0-100. */
  probability: number;
  caption?: string;
  stages: StageHealth[];
  segments?: number;
  className?: string;
}

const toneClass = {
  danger: "bg-crm-danger",
  warning: "bg-crm-warning",
  success: "bg-crm-success",
} as const;

/** Company "Pipeline health" panel: big win probability plus one segmented bar per stage. */
export function PipelineHealth({
  probability,
  caption = "Win probability across all open deals",
  stages,
  segments = 60,
  className,
}: PipelineHealthProps) {
  return (
    <section
      className={cn("flex flex-col gap-4 font-crm text-crm-fg", className)}
      aria-label="Pipeline health"
    >
      <h3 className="crm-eyebrow font-medium">Pipeline health</h3>
      <div>
        <p className="text-[28px] leading-none font-semibold tabular-nums">{probability}%</p>
        <p className="mt-1.5 text-xs text-crm-soft">{caption}</p>
      </div>
      {stages.map((s) => {
        const filled = Math.round((Math.max(0, Math.min(100, s.value)) / 100) * segments);
        return (
          <div key={s.label} className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span>{s.label}</span>
              <span className="tabular-nums">{s.value}%</span>
            </div>
            <div
              role="meter"
              aria-label={s.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={s.value}
              className="flex gap-[3px]"
            >
              {Array.from({ length: segments }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2 min-w-1 flex-1 rounded-[1px]",
                    i < filled ? toneClass[s.tone] : "bg-crm-track",
                  )}
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
