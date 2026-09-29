import * as React from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { cn } from "@/lib/utils";
import { ChartFrame, td, th } from "@/components/crm/pro-forecast-dashboard/chart-frame";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  STACK_KEYS,
  type StackKey,
} from "@/components/crm/pro-forecast-dashboard/model";
import type { DrillFilter, PeriodBucket } from "@/components/crm/pro-forecast-dashboard/types";

const AXIS = { fill: "var(--color-crm-muted-fg, #7f7f7f)", fontSize: 11 };

export interface ForecastChartProps {
  buckets: PeriodBucket[];
  format: (n: number) => string;
  formatCompact: (n: number) => string;
  drill: DrillFilter;
  onDrill: (periodKey: string, category?: StackKey) => void;
  hidden: ReadonlySet<StackKey>;
  onToggleSeries: (k: StackKey) => void;
  height?: number;
}

function TooltipBody({
  active,
  payload,
  format,
}: TooltipContentProps<number, string> & { format: (n: number) => string }) {
  const b = payload?.[0]?.payload as PeriodBucket | undefined;
  if (!active || !b) return null;
  const total = b.closed + b.commit + b.best + b.pipeline;
  const called = b.closed + b.commit;
  return (
    <div className="min-w-48 rounded-crm border border-crm-border bg-crm-popover p-2.5 text-xs text-crm-fg shadow-crm-overlay">
      <p className="mb-1.5 font-medium">{b.label}</p>
      {STACK_KEYS.map((k) => (
        <p key={k} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-crm-soft">
            <span className="size-2 rounded-[2px]" style={{ background: CATEGORY_COLOR[k] }} />
            {CATEGORY_LABEL[k]}
          </span>
          <span className="tabular-nums">{format(b[k])}</span>
        </p>
      ))}
      <p className="mt-1 flex justify-between gap-4 border-t border-crm-border pt-1 text-crm-soft">
        <span>Total pipeline</span>
        <span className="tabular-nums text-crm-fg">{format(total)}</span>
      </p>
      {b.quota != null && (
        <p className="flex justify-between gap-4 text-crm-soft">
          <span>Quota · called {Math.round((called / (b.quota || 1)) * 100)}%</span>
          <span className="tabular-nums text-crm-fg">{format(b.quota)}</span>
        </p>
      )}
      <p className="mt-1 text-crm-subtle">Click a segment to drill in</p>
    </div>
  );
}

/** Stacked closed / commit / best-case / pipeline bars per period with a quota line. */
export function ForecastChart({
  buckets,
  format,
  formatCompact,
  drill,
  onDrill,
  hidden,
  onToggleSeries,
  height = 300,
}: ForecastChartProps) {
  const summary = React.useMemo(() => {
    const miss = buckets.filter((b) => b.quota != null && b.closed + b.commit < b.quota).length;
    return `${buckets.length} periods. ${miss} period${miss === 1 ? "" : "s"} where closed plus commit is below quota. Switch to table view for exact values.`;
  }, [buckets]);
  const visible = STACK_KEYS.filter((k) => !hidden.has(k));
  const top = visible[visible.length - 1];

  const legend = (
    <div role="group" aria-label="Series" className="flex flex-wrap gap-1">
      {STACK_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={!hidden.has(k)}
          onClick={() => onToggleSeries(k)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-xs text-crm-soft hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none",
            hidden.has(k) && "opacity-40 line-through",
          )}
        >
          <span className="size-2.5 rounded-[3px]" style={{ background: CATEGORY_COLOR[k] }} />
          {CATEGORY_LABEL[k]}
        </button>
      ))}
      <span className="inline-flex h-7 items-center gap-1.5 px-2 text-xs text-crm-soft">
        <span className="h-0.5 w-3 bg-crm-warning" /> Quota
      </span>
    </div>
  );

  const chart = (
    <div role="img" aria-label={`Forecast by period. ${summary}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={buckets} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-crm-border, #232323)" />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <Tooltip
            cursor={{ fill: "var(--color-crm-muted, #2a2a2a)", opacity: 0.4 }}
            content={(p) => (
              <TooltipBody {...(p as TooltipContentProps<number, string>)} format={format} />
            )}
          />
          {visible.map((k) => (
            <Bar
              key={k}
              dataKey={k}
              name={CATEGORY_LABEL[k]}
              stackId="f"
              fill={CATEGORY_COLOR[k]}
              radius={k === top ? [4, 4, 0, 0] : 0}
              maxBarSize={48}
              cursor="pointer"
              isAnimationActive={false}
              onClick={(d) => {
                const row = (d as unknown as { payload?: PeriodBucket }).payload;
                if (row) onDrill(row.key, k);
              }}
            >
              {buckets.map((b) => (
                <Cell
                  key={b.key}
                  fillOpacity={
                    drill.periodKey && drill.periodKey !== b.key
                      ? 0.35
                      : drill.category && drill.category !== k
                        ? 0.5
                        : 1
                  }
                />
              ))}
            </Bar>
          ))}
          <Line
            dataKey="quota"
            name="Quota"
            type="monotone"
            stroke="var(--color-crm-warning, #fbbf24)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 3, fill: "var(--color-crm-warning, #fbbf24)", strokeWidth: 0 }}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  const table = (
    <table className="w-full min-w-[36rem] border-collapse">
      <caption className="sr-only">Forecast by period</caption>
      <thead>
        <tr>
          <th scope="col" className={th}>
            Period
          </th>
          {STACK_KEYS.map((k) => (
            <th key={k} scope="col" className={cn(th, "text-right")}>
              {CATEGORY_LABEL[k]}
            </th>
          ))}
          <th scope="col" className={cn(th, "text-right")}>
            Quota
          </th>
          <th scope="col" className={cn(th, "text-right")}>
            Called %
          </th>
        </tr>
      </thead>
      <tbody>
        {buckets.map((b) => (
          <tr key={b.key}>
            <th scope="row" className={cn(td, "text-left font-normal")}>
              <button
                type="button"
                onClick={() => onDrill(b.key)}
                className="underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
              >
                {b.label}
              </button>
            </th>
            {STACK_KEYS.map((k) => (
              <td key={k} className={cn(td, "text-right")}>
                {format(b[k])}
              </td>
            ))}
            <td className={cn(td, "text-right")}>{b.quota != null ? format(b.quota) : "—"}</td>
            <td className={cn(td, "text-right")}>
              {b.quota ? `${Math.round(((b.closed + b.commit) / b.quota) * 100)}%` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      title="Forecast vs quota"
      subtitle="Closed + commit is the called number; best case and pipeline are upside."
      actions={legend}
      chart={chart}
      table={table}
      className="lg:col-span-2"
    />
  );
}
