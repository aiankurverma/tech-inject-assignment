import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  ChevronsDownUp,
  ChevronsUpDown,
  Loader2,
  Route,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { flattenVisible, useSpanTree } from "@/hooks/use-span-tree";
import { SpanRow } from "@/components/crm/pro-trace-waterfall/span-row";
import { SpanDrawer } from "@/components/crm/pro-trace-waterfall/span-drawer";
import {
  TimelineOverview,
  type TimelineOverviewHandle,
} from "@/components/crm/pro-trace-waterfall/timeline-overview";
import {
  FULL_WINDOW,
  formatDuration,
  makeScale,
  ticks,
  type ViewWindow,
} from "@/components/crm/pro-trace-waterfall/time-scale";
import type { TraceSpan } from "@/components/crm/pro-trace-waterfall/types";

export type { TraceSpan, SpanAttributeValue } from "@/components/crm/pro-trace-waterfall/types";

export interface ProTraceWaterfallProps {
  spans: TraceSpan[];
  traceId?: string;
  title?: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Span ids collapsed initially (uncontrolled). */
  defaultCollapsedIds?: string[];
  /** Controlled collapse state. */
  collapsedIds?: string[];
  onCollapsedChange?: (ids: string[]) => void;
  /** Controlled selection (keyboard / click focus, not the drawer). */
  selectedSpanId?: string | null;
  onSelectedSpanChange?: (id: string | null) => void;
  /** Highlight the critical path initially. */
  defaultShowCriticalPath?: boolean;
  /** Override the per-service colour (any CSS colour). */
  serviceColor?: (service: string, index: number) => string;
  rowHeight?: number;
  labelWidth?: number;
  height?: number;
  className?: string;
}

const PALETTE = [
  "var(--color-tag-blue-text)",
  "var(--color-tag-purple-text)",
  "var(--color-tag-green-text)",
  "var(--color-tag-orange-text)",
  "var(--color-tag-yellow-text)",
  "var(--color-tag-teal-text)",
  "var(--color-tag-amber-text)",
  "var(--color-tag-red-text)",
];

const iconBtn =
  "inline-flex items-center gap-1 rounded-md border border-crm-border px-2 py-1 text-xs text-crm-soft hover:bg-crm-raised hover:text-crm-fg aria-pressed:bg-crm-muted aria-pressed:text-crm-fg disabled:opacity-40";

/** Jaeger-style span waterfall: collapsible tree, zoom / pan axis, critical path, attribute drawer. */
export function ProTraceWaterfall({
  spans,
  traceId,
  title = "Trace",
  loading = false,
  error = null,
  onRetry,
  defaultCollapsedIds,
  collapsedIds,
  onCollapsedChange,
  selectedSpanId,
  onSelectedSpanChange,
  defaultShowCriticalPath = true,
  serviceColor,
  rowHeight = 26,
  labelWidth = 340,
  height = 640,
  className,
}: ProTraceWaterfallProps) {
  const { tree, critical } = useSpanTree(spans);

  const [innerCollapsed, setInnerCollapsed] = useState(() => new Set(defaultCollapsedIds));
  const collapsed = useMemo(
    () => (collapsedIds ? new Set(collapsedIds) : innerCollapsed),
    [collapsedIds, innerCollapsed],
  );
  const setCollapsed = useCallback(
    (next: Set<string>) => {
      if (!collapsedIds) setInnerCollapsed(next);
      onCollapsedChange?.([...next]);
    },
    [collapsedIds, onCollapsedChange],
  );

  const [innerSel, setInnerSel] = useState<string | null>(null);
  const selected = selectedSpanId !== undefined ? selectedSpanId : innerSel;
  const select = useCallback(
    (id: string | null) => {
      if (selectedSpanId === undefined) setInnerSel(id);
      onSelectedSpanChange?.(id);
    },
    [selectedSpanId, onSelectedSpanChange],
  );

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [showCritical, setShowCritical] = useState(defaultShowCriticalPath);
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const [view, setView] = useState<ViewWindow>(FULL_WINDOW);
  const overview = useRef<TimelineOverviewHandle>(null);

  const rows = useMemo(() => flattenVisible(tree.roots, collapsed), [tree, collapsed]);
  /** Overview always shows every span in tree order, independent of collapse state. */
  const allRows = useMemo(() => flattenVisible(tree.roots, new Set()), [tree]);
  const rowIndex = useMemo(() => new Map(rows.map((r, i) => [r.span.spanId, i])), [rows]);

  const colors = useMemo(() => {
    const m = new Map<string, string>();
    tree.services.forEach((s, i) => m.set(s, serviceColor?.(s, i) ?? PALETTE[i % PALETTE.length]!));
    return m;
  }, [tree.services, serviceColor]);

  // Search matches over *all* spans; ancestors of hits are expanded on "next match".
  const matches = useMemo(() => {
    if (!q) return null;
    const ids: string[] = [];
    for (const s of spans)
      if (
        s.name.toLowerCase().includes(q) ||
        s.service.toLowerCase().includes(q) ||
        s.spanId.toLowerCase().startsWith(q)
      )
        ids.push(s.spanId);
    ids.sort((a, b) => tree.byId.get(a)!.span.startTime - tree.byId.get(b)!.span.startTime);
    return { ids, set: new Set(ids) };
  }, [q, spans, tree]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 16,
  });

  const reveal = useCallback(
    (id: string) => {
      const node = tree.byId.get(id);
      if (!node) return;
      let needs = false;
      const next = new Set(collapsed);
      for (let p = node.parent; p; p = p.parent) if (next.delete(p.span.spanId)) needs = true;
      if (needs) setCollapsed(next);
      select(id);
      // Scroll after the collapse change has re-flattened the rows.
      requestAnimationFrame(() => {
        const i = flattenVisible(tree.roots, next).findIndex((r) => r.span.spanId === id);
        if (i >= 0) virtualizer.scrollToIndex(i, { align: "center" });
      });
    },
    [tree, collapsed, setCollapsed, select, virtualizer],
  );

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(collapsed);
      if (!next.delete(id)) next.add(id);
      setCollapsed(next);
    },
    [collapsed, setCollapsed],
  );

  const zoomToSpan = useCallback(
    (id: string) => {
      const n = tree.byId.get(id);
      if (!n) return;
      const total = tree.traceEnd - tree.traceStart;
      const pad = Math.max(n.span.duration * 0.08, total * 0.0005);
      overview.current?.focus({
        start: Math.max(0, (n.span.startTime - pad - tree.traceStart) / total),
        end: Math.min(1, (n.end + pad - tree.traceStart) / total),
      });
    },
    [tree],
  );

  const open = useCallback((id: string) => setDrawerId(id), []);

  const matchPos = matches && selected ? matches.ids.indexOf(selected) : -1;
  const nextMatch = (dir: 1 | -1) => {
    if (!matches?.ids.length) return;
    const i = (matchPos + dir + matches.ids.length) % matches.ids.length;
    reveal(matches.ids[i]!);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = selected ? (rowIndex.get(selected) ?? -1) : -1;
    const node = selected ? tree.byId.get(selected) : undefined;
    const go = (j: number) => {
      const r = rows[Math.max(0, Math.min(rows.length - 1, j))];
      if (!r) return;
      select(r.span.spanId);
      virtualizer.scrollToIndex(rowIndex.get(r.span.spanId)!, { align: "auto" });
    };
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 300) / rowHeight) - 1);
    switch (e.key) {
      case "ArrowDown":
        go(i + 1);
        break;
      case "ArrowUp":
        go(i < 0 ? 0 : i - 1);
        break;
      case "PageDown":
        go(i + page);
        break;
      case "PageUp":
        go(i - page);
        break;
      case "Home":
        go(0);
        break;
      case "End":
        go(rows.length - 1);
        break;
      case "ArrowRight":
        if (!node) return go(0);
        if (node.children.length && collapsed.has(node.span.spanId)) toggle(node.span.spanId);
        else if (node.children.length) go(i + 1);
        break;
      case "ArrowLeft":
        if (!node) return;
        if (node.children.length && !collapsed.has(node.span.spanId)) toggle(node.span.spanId);
        else if (node.parent) go(rowIndex.get(node.parent.span.spanId) ?? i);
        break;
      case "Enter":
        if (node) open(node.span.spanId);
        break;
      case "z":
        if (node) zoomToSpan(node.span.spanId);
        break;
      case "+":
      case "=":
        overview.current?.zoomIn();
        break;
      case "-":
        overview.current?.zoomOut();
        break;
      case "0":
        overview.current?.reset();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  // Keep the controlled selection visible if it arrives from outside.
  useEffect(() => {
    if (selected && rowIndex.has(selected))
      virtualizer.scrollToIndex(rowIndex.get(selected)!, { align: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpanId]);

  const scale = makeScale(tree.traceStart, tree.traceEnd, view);
  const axisTicks = ticks(tree.traceStart, scale.t0, scale.t1);
  const total = tree.traceEnd - tree.traceStart;
  const zoomed = view.end - view.start < 0.999;
  const drawerNode = drawerId ? (tree.byId.get(drawerId) ?? null) : null;

  const shell = cn(
    "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
    className,
  );

  if (error)
    return (
      <div
        role="alert"
        className={cn(shell, "items-center justify-center gap-3 p-8 text-center")}
        style={{ height }}
      >
        <AlertTriangle className="size-6 text-crm-danger" />
        <p className="text-sm">Could not load trace</p>
        <p className="max-w-sm text-xs text-crm-muted-fg">{error}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className={iconBtn}>
            Try again
          </button>
        )}
      </div>
    );

  if (loading || spans.length === 0)
    return (
      <div className={cn(shell, "p-4")} style={{ height }} aria-busy={loading}>
        {loading ? (
          <>
            <span className="inline-flex items-center gap-2 text-xs text-crm-muted-fg">
              <Loader2 className="size-3.5 animate-spin" /> Loading spans…
            </span>
            <div className="mt-3 space-y-1.5">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="flex h-5 items-center gap-3">
                  <div
                    className="h-3 animate-pulse rounded bg-crm-raised"
                    style={{ width: labelWidth - i * 8 }}
                  />
                  <div
                    className="h-3 animate-pulse rounded bg-crm-raised"
                    style={{ marginLeft: `${i * 4}%`, width: `${40 - i * 2}%` }}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="m-auto text-sm text-crm-muted-fg">This trace has no spans.</p>
        )}
      </div>
    );

  return (
    <div className={shell} style={{ height }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-crm-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-crm-muted-fg">
            {traceId && <span className="font-mono">{traceId}</span>}
            <span>{formatDuration(total)}</span>
            <span>{spans.length.toLocaleString()} spans</span>
            <span>{tree.services.length} services</span>
            <span>depth {tree.maxDepth + 1}</span>
            {tree.errorCount > 0 && (
              <span className="text-crm-danger">{tree.errorCount} errors</span>
            )}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-md border border-crm-input bg-crm-bg px-2 focus-within:border-crm-ring">
            <Search className="size-3.5 text-crm-muted-fg" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  nextMatch(e.shiftKey ? -1 : 1);
                }
              }}
              placeholder="Find span or service"
              aria-label="Find span"
              className="w-40 bg-transparent py-1 text-xs outline-none placeholder:text-crm-subtle"
            />
            {matches && (
              <span
                className="shrink-0 text-[11px] tabular-nums text-crm-muted-fg"
                aria-live="polite"
              >
                {matchPos >= 0 ? `${matchPos + 1}/` : ""}
                {matches.ids.length}
              </span>
            )}
          </div>
          <button
            type="button"
            aria-pressed={showCritical}
            onClick={() => setShowCritical((v) => !v)}
            className={iconBtn}
          >
            <Route className="size-3.5" /> Critical path
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(new Set())}
            className={iconBtn}
            aria-label="Expand all"
          >
            <ChevronsUpDown className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Collapse all"
            className={iconBtn}
            onClick={() =>
              setCollapsed(
                new Set(
                  tree.roots.flatMap((r) =>
                    r.children.filter((c) => c.children.length).map((c) => c.span.spanId),
                  ),
                ),
              )
            }
          >
            <ChevronsDownUp className="size-3.5" />
          </button>
          <span className="mx-1 h-5 w-px bg-crm-border" aria-hidden />
          <button
            type="button"
            aria-label="Zoom out"
            className={iconBtn}
            onClick={() => overview.current?.zoomOut()}
            disabled={!zoomed}
          >
            <ZoomOut className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            className={iconBtn}
            onClick={() => overview.current?.zoomIn()}
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Reset zoom"
            className={iconBtn}
            onClick={() => overview.current?.reset()}
            disabled={!zoomed}
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex border-b border-crm-border">
        <div
          className="flex shrink-0 flex-col justify-end border-r border-crm-border px-3 pb-1 text-[10px] text-crm-muted-fg"
          style={{ width: labelWidth }}
        >
          <span>Scroll or pinch the strip to zoom, drag to pan, double-click to reset.</span>
          <span>
            Window +{formatDuration(scale.t0 - tree.traceStart)} to +
            {formatDuration(scale.t1 - tree.traceStart)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <TimelineOverview
            ref={overview}
            lanes={allRows}
            traceStart={tree.traceStart}
            traceEnd={tree.traceEnd}
            onWindowChange={setView}
          />
          <div className="relative h-5 border-t border-crm-border" aria-hidden>
            {axisTicks.map((t) => {
              const left = scale.pct(tree.traceStart + t);
              return (
                <span
                  key={t}
                  className="absolute top-0 h-full border-l border-crm-border pl-1 text-[10px] tabular-nums text-crm-muted-fg"
                  style={{ left: `${left}%` }}
                >
                  {formatDuration(t)}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div
        role="treegrid"
        aria-label={typeof title === "string" ? `${title} spans` : "Trace spans"}
        aria-rowcount={rows.length}
        aria-activedescendant={selected ? `span-${selected}` : undefined}
        tabIndex={0}
        onKeyDown={onKeyDown}
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-crm-ring"
      >
        <div
          className="pointer-events-none absolute inset-y-0 right-0"
          style={{ left: labelWidth }}
          aria-hidden
        >
          {axisTicks.map((t) => (
            <span
              key={t}
              className="absolute inset-y-0 border-l border-crm-border/50"
              style={{ left: `${scale.pct(tree.traceStart + t)}%` }}
            />
          ))}
        </div>
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((v) => {
            const n = rows[v.index]!;
            const id = n.span.spanId;
            return (
              <SpanRow
                key={id}
                node={n}
                top={v.start}
                height={rowHeight}
                labelWidth={labelWidth}
                t0={scale.t0}
                span={scale.span}
                color={colors.get(n.span.service)!}
                collapsed={collapsed.has(id)}
                active={id === selected}
                dimmed={!!matches && !matches.set.has(id)}
                critical={showCritical ? critical.get(id) : undefined}
                onToggle={toggle}
                onActivate={select}
                onOpen={open}
              />
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-crm-border px-4 py-1.5 text-[11px] text-crm-muted-fg">
        {tree.services.map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm" style={{ background: colors.get(s) }} aria-hidden />
            {s}
          </span>
        ))}
        <span className="ml-auto">
          ↑↓ move · ←→ collapse · Enter details · z zoom to span · +/−/0 zoom
        </span>
      </div>

      <SpanDrawer
        node={drawerNode}
        traceStart={tree.traceStart}
        onOpenChange={(o) => !o && setDrawerId(null)}
        onFocusSpan={(id) => {
          reveal(id);
          setDrawerId(id);
        }}
      />
    </div>
  );
}
