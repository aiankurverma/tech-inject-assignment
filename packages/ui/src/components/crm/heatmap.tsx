import * as React from "react";
import { cn } from "@/lib/utils";

export interface HeatmapCell {
  /** 0 = Monday ... 6 = Sunday. */
  day: number;
  /** 0-23. */
  hour: number;
  value: number;
}

export interface HeatmapProps {
  data: HeatmapCell[];
  /** First and last hour shown (inclusive). */
  hours?: [number, number];
  /** Unit used in labels, e.g. "calls" or "emails opened". */
  unit?: string;
  /** Number of colour buckets (2-6). */
  levels?: number;
  loading?: boolean;
  label?: string;
  onCellSelect?: (cell: HeatmapCell) => void;
  className?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEVEL_BG = [
  "bg-crm-muted",
  "bg-crm-trend/20",
  "bg-crm-trend/40",
  "bg-crm-trend/60",
  "bg-crm-trend/80",
  "bg-crm-trend",
];

const fmtHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`;

/**
 * Day-of-week by hour-of-day activity grid (best time to call, ticket load). Values are bucketed
 * into levels; the busiest slot is highlighted. Arrow keys move between cells, Enter selects.
 */
export function Heatmap({
  data,
  hours = [8, 19],
  unit = "activities",
  levels = 5,
  loading,
  label = "Activity by day and hour",
  onCellSelect,
  className,
}: HeatmapProps) {
  const [from, to] = hours;
  const hourList = React.useMemo(
    () => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i),
    [from, to],
  );
  const grid = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data) m.set(`${c.day}:${c.hour}`, (m.get(`${c.day}:${c.hour}`) ?? 0) + c.value);
    return m;
  }, [data]);
  const lv = Math.min(6, Math.max(2, levels));
  let max = 0;
  let peak: HeatmapCell | null = null;
  for (let d = 0; d < 7; d++)
    for (const h of hourList) {
      const v = grid.get(`${d}:${h}`) ?? 0;
      if (v > max) {
        max = v;
        peak = { day: d, hour: h, value: v };
      }
    }
  const total = data.reduce((s, c) => s + c.value, 0);
  const level = (v: number) =>
    v <= 0 || max === 0 ? 0 : Math.max(1, Math.ceil((v / max) * (lv - 1)));
  const bgFor = (l: number) => LEVEL_BG[Math.round((l / (lv - 1)) * 5)] ?? "bg-crm-muted";

  const [focus, setFocus] = React.useState<[number, number]>([0, 0]);
  const refs = React.useRef(new Map<string, HTMLButtonElement>());
  const move = (d: number, hi: number) => {
    const nd = Math.min(6, Math.max(0, d));
    const nh = Math.min(hourList.length - 1, Math.max(0, hi));
    setFocus([nd, nh]);
    refs.current.get(`${nd}:${nh}`)?.focus();
  };

  if (loading) {
    return (
      <div className={cn("font-crm", className)} aria-busy>
        <div
          className="grid animate-pulse gap-[3px]"
          style={{ gridTemplateColumns: `32px repeat(${hourList.length || 1}, minmax(0,1fr))` }}
        >
          {Array.from({ length: 7 * (hourList.length + 1) }, (_, i) => (
            <span key={i} className="h-5 rounded-[3px] bg-crm-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <figure className={cn("font-crm", className)}>
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs text-crm-muted-fg">
          {total.toLocaleString()} {unit}
        </span>
        {peak ? (
          <span className="text-xs text-crm-soft">
            Peak:{" "}
            <span className="text-crm-fg">
              {DAYS[peak.day]} {fmtHour(peak.hour)}
            </span>{" "}
            ({peak.value.toLocaleString()})
          </span>
        ) : (
          <span className="text-xs text-crm-muted-fg">No activity in this range</span>
        )}
      </figcaption>
      <div className="overflow-x-auto">
        <div
          role="grid"
          aria-label={label}
          className="grid min-w-[420px] gap-[3px]"
          style={{ gridTemplateColumns: `32px repeat(${hourList.length}, minmax(0,1fr))` }}
        >
          <span role="presentation" />
          {hourList.map((h, i) => (
            <span key={h} role="columnheader" className="text-center text-[10px] text-crm-muted-fg">
              {i % 2 === 0 ? fmtHour(h) : ""}
            </span>
          ))}
          {DAYS.map((dn, d) => (
            <div key={dn} role="row" className="contents">
              <span role="rowheader" className="self-center text-[11px] text-crm-soft">
                {dn}
              </span>
              {hourList.map((h, hi) => {
                const v = grid.get(`${d}:${h}`) ?? 0;
                const isPeak = peak !== null && peak.day === d && peak.hour === h;
                const focused = focus[0] === d && focus[1] === hi;
                return (
                  <button
                    key={h}
                    type="button"
                    role="gridcell"
                    ref={(el) => {
                      if (el) refs.current.set(`${d}:${hi}`, el);
                      else refs.current.delete(`${d}:${hi}`);
                    }}
                    tabIndex={focused ? 0 : -1}
                    title={`${dn} ${fmtHour(h)}: ${v} ${unit}`}
                    aria-label={`${dn} ${fmtHour(h)}, ${v} ${unit}`}
                    onClick={() => {
                      setFocus([d, hi]);
                      onCellSelect?.({ day: d, hour: h, value: v });
                    }}
                    onKeyDown={(e) => {
                      const k = e.key;
                      if (k === "ArrowRight") move(d, hi + 1);
                      else if (k === "ArrowLeft") move(d, hi - 1);
                      else if (k === "ArrowDown") move(d + 1, hi);
                      else if (k === "ArrowUp") move(d - 1, hi);
                      else if (k === "Home") move(d, 0);
                      else if (k === "End") move(d, hourList.length - 1);
                      else return;
                      e.preventDefault();
                    }}
                    className={cn(
                      "h-5 cursor-pointer rounded-[3px] outline-none transition-colors duration-150 ease-crm",
                      "focus-visible:ring-2 focus-visible:ring-crm-ring/70",
                      bgFor(level(v)),
                      isPeak && "ring-1 ring-crm-fg/70",
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div
        className="mt-2 flex items-center justify-end gap-1 text-[10px] text-crm-muted-fg"
        aria-hidden
      >
        Less
        {Array.from({ length: lv }, (_, l) => (
          <span key={l} className={cn("size-2.5 rounded-[2px]", bgFor(l))} />
        ))}
        More
      </div>
    </figure>
  );
}
