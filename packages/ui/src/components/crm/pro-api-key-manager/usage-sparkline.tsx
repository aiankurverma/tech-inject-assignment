import * as React from "react";
import { Area, AreaChart, Tooltip, YAxis } from "recharts";

export interface UsageSparklineProps {
  data: number[] | undefined;
  width?: number;
  height?: number;
  muted?: boolean;
  /** Label used for the accessible summary, e.g. "requests". */
  unit?: string;
}

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

/** Recharts area sparkline. Memoised because it renders inside virtualised table rows. */
export const UsageSparkline = React.memo(function UsageSparkline({
  data,
  width = 96,
  height = 28,
  muted,
  unit = "requests",
}: UsageSparklineProps) {
  const id = React.useId().replace(/:/g, "");
  const points = React.useMemo(() => (data ?? []).map((v, i) => ({ i, v })), [data]);
  const total = React.useMemo(() => (data ?? []).reduce((a, b) => a + b, 0), [data]);
  if (!points.length) {
    return <span className="text-xs text-crm-subtle">No traffic</span>;
  }
  const color = muted ? "var(--color-crm-subtle)" : "var(--color-crm-trend)";
  return (
    <div
      className="flex items-center gap-2"
      role="img"
      aria-label={`${compact.format(total)} ${unit} in the last ${points.length} days`}
    >
      <AreaChart
        width={width}
        height={height}
        data={points}
        margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
      >
        <defs>
          <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[0, "dataMax"]} />
        <Tooltip
          cursor={false}
          isAnimationActive={false}
          wrapperStyle={{ zIndex: 20 }}
          content={({ active, payload }) =>
            active && payload?.[0] ? (
              <div className="rounded border border-crm-border bg-crm-popover px-1.5 py-0.5 text-[11px] text-crm-fg shadow-crm-raised">
                {compact.format(Number(payload[0].value))}
              </div>
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${id})`}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
      <span className="w-10 text-right text-xs tabular-nums text-crm-soft">
        {compact.format(total)}
      </span>
    </div>
  );
});
