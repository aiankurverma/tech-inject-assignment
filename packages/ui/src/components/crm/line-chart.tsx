import * as React from "react";
import { cn } from "@/lib/utils";

const palette = ["#7c6bff", "#22c55e", "#fbbf24", "#60a5fa", "#f97373", "#2dd4bf"];

export interface LineSeries {
  key: string;
  label: string;
  color?: string;
  /** Draw as a dashed line, e.g. a forecast or last-period comparison. */
  dashed?: boolean;
}

export interface LinePoint {
  /** X label, e.g. "Mon" or "Mar 4". */
  label: string;
  /** Value per series key; null leaves a gap (missing data). */
  values: Record<string, number | null>;
}

export interface LineChartProps {
  data: LinePoint[];
  series: LineSeries[];
  /** Fill the area under each line with a soft gradient. */
  area?: boolean;
  /** Smooth curves instead of straight segments. */
  curved?: boolean;
  height?: number;
  formatValue?: (value: number) => string;
  /** Show every nth x label to avoid overlap. Defaults to auto. */
  labelEvery?: number;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  label: string;
  className?: string;
}

function ticksFor(min: number, max: number, count = 4): number[] {
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

type Pt = [number, number];

function pathFor(pts: Pt[], curved: boolean): string {
  if (!pts.length) return "";
  if (!curved || pts.length < 3)
    return pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("");
  const at = (i: number): Pt => pts[Math.max(0, Math.min(pts.length - 1, i))] as Pt;
  let d = `M${at(0)[0]},${at(0)[1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Multi-series SVG line/area chart with gaps for missing data, crosshair tooltip, legend toggles,
 * period-over-period change and arrow-key scrubbing.
 */
export function LineChart({
  data,
  series,
  area = false,
  curved = true,
  height = 220,
  formatValue = (v) => compact.format(v),
  labelEvery,
  loading,
  error,
  emptyMessage = "No data for this period",
  label,
  className,
}: LineChartProps) {
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [active, setActive] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const uid = React.useId().replace(/:/g, "");
  const visible = series.filter((s) => !hidden.has(s.key));
  const colorOf = (s: LineSeries) => s.color ?? palette[series.indexOf(s) % palette.length];

  const all = data.flatMap((d) =>
    visible.map((s) => d.values[s.key]).filter((v): v is number => v != null),
  );
  const ticks = ticksFor(Math.min(0, ...all), Math.max(1, ...all));
  const lo = ticks[0] ?? 0;
  const hi = ticks[ticks.length - 1] ?? 1;

  const W = 640;
  const H = height;
  const pad = { l: 44, r: 14, t: 12, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (data.length > 1 ? (i / (data.length - 1)) * iw : iw / 2);
  const y = (v: number) => pad.t + ih - ((v - lo) / (hi - lo)) * ih;
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 8));

  const segments = (s: LineSeries): Pt[][] => {
    const out: Pt[][] = [];
    let cur: Pt[] = [];
    data.forEach((d, i) => {
      const v = d.values[s.key];
      if (v == null) {
        if (cur.length) out.push(cur);
        cur = [];
      } else cur.push([x(i), y(v)]);
    });
    if (cur.length) out.push(cur);
    return out;
  };

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (series.length - next.size > 1) next.add(key);
      return next;
    });

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || data.length === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.l) / iw) * (data.length - 1));
    setActive(Math.max(0, Math.min(data.length - 1, i)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!data.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      setActive((a) =>
        Math.max(0, Math.min(data.length - 1, (a ?? (dir > 0 ? -1 : data.length)) + dir)),
      );
    } else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(data.length - 1);
    else if (e.key === "Escape") setActive(null);
  };

  const change = (s: LineSeries) => {
    const vals = data.map((d) => d.values[s.key]).filter((v): v is number => v != null);
    const a = vals[0];
    const b = vals[vals.length - 1];
    if (vals.length < 2 || a == null || b == null || a === 0) return null;
    return ((b - a) / Math.abs(a)) * 100;
  };

  const state = loading ? "loading" : error ? "error" : data.length === 0 ? "empty" : "ready";

  return (
    <figure className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}>
      <figcaption className="sr-only">{label}</figcaption>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Series">
        {series.map((s) => {
          const on = !hidden.has(s.key);
          const pct = change(s);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-crm-border px-2 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                on ? "text-crm-soft" : "text-crm-subtle line-through opacity-60",
              )}
            >
              <span className="h-0.5 w-3 rounded" style={{ background: colorOf(s) }} aria-hidden />
              {s.label}
              {pct != null && on ? (
                <span
                  className={cn("tabular-nums", pct >= 0 ? "text-crm-success" : "text-crm-danger")}
                >
                  {pct >= 0 ? "+" : ""}
                  {pct.toFixed(1)}%
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {state !== "ready" ? (
        <div
          role={state === "error" ? "alert" : "status"}
          className={cn(
            "grid place-items-center rounded-crm border border-dashed border-crm-border text-xs",
            state === "error" ? "text-crm-danger" : "text-crm-subtle",
            state === "loading" && "animate-pulse bg-crm-muted/40",
          )}
          style={{ height }}
        >
          {state === "loading" ? "Loading chart…" : state === "error" ? error : emptyMessage}
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full touch-none overflow-visible rounded-crm outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            role="img"
            aria-label={label}
            tabIndex={0}
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
          >
            <defs>
              {visible.map((s) => (
                <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={colorOf(s)} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={colorOf(s)} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={y(t)}
                  y2={y(t)}
                  className={t === 0 ? "stroke-crm-input" : "stroke-crm-border"}
                />
                <text
                  x={pad.l - 6}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-crm-subtle text-[10px]"
                >
                  {formatValue(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              i % every === 0 || i === data.length - 1 ? (
                <text
                  key={d.label}
                  x={x(i)}
                  y={H - 6}
                  textAnchor="middle"
                  className="fill-crm-subtle text-[10px]"
                >
                  {d.label}
                </text>
              ) : null,
            )}
            {visible.map((s) =>
              segments(s).map((seg, si) => (
                <g key={`${s.key}-${si}`}>
                  {area && seg.length > 1 ? (
                    <path
                      d={`${pathFor(seg, curved)}L${seg[seg.length - 1]?.[0]},${y(Math.max(lo, 0))}L${seg[0]?.[0]},${y(Math.max(lo, 0))}Z`}
                      fill={`url(#${uid}-${s.key})`}
                    />
                  ) : null}
                  <path
                    d={pathFor(seg, curved)}
                    fill="none"
                    stroke={colorOf(s)}
                    strokeWidth={2}
                    strokeDasharray={s.dashed ? "5 4" : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {seg.length === 1 ? (
                    <circle cx={seg[0]?.[0]} cy={seg[0]?.[1]} r={2.5} fill={colorOf(s)} />
                  ) : null}
                </g>
              )),
            )}
            {active !== null ? (
              <g>
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={pad.t}
                  y2={pad.t + ih}
                  className="stroke-crm-input"
                  strokeDasharray="3 3"
                />
                {visible.map((s) => {
                  const v = data[active]?.values[s.key];
                  return v == null ? null : (
                    <circle
                      key={s.key}
                      cx={x(active)}
                      cy={y(v)}
                      r={4}
                      fill={colorOf(s)}
                      className="stroke-crm-bg"
                      strokeWidth={2}
                    />
                  );
                })}
              </g>
            ) : null}
          </svg>
          {active !== null ? (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "pointer-events-none absolute top-0 z-10 min-w-36 rounded-crm bg-crm-popover px-2.5 py-2 text-xs shadow-crm-overlay",
                active > data.length / 2 ? "-translate-x-[calc(100%+8px)]" : "translate-x-2",
              )}
              style={{ left: `${(x(active) / W) * 100}%` }}
            >
              <p className="mb-1 font-medium text-crm-fg">{data[active]?.label}</p>
              {visible.map((s) => {
                const v = data[active]?.values[s.key];
                return (
                  <p key={s.key} className="flex justify-between gap-3 text-crm-soft">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: colorOf(s) }}
                        aria-hidden
                      />
                      {s.label}
                    </span>
                    <span className="tabular-nums text-crm-fg">
                      {v == null ? "—" : formatValue(v)}
                    </span>
                  </p>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Point</th>
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
              {series.map((s) => {
                const v = d.values[s.key];
                return <td key={s.key}>{v == null ? "No data" : formatValue(v)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
