import * as React from "react";
import { cn } from "@/lib/utils";
import { lttbWindow } from "@/lib/lttb";
import type { TimeRange, TimeSeries } from "@/components/crm/pro-time-series-explorer/types";
import { fullTime, timeLabel, timeTicks } from "@/components/crm/pro-time-series-explorer/scale";
import { MARGIN } from "@/components/crm/pro-time-series-explorer/panel";

interface OverviewBrushProps {
  series: (TimeSeries & { color: string })[];
  extent: TimeRange;
  range: TimeRange;
  width: number;
  height?: number;
  onRange: (r: TimeRange) => void;
}

type DragMode = "move" | "start" | "end" | "new";

/** Full-extent context strip with a draggable, resizable and keyboard-operable brush. */
export const OverviewBrush = React.memo(function OverviewBrush({
  series,
  extent,
  range,
  width,
  height = 64,
  onRange,
}: OverviewBrushProps) {
  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const plotH = height - 18;
  const [lo, hi] = extent;
  const full = Math.max(hi - lo, 1);
  const xOf = (t: number) => ((t - lo) / full) * plotW;
  const tOf = (x: number) => lo + (x / plotW) * full;
  const ref = React.useRef<SVGSVGElement | null>(null);
  const drag = React.useRef<{ mode: DragMode; x0: number; r0: TimeRange } | null>(null);

  // One LTTB pass over the full extent per series, ~1 point per pixel.
  const paths = React.useMemo(() => {
    const sampled = series.map((s) => ({
      s,
      d: lttbWindow(s.timestamps, s.values, lo, hi, plotW),
    }));
    let min = Infinity;
    let max = -Infinity;
    for (const { d } of sampled) {
      min = Math.min(min, d.min);
      max = Math.max(max, d.max);
    }
    const yr = max - min || 1;
    return sampled.map(({ s, d }) => {
      let p = "";
      let pen = false;
      for (let i = 0; i < d.length; i++) {
        const v = d.ys[i]!;
        if (Number.isNaN(v)) {
          pen = false;
          continue;
        }
        const x = ((d.xs[i]! - lo) / full) * plotW;
        const y = plotH - 2 - ((v - min) / yr) * (plotH - 4);
        p += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
        pen = true;
      }
      return { id: s.id, color: s.color, d: p };
    });
  }, [series, lo, hi, full, plotW, plotH]);

  const x0 = xOf(range[0]);
  const x1 = xOf(range[1]);

  const localX = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(Math.max(clientX - r.left - MARGIN.left, 0), plotW);
  };

  const onDown = (mode: DragMode) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const x = localX(e.clientX);
    drag.current = { mode, x0: x, r0: mode === "new" ? [tOf(x), tOf(x)] : range };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const x = localX(e.clientX);
    const dt = ((x - d.x0) / plotW) * full;
    const [s, en] = d.r0;
    if (d.mode === "move") onRange([s + dt, en + dt]);
    else if (d.mode === "start") onRange([Math.min(s + dt, en - 1), en]);
    else if (d.mode === "end") onRange([s, Math.max(en + dt, s + 1)]);
    else if (Math.abs(x - d.x0) > 3) {
      const t = tOf(x);
      onRange([Math.min(s, t), Math.max(s, t)]);
    }
  };
  const onUp = () => {
    drag.current = null;
  };

  const handleKey = (which: "start" | "end") => (e: React.KeyboardEvent) => {
    const step = (e.shiftKey ? 0.1 : 0.01) * full;
    let d = 0;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") d = -step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") d = step;
    else if (e.key === "Home") d = which === "start" ? lo - range[0] : range[0] + 1 - range[1];
    else if (e.key === "End") d = which === "end" ? hi - range[1] : range[1] - 1 - range[0];
    else return;
    e.preventDefault();
    if (which === "start") onRange([Math.min(range[0] + d, range[1] - 1), range[1]]);
    else onRange([range[0], Math.max(range[1] + d, range[0] + 1)]);
  };

  const ticks = timeTicks(lo, hi, Math.max(2, Math.floor(plotW / 120)));
  const handleCls =
    "cursor-ew-resize fill-crm-card stroke-crm-primary outline-none focus-visible:stroke-[3px]";

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      className="block select-none"
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="group"
      aria-label="Overview. Drag or use the handles to choose the visible window."
    >
      <g transform={`translate(${MARGIN.left},0)`}>
        <rect
          width={plotW}
          height={plotH}
          className="fill-crm-soft"
          rx={4}
          onPointerDown={onDown("new")}
        />
        {paths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={1}
            opacity={0.8}
            pointerEvents="none"
          />
        ))}
        <rect
          width={Math.max(x0, 0)}
          height={plotH}
          className="fill-crm-bg"
          opacity={0.6}
          pointerEvents="none"
        />
        <rect
          x={x1}
          width={Math.max(plotW - x1, 0)}
          height={plotH}
          className="fill-crm-bg"
          opacity={0.6}
          pointerEvents="none"
        />
        <rect
          x={x0}
          width={Math.max(x1 - x0, 2)}
          height={plotH}
          className={cn("cursor-grab fill-crm-primary/10 stroke-crm-primary")}
          onPointerDown={onDown("move")}
        />
        {(["start", "end"] as const).map((which) => {
          const x = which === "start" ? x0 : x1;
          const t = which === "start" ? range[0] : range[1];
          return (
            <rect
              key={which}
              x={x - 4}
              y={plotH / 2 - 12}
              width={8}
              height={24}
              rx={3}
              tabIndex={0}
              role="slider"
              aria-label={which === "start" ? "Window start" : "Window end"}
              aria-valuemin={lo}
              aria-valuemax={hi}
              aria-valuenow={Math.round(t)}
              aria-valuetext={fullTime(t)}
              className={handleCls}
              onPointerDown={onDown(which)}
              onKeyDown={handleKey(which)}
            />
          );
        })}
        {ticks.map((t) => (
          <text
            key={t}
            x={xOf(t)}
            y={height - 4}
            textAnchor="middle"
            className="fill-crm-muted-fg text-[10px]"
          >
            {timeLabel(t, full)}
          </text>
        ))}
      </g>
    </svg>
  );
});
