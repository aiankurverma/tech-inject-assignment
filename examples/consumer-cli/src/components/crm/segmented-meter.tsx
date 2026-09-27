import { cn } from "@/lib/utils";

export interface SegmentedMeterProps {
  /** 0-100 */
  value: number;
  /** Number of segments in the bar. */
  segments?: number;
  /** "scale" colours segments red -> amber -> green by position; a fixed colour paints all filled segments. */
  tone?: "scale" | "danger" | "warning" | "success";
  size?: "sm" | "md";
  showValue?: boolean;
  label?: string;
  className?: string;
}

const fixed = { danger: "bg-crm-danger", warning: "bg-crm-warning", success: "bg-crm-success" } as const;

function scaleColor(index: number, total: number) {
  const pos = index / total;
  if (pos < 0.3) return "bg-crm-danger";
  if (pos < 0.6) return "bg-crm-warning";
  return "bg-crm-success";
}

/** Win-probability style bar made of small segments. */
export function SegmentedMeter({ value, segments = 18, tone = "scale", size = "sm", showValue, label, className }: SegmentedMeterProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const filled = Math.round((clamped / 100) * segments);
  return (
    <span className={cn("inline-flex items-center gap-2 font-crm", className)}>
      <span
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={label ?? "Progress"}
        className={cn("flex flex-1 items-center", size === "sm" ? "gap-[2px]" : "gap-[3px]")}
      >
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 rounded-[1px]",
              size === "sm" ? "h-3 min-w-[2px] max-w-[2px]" : "h-2 min-w-1",
              i < filled ? (tone === "scale" ? scaleColor(i, segments) : fixed[tone]) : "bg-crm-track",
            )}
          />
        ))}
      </span>
      {showValue ? <span className="w-9 text-right text-sm text-crm-fg tabular-nums">{clamped}%</span> : null}
    </span>
  );
}

export interface ProgressRowProps {
  label: string;
  value: number;
  tone?: SegmentedMeterProps["tone"];
  className?: string;
}

/** Label and percentage above a wide segmented bar (pipeline stages). */
export function ProgressRow({ label, value, tone = "success", className }: ProgressRowProps) {
  return (
    <div className={cn("flex flex-col gap-2 font-crm", className)}>
      <div className="flex items-center justify-between text-xs text-crm-fg">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <SegmentedMeter value={value} tone={tone} segments={60} size="md" label={label} className="w-full" />
    </div>
  );
}
