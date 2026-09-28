import * as React from "react";
import { cn } from "@/lib/utils";

export const chartPalette = [
  "#7c6bff",
  "#22c55e",
  "#fbbf24",
  "#60a5fa",
  "#f97373",
  "#eeb390",
  "#b7aee9",
  "#2dd4bf",
] as const;

export interface BarSeries {
  key: string;
  label: string;
  color?: string;
}

export interface BarDatum {
  /** Category label on the x axis, e.g. "Jan" or "EMEA". */
  label: string;
  /** One value per series key. Missing keys count as 0. */
  values: Record<string, number>;
}

export interface BarChartProps {
  data: BarDatum[];
  series: BarSeries[];
  /** "grouped" draws series side by side, "stacked" piles them into one bar. */
  mode?: "grouped" | "stacked";
  height?: number;
  /** Formats axis ticks and tooltips, e.g. currency. */
  formatValue?: (value: number) => string;
  /** Horizontal dashed target line. */
  target?: { value: number; label?: string };
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  /** Accessible chart name. */
  label: string;
  onBarClick?: (datum: BarDatum, seriesKey: string) => void;
  className?: string;
}

/** Rounds a max up to a clean axis step and returns the ticks. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const defaultFormat = (v: number) => compact.format(v);

/**
 * SVG bar chart with grouped or stacked series, clean axis ticks, target line, legend toggles,
 * tooltips and arrow-key navigation between categories.
 */
export function BarChart({
  data,
  series,
  mode = "grouped",
  height = 240,
  formatValue = defaultFormat,
  target,
  loading,
  error,
  emptyMessage = "No data for this period",
  label,
  onBarClick,
  className,
}: BarChartProps) {
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [active, setActive] = React.useState<number | null>(null);
  const titleId = React.useId();
  const visible = series.filter((s) => !hidden.has(s.key));
  const colorOf = (s: BarSeries, i: number) => s.color ?? chartPalette[i % chartPalette.length];

  const totals = data.map((d) =>
    mode === "stacked"
      ? visible.reduce((sum, s) => sum + Math.max(0, d.values[s.key] ?? 0), 0)
      : Math.max(0, ...visible.map((s) => d.values[s.key] ?? 0)),
  );
  const ticks = niceTicks(Math.max(0, ...totals, target?.value ?? 0));
  const top = ticks[ticks.length - 1] || 1;

  const W = 640;
  const H = height;
  const pad = { l: 56, r: 12, t: 22, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const band = data.length ? iw / data.length : iw;
  const y = (v: number) => pad.t + ih - (v / top) * ih;

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (series.length - next.size > 1) next.add(key);
      return next;
    });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!data.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      setActive((a) => (a === null ? 0 : (a + dir + data.length) % data.length));
    } else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(data.length - 1);
    else if (e.key === "Escape") setActive(null);
    else if (e.key === "Enter" && active !== null && onBarClick && visible[0]) {
      const d = data[active];
      if (d) onBarClick(d, visible[0].key);
    }
  };

  const state = loading ? "loading" : error ? "error" : data.length === 0 ? "empty" : "ready";

  return (
    <figure className={cn("flex w-full min-w-0 flex-col gap-3 font-crm text-crm-fg", className)}>
      <figcaption id={titleId} className="sr-only">
        {label}
      </figcaption>
      {series.length > 1 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Series">
          {series.map((s, i) => {
            const on = !hidden.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-crm-border px-2 py-0.5 text-xs outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                  on ? "text-crm-soft" : "text-crm-subtle opacity-60",
                )}
              >
                <span
                  className="size-2 rounded-full"
                  style={{
                    background: on ? colorOf(s, i) : "transparent",
                    borderColor: colorOf(s, i),
                  }}
                  aria-hidden
                />
                {s.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {state !== "ready" ? (
        <div
          role={state === "error" ? "alert" : "status"}
          className="grid place-items-center rounded-crm border border-dashed border-crm-border text-xs text-crm-subtle"
          style={{ height }}
        >
          {state === "loading" ? (
            <span className="flex h-3/5 w-4/5 items-end gap-2" aria-label="Loading chart">
              {[40, 70, 55, 85, 60, 75].map((h, i) => (
                <span
                  key={i}
                  className="flex-1 animate-pulse rounded-t bg-crm-muted"
                  style={{ height: `${h}%` }}
                />
              ))}
            </span>
          ) : state === "error" ? (
            <span className="text-crm-danger">{error}</span>
          ) : (
            emptyMessage
          )}
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full overflow-visible rounded-crm outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            role="img"
            aria-labelledby={titleId}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
            onMouseLeave={() => setActive(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={y(t)}
                  y2={y(t)}
                  className="stroke-crm-border"
                  strokeWidth={1}
                />
                <text
                  x={pad.l - 6}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-crm-soft text-[13px]"
                >
                  {formatValue(t)}
                </text>
              </g>
            ))}
            {data.map((d, di) => {
              const x0 = pad.l + di * band;
              const inner = band * 0.7;
              const gx = x0 + (band - inner) / 2;
              let stackBase = 0;
              return (
                <g
                  key={d.label}
                  onMouseEnter={() => setActive(di)}
                  opacity={active === null || active === di ? 1 : 0.45}
                >
                  <rect x={x0} y={pad.t} width={band} height={ih} fill="transparent" />
                  {visible.map((s, si) => {
                    const v = Math.max(0, d.values[s.key] ?? 0);
                    const color = colorOf(s, series.indexOf(s));
                    let bx: number, bw: number, by: number, bh: number;
                    if (mode === "stacked") {
                      bw = inner;
                      bx = gx;
                      by = y(stackBase + v);
                      bh = y(stackBase) - by;
                      stackBase += v;
                    } else {
                      bw = inner / visible.length;
                      bx = gx + si * bw;
                      by = y(v);
                      bh = pad.t + ih - by;
                    }
                    return (
                      <rect
                        key={s.key}
                        x={bx + 1}
                        y={by}
                        width={Math.max(1, bw - 2)}
                        height={Math.max(0, bh)}
                        rx={mode === "stacked" && si < visible.length - 1 ? 0 : 3}
                        fill={color}
                        className={onBarClick ? "cursor-pointer" : undefined}
                        onClick={onBarClick ? () => onBarClick(d, s.key) : undefined}
                      />
                    );
                  })}
                  <text
                    x={x0 + band / 2}
                    y={H - 8}
                    textAnchor="middle"
                    className="fill-crm-soft text-[13px]"
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
            {target ? (
              <g>
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={y(target.value)}
                  y2={y(target.value)}
                  stroke="#fbbf24"
                  strokeDasharray="4 4"
                />
                <text
                  x={pad.l + 6}
                  y={y(target.value) - 6}
                  textAnchor="start"
                  className="fill-crm-warning text-[13px] font-medium"
                  paintOrder="stroke"
                  stroke="var(--color-crm-bg, #161616)"
                  strokeWidth={4}
                >
                  {target.label ?? "Target"} {formatValue(target.value)}
                </text>
              </g>
            ) : null}
          </svg>
          {active !== null && data[active] ? (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-crm bg-crm-popover px-2.5 py-2 text-xs shadow-crm-overlay"
              style={{ left: `${((pad.l + (active + 0.5) * band) / W) * 100}%` }}
            >
              <p className="mb-1 font-medium text-crm-fg">{data[active].label}</p>
              {visible.map((s) => (
                <p key={s.key} className="flex items-center justify-between gap-3 text-crm-soft">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: colorOf(s, series.indexOf(s)) }}
                      aria-hidden
                    />
                    {s.label}
                  </span>
                  <span className="tabular-nums text-crm-fg">
                    {formatValue(data[active]?.values[s.key] ?? 0)}
                  </span>
                </p>
              ))}
              {mode === "stacked" && visible.length > 1 ? (
                <p className="mt-1 flex justify-between border-t border-crm-border pt-1 text-crm-fg">
                  <span>Total</span>
                  <span className="tabular-nums">{formatValue(totals[active] ?? 0)}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              {series.map((s) => (
                <td key={s.key}>{formatValue(d.values[s.key] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
