import * as React from "react";
import { format } from "date-fns";
import { Bar, BarChart, Brush, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { HistogramBucket } from "@/hooks/use-log-index";

export interface LogHistogramProps {
  data: HistogramBucket[];
  /** Selected bucket index range, or null for everything. */
  brush: [number, number] | null;
  onBrush: (range: [number, number] | null) => void;
  height?: number;
}

const SERIES = [
  { key: "debug", color: "#454545", name: "Debug/trace" },
  { key: "info", color: "#3b82f6", name: "Info" },
  { key: "warn", color: "#fbbf24", name: "Warn" },
  { key: "error", color: "#f97373", name: "Error/fatal" },
] as const;

/** Stacked volume histogram; drag the brush handles to narrow the time window. */
export const LogHistogram = React.memo(function LogHistogram({
  data,
  brush,
  onBrush,
  height = 96,
}: LogHistogramProps) {
  const tickFmt = React.useMemo(() => {
    const span = data.length ? data[data.length - 1]!.end - data[0]!.start : 0;
    return span > 36 * 3_600_000 ? "d MMM HH:mm" : "HH:mm:ss";
  }, [data]);
  const total = data.reduce((s, b) => s + b.error + b.warn + b.info + b.debug, 0);

  return (
    <figure
      aria-label={`Log volume over time, ${total.toLocaleString()} lines`}
      className="px-2 pt-2"
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 8, bottom: 0, left: 8 }} barCategoryGap={1}>
          <XAxis
            dataKey="start"
            tickFormatter={(v: number) => format(v, tickFmt)}
            tick={{ fill: "#7f7f7f", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#1e1e1e",
              border: "1px solid #232323",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => format(Number(v), "PPpp")}
          />
          {SERIES.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="v"
              fill={s.color}
              isAnimationActive={false}
            />
          ))}
          <Brush
            dataKey="start"
            height={16}
            travellerWidth={8}
            stroke="#676767"
            fill="#161616"
            tickFormatter={(v: number) => format(v, "HH:mm")}
            startIndex={brush?.[0] ?? 0}
            endIndex={brush?.[1] ?? Math.max(0, data.length - 1)}
            onChange={(r: { startIndex?: number; endIndex?: number }) => {
              if (r.startIndex == null || r.endIndex == null) return;
              if (r.startIndex === 0 && r.endIndex === data.length - 1) onBrush(null);
              else onBrush([r.startIndex, r.endIndex]);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
});
