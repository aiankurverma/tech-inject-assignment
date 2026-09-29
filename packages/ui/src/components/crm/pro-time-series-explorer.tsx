import * as React from "react";
import { cn } from "@/lib/utils";
import { useElementSize } from "@/hooks/use-element-size";
import { useTimeRange } from "@/hooks/use-time-range";
import { ExplorerPanel, type PanelStats } from "@/components/crm/pro-time-series-explorer/panel";
import { OverviewBrush } from "@/components/crm/pro-time-series-explorer/overview-brush";
import { ExplorerToolbar } from "@/components/crm/pro-time-series-explorer/toolbar";
import { fullTime, hasWebGL2 } from "@/components/crm/pro-time-series-explorer/scale";
import {
  DEFAULT_PRESETS,
  SERIES_PALETTE,
  type RangePreset,
  type TimeAnnotation,
  type TimeRange,
  type TimeSeries,
  type TimeSeriesPanel,
} from "@/components/crm/pro-time-series-explorer/types";

export type {
  RangePreset,
  TimeAnnotation,
  TimeRange,
  TimeSeries,
  TimeSeriesPanel,
} from "@/components/crm/pro-time-series-explorer/types";

export interface ProTimeSeriesExplorerProps {
  series: TimeSeries[];
  /** Stacked panels sharing one time axis and crosshair. Defaults to a single panel. */
  panels?: TimeSeriesPanel[];
  annotations?: TimeAnnotation[];
  /** Controlled visible window (epoch ms). */
  range?: TimeRange;
  defaultRange?: TimeRange;
  onRangeChange?: (range: TimeRange) => void;
  /** Controlled list of visible series ids. */
  visibleSeries?: string[];
  defaultVisibleSeries?: string[];
  onVisibleSeriesChange?: (ids: string[]) => void;
  presets?: RangePreset[];
  /** Rendered points per pixel column after LTTB. Default 1.5. */
  density?: number;
  /** "auto" uses WebGL (deck.gl) when available and falls back to SVG. */
  renderer?: "auto" | "webgl" | "svg";
  /** Smallest zoom window in ms. Default 1000. */
  minSpan?: number;
  showOverview?: boolean;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  onAnnotationClick?: (annotation: TimeAnnotation) => void;
  title?: string;
  className?: string;
}

const DEFAULT_PANEL: TimeSeriesPanel = { id: "main", title: "Series" };

export function ProTimeSeriesExplorer({
  series,
  panels: panelsProp,
  annotations = [],
  range: rangeProp,
  defaultRange,
  onRangeChange,
  visibleSeries,
  defaultVisibleSeries,
  onVisibleSeriesChange,
  presets = DEFAULT_PRESETS,
  density = 1.5,
  renderer = "auto",
  minSpan = 1000,
  showOverview = true,
  loading,
  error,
  emptyMessage = "No data in this time range yet.",
  onAnnotationClick,
  title,
  className,
}: ProTimeSeriesExplorerProps) {
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>();
  const panels = React.useMemo(
    () => (panelsProp?.length ? panelsProp : [DEFAULT_PANEL]),
    [panelsProp],
  );

  const colored = React.useMemo(
    () =>
      series.map((s, i) => ({
        ...s,
        color: s.color ?? SERIES_PALETTE[i % SERIES_PALETTE.length]!,
        panel: s.panel ?? panels[0]!.id,
      })),
    [series, panels],
  );

  const extent = React.useMemo<TimeRange>(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of series) {
      const n = s.timestamps.length;
      if (!n) continue;
      lo = Math.min(lo, s.timestamps[0] as number);
      hi = Math.max(hi, s.timestamps[n - 1] as number);
    }
    return Number.isFinite(lo) ? [lo, hi > lo ? hi : lo + 1] : [0, 1];
  }, [series]);

  const { range, setRange, zoom, pan } = useTimeRange({
    extent,
    value: rangeProp,
    defaultValue: defaultRange,
    onChange: onRangeChange,
    minSpan,
  });

  const [innerVisible, setInnerVisible] = React.useState<string[]>(
    () => defaultVisibleSeries ?? series.map((s) => s.id),
  );
  const visible = visibleSeries ?? innerVisible;
  const setVisible = React.useCallback(
    (ids: string[]) => {
      if (visibleSeries === undefined) setInnerVisible(ids);
      onVisibleSeriesChange?.(ids);
    },
    [visibleSeries, onVisibleSeriesChange],
  );

  const [hoverTime, setHoverTime] = React.useState<number | null>(null);
  const [stats, setStats] = React.useState<Record<string, PanelStats>>({});
  const onStats = React.useCallback((id: string, s: PanelStats) => {
    setStats((prev) =>
      prev[id]?.source === s.source && prev[id]?.rendered === s.rendered
        ? prev
        : { ...prev, [id]: s },
    );
  }, []);

  const [webgl, setWebgl] = React.useState(false);
  React.useEffect(() => {
    setWebgl(renderer === "webgl" || (renderer === "auto" && hasWebGL2()));
  }, [renderer]);

  const reset = React.useCallback(() => setRange(extent), [setRange, extent]);

  const activePreset = React.useMemo(() => {
    const span = range[1] - range[0];
    const tol = Math.max((extent[1] - extent[0]) * 0.002, 1000);
    const atEnd = Math.abs(range[1] - extent[1]) <= tol;
    const hit = presets.find((p) =>
      p.duration === null
        ? Math.abs(range[0] - extent[0]) <= tol && atEnd
        : atEnd && Math.abs(span - Math.min(p.duration, extent[1] - extent[0])) <= tol,
    );
    return hit?.id ?? "";
  }, [presets, range, extent]);

  const onPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setRange(p.duration === null ? extent : [extent[1] - p.duration, extent[1]]);
  };

  const onAnnotation = React.useCallback(
    (a: TimeAnnotation) => {
      const span = range[1] - range[0];
      const center = a.endTime !== undefined ? (a.time + a.endTime) / 2 : a.time;
      const w = a.endTime !== undefined ? Math.max((a.endTime - a.time) * 3, minSpan) : span / 4;
      setRange([center - w / 2, center + w / 2]);
      setHoverTime(a.time);
      onAnnotationClick?.(a);
    },
    [range, setRange, minSpan, onAnnotationClick],
  );

  const visibleSeriesList = React.useMemo(
    () => colored.filter((s) => visible.includes(s.id)),
    [colored, visible],
  );
  const byPanel = React.useMemo(() => {
    const m = new Map<string, typeof visibleSeriesList>();
    for (const p of panels) m.set(p.id, []);
    for (const s of visibleSeriesList) (m.get(s.panel) ?? m.get(panels[0]!.id)!).push(s);
    return m;
  }, [panels, visibleSeriesList]);

  const totals = Object.entries(stats)
    .filter(([id]) => byPanel.has(id))
    .reduce((a, [, s]) => ({ source: a.source + s.source, rendered: a.rendered + s.rendered }), {
      source: 0,
      rendered: 0,
    });
  const totalPoints = React.useMemo(
    () => series.reduce((n, s) => n + s.timestamps.length, 0),
    [series],
  );
  const empty = !loading && !error && totalPoints === 0;
  const blocked = loading || !!error || empty;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-crm border border-crm-border bg-crm-card text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      {title && (
        <div className="flex items-baseline justify-between gap-3 px-3 pt-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          {!blocked && (
            <span className="text-[11px] tabular-nums text-crm-muted-fg">
              {totalPoints.toLocaleString()} samples · {webgl ? "WebGL" : "SVG"}
            </span>
          )}
        </div>
      )}
      <ExplorerToolbar
        presets={presets}
        activePreset={activePreset}
        onPreset={onPreset}
        series={colored}
        visible={visible}
        onVisible={setVisible}
        onZoomIn={() => zoom(0.5)}
        onZoomOut={() => zoom(2)}
        onReset={reset}
        disabled={blocked}
      />
      <div ref={wrapRef} className="relative">
        {loading ? (
          <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading series">
            {panels.map((p) => (
              <div
                key={p.id}
                className="animate-pulse rounded-crm bg-crm-soft"
                style={{ height: (p.height ?? 180) - 16 }}
              />
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex h-48 items-center justify-center p-6 text-sm text-crm-danger"
          >
            {error}
          </div>
        ) : empty ? (
          <div className="flex h-48 items-center justify-center p-6 text-sm text-crm-muted-fg">
            {emptyMessage}
          </div>
        ) : (
          width > 0 && (
            <>
              {panels.map((p) => (
                <ExplorerPanel
                  key={p.id}
                  panel={p}
                  series={byPanel.get(p.id) ?? []}
                  width={width}
                  range={range}
                  hoverTime={hoverTime}
                  annotations={annotations}
                  webgl={webgl}
                  density={density}
                  onHover={setHoverTime}
                  onRange={setRange}
                  onZoom={zoom}
                  onPan={pan}
                  onReset={reset}
                  onAnnotation={onAnnotation}
                  onStats={onStats}
                />
              ))}
              {showOverview && (
                <div className="border-t border-crm-border bg-crm-bg/40 pt-2">
                  <OverviewBrush
                    series={visibleSeriesList.length ? visibleSeriesList : colored}
                    extent={extent}
                    range={range}
                    width={width}
                    onRange={setRange}
                  />
                </div>
              )}
            </>
          )
        )}
      </div>
      {!blocked && (
        <div className="flex flex-wrap justify-between gap-2 border-t border-crm-border px-3 py-1.5 text-[11px] text-crm-muted-fg">
          <span aria-live="polite">
            {fullTime(range[0])} – {fullTime(range[1])}
          </span>
          <span className="tabular-nums">
            {totals.source.toLocaleString()} in view → {totals.rendered.toLocaleString()} drawn
            (LTTB)
          </span>
        </div>
      )}
    </div>
  );
}
