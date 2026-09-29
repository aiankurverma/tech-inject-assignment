import * as React from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import {
  formatQuantity,
  type MeterSummary,
  type SeriesPoint,
} from "@/components/crm/pro-usage-metering-dashboard/types";

const C = {
  primary: "var(--color-crm-primary)",
  grid: "var(--color-crm-border)",
  axis: "var(--color-crm-muted-fg)",
  danger: "var(--color-crm-danger)",
  warning: "var(--color-crm-warning)",
  forecast: "var(--color-crm-soft)",
};

interface MeterChartProps {
  summary: MeterSummary;
  data: SeriesPoint[];
  height?: number;
}

function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: { payload: SeriesPoint }[];
  unit: string;
}) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="rounded-crm border border-crm-border bg-crm-popover px-3 py-2 text-xs shadow-crm-raised">
      <p className="mb-1 font-medium text-crm-fg">{format(parseISO(p.date), "EEE, MMM d")}</p>
      {p.actual !== undefined && (
        <p className="text-crm-soft">
          Cumulative{" "}
          <span className="tabular-nums text-crm-fg">{formatQuantity(p.actual, unit)}</span>
        </p>
      )}
      {p.daily !== undefined && (
        <p className="text-crm-soft">
          That day <span className="tabular-nums text-crm-fg">{formatQuantity(p.daily, unit)}</span>
        </p>
      )}
      {p.actual === undefined && p.forecast !== undefined && (
        <p className="text-crm-soft">
          Forecast{" "}
          <span className="tabular-nums text-crm-fg">{formatQuantity(p.forecast, unit)}</span>
        </p>
      )}
    </div>
  );
}

/** Cumulative usage (area) + dashed linear forecast, with limit and alert-threshold reference lines. */
export const MeterChart = React.memo(function MeterChart({
  summary,
  data,
  height = 220,
}: MeterChartProps) {
  const { meter } = summary;
  const gradientId = React.useId().replace(/:/g, "");
  const yMax = Math.max(summary.projected, meter.limit ?? 0, summary.used) * 1.08 || 1;
  const summaryText = `${meter.name}: ${formatQuantity(summary.used, meter.unit)} used${
    meter.limit ? ` of ${formatQuantity(meter.limit, meter.unit)}` : ""
  }, forecast ${formatQuantity(summary.projected, meter.unit)} by period end.`;

  return (
    <figure className="m-0" aria-label={summaryText}>
      <figcaption className="sr-only">{summaryText}</figcaption>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.primary} stopOpacity={0.35} />
                <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => format(parseISO(d), "MMM d")}
              tick={{ fill: C.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={[0, yMax]}
              tickFormatter={(v: number) => formatQuantity(v)}
              tick={{ fill: C.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<ChartTooltip unit={meter.unit} />} cursor={{ stroke: C.grid }} />
            {meter.limit !== undefined &&
              (meter.alertThresholds ?? []).map((t) => (
                <ReferenceLine
                  key={t}
                  y={meter.limit! * t}
                  stroke={C.warning}
                  strokeDasharray="2 4"
                  strokeOpacity={0.7}
                  label={{
                    value: `${Math.round(t * 100)}%`,
                    position: "insideLeft",
                    fill: C.warning,
                    fontSize: 10,
                  }}
                />
              ))}
            {meter.limit !== undefined && (
              <ReferenceLine
                y={meter.limit}
                stroke={C.danger}
                strokeWidth={1.5}
                label={{ value: "Limit", position: "insideTopLeft", fill: C.danger, fontSize: 10 }}
              />
            )}
            <Area
              type="monotone"
              dataKey="actual"
              stroke={C.primary}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="linear"
              dataKey="forecast"
              stroke={C.forecast}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
});
