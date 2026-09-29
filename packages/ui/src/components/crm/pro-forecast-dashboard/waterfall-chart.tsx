import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { cn } from "@/lib/utils";
import { ChartFrame, td, th } from "@/components/crm/pro-forecast-dashboard/chart-frame";
import type { Movement, WaterfallStep } from "@/components/crm/pro-forecast-dashboard/types";

const AXIS = { fill: "var(--color-crm-muted-fg, #7f7f7f)", fontSize: 11 };
const COLOR = {
  total: "var(--color-crm-primary, #4124fb)",
  up: "var(--color-crm-success, #22c55e)",
  down: "var(--color-crm-danger, #f97373)",
};

interface Row extends WaterfallStep {
  bar: number;
}

export interface WaterfallChartProps {
  steps: WaterfallStep[];
  periodLabel: string;
  format: (n: number) => string;
  formatCompact: (n: number) => string;
  activeMovement?: Movement;
  onSelectMovement: (m: Movement | undefined) => void;
  height?: number;
}

const signed = (n: number, f: (n: number) => string) =>
  n > 0 ? `+${f(n)}` : n < 0 ? `−${f(-n)}` : f(0);

function TooltipBody({
  active,
  payload,
  format,
}: TooltipContentProps<number, string> & { format: (n: number) => string }) {
  const r = payload?.[0]?.payload as Row | undefined;
  if (!active || !r) return null;
  return (
    <div className="rounded-crm border border-crm-border bg-crm-popover p-2.5 text-xs text-crm-fg shadow-crm-overlay">
      <p className="font-medium">{r.label}</p>
      <p className="tabular-nums">
        {r.kind === "total" ? format(r.value) : signed(r.value, format)}
      </p>
      {r.kind !== "total" && (
        <p className="text-crm-subtle">
          {r.count} deal{r.count === 1 ? "" : "s"} · click to list
        </p>
      )}
    </div>
  );
}

/** Bridge from the previous forecast call to the current one, by type of movement. */
export function WaterfallChart({
  steps,
  periodLabel,
  format,
  formatCompact,
  activeMovement,
  onSelectMovement,
  height = 300,
}: WaterfallChartProps) {
  const rows = React.useMemo<Row[]>(
    () =>
      steps.map((s) => ({ ...s, bar: Math.abs(s.value), base: s.kind === "total" ? 0 : s.base })),
    [steps],
  );
  const first = steps[0]?.value ?? 0;
  const last = steps[steps.length - 1]?.value ?? 0;
  const pick = (id: WaterfallStep["id"]) =>
    id === "start" || id === "end"
      ? onSelectMovement(undefined)
      : onSelectMovement(activeMovement === id ? undefined : id);

  const chart = (
    <div
      role="img"
      aria-label={`Forecast change for ${periodLabel}: from ${format(first)} to ${format(last)}, ${signed(last - first, format)}. Switch to table view for each movement.`}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-crm-border, #232323)" />
          <XAxis
            dataKey="label"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            interval={0}
            height={36}
            tickFormatter={(v: string) => (v.length > 11 ? `${v.slice(0, 10)}…` : v)}
          />
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
          <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar
            dataKey="bar"
            stackId="w"
            radius={[3, 3, 3, 3]}
            maxBarSize={44}
            cursor="pointer"
            isAnimationActive={false}
            onClick={(d) => {
              const r = (d as unknown as { payload?: Row }).payload;
              if (r) pick(r.id);
            }}
          >
            {rows.map((r) => (
              <Cell
                key={r.id}
                fill={COLOR[r.kind]}
                fillOpacity={
                  activeMovement && activeMovement !== r.id && r.kind !== "total" ? 0.35 : 1
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const table = (
    <table className="w-full border-collapse">
      <caption className="sr-only">Forecast change for {periodLabel}</caption>
      <thead>
        <tr>
          <th scope="col" className={th}>
            Movement
          </th>
          <th scope="col" className={cn(th, "text-right")}>
            Deals
          </th>
          <th scope="col" className={cn(th, "text-right")}>
            Change
          </th>
        </tr>
      </thead>
      <tbody>
        {steps.map((s) => (
          <tr key={s.id}>
            <th scope="row" className={cn(td, "text-left font-normal")}>
              {s.kind === "total" ? (
                <span className="font-medium">{s.label}</span>
              ) : (
                <button
                  type="button"
                  aria-pressed={activeMovement === s.id}
                  onClick={() => pick(s.id)}
                  className="underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                >
                  {s.label}
                </button>
              )}
            </th>
            <td className={cn(td, "text-right")}>{s.kind === "total" ? "" : s.count}</td>
            <td
              className={cn(
                td,
                "text-right",
                s.kind === "up" && "text-crm-success",
                s.kind === "down" && "text-crm-danger",
                s.kind === "total" && "font-medium",
              )}
            >
              {s.kind === "total" ? format(s.value) : signed(s.value, format)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      title="What changed since last call"
      subtitle={`${periodLabel} · closed + commit, ${signed(last - first, formatCompact)}`}
      chart={chart}
      table={table}
    />
  );
}
