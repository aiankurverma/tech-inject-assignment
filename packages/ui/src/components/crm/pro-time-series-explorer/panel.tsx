import * as React from "react";
import { DeckGL, OrthographicView, PathLayer, ScatterplotLayer } from "deck.gl";
import { cn } from "@/lib/utils";
import { lttbWindow, nearestIndex } from "@/lib/lttb";
import type {
  TimeAnnotation,
  TimeRange,
  TimeSeries,
  TimeSeriesPanel,
} from "@/components/crm/pro-time-series-explorer/types";
import {
  defaultFormat,
  fullTime,
  hexToRgb,
  niceTicks,
  timeLabel,
  timeTicks,
} from "@/components/crm/pro-time-series-explorer/scale";

export const MARGIN = { left: 56, right: 12, top: 10, bottom: 22 };

interface Segment {
  id: string;
  color: [number, number, number];
  path: Float32Array;
}

interface Dot {
  id: string;
  color: [number, number, number];
  position: [number, number];
}

export interface PanelStats {
  source: number;
  rendered: number;
}

interface PanelProps {
  panel: TimeSeriesPanel;
  series: (TimeSeries & { color: string })[];
  width: number;
  range: TimeRange;
  hoverTime: number | null;
  annotations: TimeAnnotation[];
  webgl: boolean;
  /** Target rendered points per pixel column. */
  density: number;
  onHover: (t: number | null) => void;
  onRange: (r: TimeRange) => void;
  onZoom: (factor: number, anchor: number) => void;
  onPan: (fraction: number) => void;
  onReset: () => void;
  onAnnotation?: (a: TimeAnnotation) => void;
  onStats?: (id: string, stats: PanelStats) => void;
}

const VIEW = new OrthographicView({ id: "ortho", flipY: true });

export const ExplorerPanel = React.memo(function ExplorerPanel({
  panel,
  series,
  width,
  range,
  hoverTime,
  annotations,
  webgl,
  density,
  onHover,
  onRange,
  onZoom,
  onPan,
  onReset,
  onAnnotation,
  onStats,
}: PanelProps) {
  const height = panel.height ?? 180;
  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const plotH = Math.max(height - MARGIN.top - MARGIN.bottom, 10);
  const [start, end] = range;
  const span = Math.max(end - start, 1);
  const fmt = panel.formatValue ?? defaultFormat;
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const descId = React.useId();
  const [drag, setDrag] = React.useState<{ x0: number; x1: number; mode: "pan" | "select" } | null>(
    null,
  );
  const dragRange = React.useRef<TimeRange>(range);

  // Downsample every visible series to ~density points per pixel of plot width.
  const sampled = React.useMemo(
    () =>
      series.map((s) => ({
        s,
        d: lttbWindow(s.timestamps, s.values, start, end, Math.round(plotW * density)),
      })),
    [series, start, end, plotW, density],
  );

  const [yMin, yMax] = React.useMemo(() => {
    if (panel.yDomain) return panel.yDomain;
    let lo = Infinity;
    let hi = -Infinity;
    for (const { d } of sampled) {
      if (d.min < lo) lo = d.min;
      if (d.max > hi) hi = d.max;
    }
    if (!Number.isFinite(lo)) return [0, 1] as const;
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
    return [lo - pad, hi + pad] as const;
  }, [sampled, panel.yDomain]);

  const xOf = React.useCallback((t: number) => ((t - start) / span) * plotW, [start, span, plotW]);
  const yOf = React.useCallback(
    (v: number) => plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH,
    [plotH, yMin, yMax],
  );

  const { segments, dots, rendered, source } = React.useMemo(() => {
    const segs: Segment[] = [];
    const pts: Dot[] = [];
    let rendered = 0;
    let source = 0;
    for (const { s, d } of sampled) {
      const color = hexToRgb(s.color);
      source += d.sourceCount;
      rendered += d.length;
      let buf: number[] = [];
      const flush = () => {
        if (buf.length >= 4)
          segs.push({ id: `${s.id}-${segs.length}`, color, path: Float32Array.from(buf) });
        buf = [];
      };
      for (let i = 0; i < d.length; i++) {
        const v = d.ys[i]!;
        if (Number.isNaN(v)) {
          flush();
          continue;
        }
        const x = xOf(d.xs[i]!);
        const y = yOf(v);
        buf.push(x, y);
        // Show individual samples once zoomed in far enough to see them.
        if (d.length < plotW / 6) pts.push({ id: s.id, color, position: [x, y] });
      }
      flush();
    }
    return { segments: segs, dots: pts, rendered, source };
  }, [sampled, xOf, yOf, plotW]);

  React.useEffect(() => {
    onStats?.(panel.id, { source, rendered });
  }, [onStats, panel.id, source, rendered]);

  const layers = React.useMemo(
    () => [
      new PathLayer<Segment>({
        id: `${panel.id}-lines`,
        data: segments,
        positionFormat: "XY",
        getPath: (d) => d.path as unknown as [number, number][],
        getColor: (d) => d.color,
        getWidth: 1.5,
        widthUnits: "pixels",
        jointRounded: true,
        capRounded: true,
      }),
      new ScatterplotLayer<Dot>({
        id: `${panel.id}-dots`,
        data: dots,
        getPosition: (d) => d.position,
        getFillColor: (d) => d.color,
        getRadius: 2.5,
        radiusUnits: "pixels",
      }),
    ],
    [panel.id, segments, dots],
  );

  // Non-passive wheel listener so the page does not scroll while zooming.
  React.useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchor = start + ((e.clientX - rect.left) / rect.width) * span;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) onPan(e.deltaX / rect.width);
      else onZoom(Math.exp(e.deltaY * 0.0015), anchor);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [start, span, onZoom, onPan]);

  const timeAtClient = (clientX: number) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    return { x, t: start + (x / rect.width) * span };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x } = timeAtClient(e.clientX);
    dragRange.current = range;
    setDrag({ x0: x, x1: x, mode: e.shiftKey ? "select" : "pan" });
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const { x, t } = timeAtClient(e.clientX);
    onHover(t);
    if (!drag) return;
    setDrag({ ...drag, x1: x });
    if (drag.mode === "pan") {
      const dt = ((x - drag.x0) / plotW) * (dragRange.current[1] - dragRange.current[0]);
      onRange([dragRange.current[0] - dt, dragRange.current[1] - dt]);
    }
  };
  const onPointerUp = () => {
    if (drag?.mode === "select" && Math.abs(drag.x1 - drag.x0) > 4) {
      const [a, b] = [Math.min(drag.x0, drag.x1), Math.max(drag.x0, drag.x1)];
      const r = dragRange.current;
      const s = r[1] - r[0];
      onRange([r[0] + (a / plotW) * s, r[0] + (b / plotW) * s]);
    }
    setDrag(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const cursor = hoverTime ?? start + span / 2;
    switch (e.key) {
      case "ArrowLeft":
        if (e.shiftKey) onHover(Math.max(start, cursor - span / 100));
        else onPan(-0.1);
        break;
      case "ArrowRight":
        if (e.shiftKey) onHover(Math.min(end, cursor + span / 100));
        else onPan(0.1);
        break;
      case "+":
      case "=":
      case "ArrowUp":
        onZoom(0.8, cursor);
        break;
      case "-":
      case "_":
      case "ArrowDown":
        onZoom(1.25, cursor);
        break;
      case "Home":
      case "0":
        onReset();
        break;
      case "Escape":
        onHover(null);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const xTicks = React.useMemo(
    () => timeTicks(start, end, Math.max(2, Math.floor(plotW / 110))),
    [start, end, plotW],
  );
  const yTicks = React.useMemo(
    () => niceTicks(yMin, yMax, Math.max(2, Math.floor(plotH / 40))),
    [yMin, yMax, plotH],
  );

  const readout = React.useMemo(() => {
    if (hoverTime === null || hoverTime < start || hoverTime > end) return null;
    const rows = series.map((s) => {
      const i = nearestIndex(s.timestamps, hoverTime);
      const t = i >= 0 ? (s.timestamps[i] as number) : hoverTime;
      const v = i >= 0 ? (s.values[i] as number) : NaN;
      return { s, t, v };
    });
    return { t: rows[0]?.t ?? hoverTime, rows };
  }, [hoverTime, series, start, end]);

  const visibleAnnotations = annotations.filter(
    (a) => (!a.panel || a.panel === panel.id) && (a.endTime ?? a.time) >= start && a.time <= end,
  );
  const hoverX = readout ? xOf(readout.t) : null;

  return (
    <section
      className="relative border-b border-crm-border last:border-b-0"
      style={{ height }}
      aria-label={panel.title}
    >
      <div className="pointer-events-none absolute left-[60px] top-1 z-10 text-[11px] font-medium text-crm-muted-fg">
        {panel.title}
      </div>
      <svg className="absolute inset-0" width={width} height={height} aria-hidden>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {yTicks.map((v) => (
            <g key={v} transform={`translate(0,${yOf(v)})`}>
              <line x2={plotW} className="stroke-crm-border" strokeDasharray="2 3" />
              <text x={-8} dy="0.32em" textAnchor="end" className="fill-crm-muted-fg text-[10px]">
                {fmt(v)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text
              key={t}
              x={xOf(t)}
              y={plotH + 15}
              textAnchor="middle"
              className="fill-crm-muted-fg text-[10px]"
            >
              {timeLabel(t, span)}
            </text>
          ))}
          {visibleAnnotations.map((a) => {
            const x0 = Math.max(0, xOf(a.time));
            const x1 = a.endTime !== undefined ? Math.min(plotW, xOf(a.endTime)) : x0;
            const c = a.color ?? "#f59e0b";
            return (
              <g key={a.id}>
                {x1 > x0 && <rect x={x0} width={x1 - x0} height={plotH} fill={c} opacity={0.1} />}
                <line x1={x0} x2={x0} y2={plotH} stroke={c} strokeDasharray="4 3" />
              </g>
            );
          })}
          {!webgl &&
            segments.map((sg) => {
              let d = "";
              for (let i = 0; i < sg.path.length; i += 2)
                d += `${i ? "L" : "M"}${sg.path[i]!.toFixed(1)},${sg.path[i + 1]!.toFixed(1)}`;
              return (
                <path
                  key={sg.id}
                  d={d}
                  fill="none"
                  stroke={`rgb(${sg.color.join(",")})`}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
              );
            })}
        </g>
      </svg>
      {webgl && (
        <div
          className="absolute"
          style={{ left: MARGIN.left, top: MARGIN.top, width: plotW, height: plotH }}
        >
          <DeckGL
            views={VIEW}
            viewState={{ target: [plotW / 2, plotH / 2, 0], zoom: 0 }}
            controller={false}
            layers={layers}
            width={plotW}
            height={plotH}
            style={{ position: "absolute", left: "0", top: "0", pointerEvents: "none" }}
          />
        </div>
      )}
      <svg
        className="pointer-events-none absolute"
        style={{ left: MARGIN.left, top: MARGIN.top }}
        width={plotW}
        height={plotH}
        aria-hidden
      >
        {hoverX !== null && (
          <line x1={hoverX} x2={hoverX} y2={plotH} className="stroke-crm-fg" opacity={0.45} />
        )}
        {readout?.rows.map(({ s, v }) =>
          Number.isFinite(v) && hoverX !== null ? (
            <circle
              key={s.id}
              cx={hoverX}
              cy={yOf(v)}
              r={3.5}
              fill={s.color}
              className="stroke-crm-card"
              strokeWidth={1.5}
            />
          ) : null,
        )}
        {drag?.mode === "select" && (
          <rect
            x={Math.min(drag.x0, drag.x1)}
            width={Math.abs(drag.x1 - drag.x0)}
            height={plotH}
            className="fill-crm-primary"
            opacity={0.15}
          />
        )}
      </svg>
      <div
        ref={overlayRef}
        tabIndex={0}
        role="application"
        aria-roledescription="time series chart"
        aria-label={`${panel.title}, ${fullTime(start)} to ${fullTime(end)}`}
        aria-describedby={descId}
        className={cn(
          "absolute touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
          drag?.mode === "pan" ? "cursor-grabbing" : "cursor-crosshair",
        )}
        style={{ left: MARGIN.left, top: MARGIN.top, width: plotW, height: plotH }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        onPointerLeave={() => !drag && onHover(null)}
        onDoubleClick={onReset}
        onKeyDown={onKeyDown}
      />
      <span id={descId} className="sr-only">
        Drag to pan, Shift+drag to zoom to a selection, scroll or plus and minus to zoom, arrow keys
        to pan, Shift+arrows to move the crosshair, Home to reset.
      </span>
      {visibleAnnotations.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onAnnotation?.(a)}
          title={`${a.label} · ${fullTime(a.time)}`}
          className="absolute z-10 max-w-[140px] -translate-x-1/2 truncate rounded-full border border-crm-border bg-crm-popover px-1.5 py-px text-[10px] text-crm-fg shadow-crm-raised hover:bg-crm-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
          style={{
            left: MARGIN.left + Math.max(0, xOf(a.time)),
            top: MARGIN.top + plotH - 16,
          }}
        >
          {a.label}
        </button>
      ))}
      {readout && hoverX !== null && (
        <div
          className="pointer-events-none absolute z-20 min-w-[150px] rounded-crm border border-crm-border bg-crm-popover p-2 text-[11px] shadow-crm-raised"
          style={{
            top: MARGIN.top + 4,
            left:
              hoverX > plotW / 2
                ? MARGIN.left + hoverX - 162
                : MARGIN.left + Math.max(hoverX, 0) + 12,
          }}
        >
          <div className="mb-1 font-medium text-crm-fg">{fullTime(readout.t)}</div>
          {readout.rows.map(({ s, v }) => (
            <div key={s.id} className="flex items-center gap-2 text-crm-muted-fg">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              <span className="flex-1 truncate">{s.label}</span>
              <span className="tabular-nums text-crm-fg">
                {Number.isFinite(v) ? `${fmt(v)}${s.unit ? ` ${s.unit}` : ""}` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
});
