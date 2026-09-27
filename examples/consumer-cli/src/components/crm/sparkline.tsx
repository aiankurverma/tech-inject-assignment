import { cn } from "@/lib/utils";

export interface SparklineProps {
  /** Bar heights; any scale, normalised to the tallest bar. */
  data: number[];
  /** Bars below this share of the max use the muted colour. */
  mutedBelow?: number;
  height?: number;
  label?: string;
  className?: string;
}

/** Mini bar chart for activity trends. */
export function Sparkline({ data, mutedBelow = 0.35, height = 14, label = "Activity trend", className }: SparklineProps) {
  const max = Math.max(1, ...data);
  return (
    <span role="img" aria-label={`${label}: ${data.join(", ")}`} className={cn("inline-flex items-end gap-[2px]", className)} style={{ height }}>
      {data.map((v, i) => {
        const ratio = v / max;
        return (
          <span
            key={i}
            className={cn("w-[3px] rounded-[1px]", ratio < mutedBelow ? "bg-crm-trend-muted" : "bg-crm-trend")}
            style={{ height: `${Math.max(12, ratio * 100)}%` }}
          />
        );
      })}
    </span>
  );
}

export interface TrendStatProps {
  value: string | number;
  data: number[];
  caption?: string;
  className?: string;
}

/** Big number with an inline sparkline and caption. */
export function TrendStat({ value, data, caption, className }: TrendStatProps) {
  return (
    <div className={cn("font-crm", className)}>
      <div className="flex items-end gap-1.5">
        <span className="text-[26px] leading-none font-medium text-crm-fg">{value}</span>
        <Sparkline data={data} height={16} />
      </div>
      {caption ? <p className="mt-1.5 text-xs text-crm-soft">{caption}</p> : null}
    </div>
  );
}
