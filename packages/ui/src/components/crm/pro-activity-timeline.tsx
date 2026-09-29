import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientContext, QueryClientProvider } from "@tanstack/react-query";
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import { AlertTriangle, ChevronDown, Inbox, Loader2, Pin, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { createLocalActivitySource, useActivityFeed } from "@/hooks/use-activity-feed";
import { useControllableState } from "@/hooks/use-controllable-state";
import { ActivityItem } from "@/components/crm/pro-activity-timeline/activity-item";
import { TimelineToolbar } from "@/components/crm/pro-activity-timeline/timeline-toolbar";
import {
  ACTIVITY_TYPES,
  type ActivityType,
  type FetchActivityPage,
  type TimeMode,
  type TimelineActivity,
} from "@/components/crm/pro-activity-timeline/types";

export * from "@/components/crm/pro-activity-timeline/types";
export { createLocalActivitySource } from "@/hooks/use-activity-feed";

export interface ProActivityTimelineProps {
  /** Cache key for this feed, e.g. ["account", accountId, "activity"]. */
  queryKey: readonly unknown[];
  /** Server cursor source. Either this or `items` is required. */
  fetchPage?: FetchActivityPage;
  /** In-memory data; paged locally with the same code path as `fetchPage`. */
  items?: TimelineActivity[];
  /** Local mode only: open the feed at this moment so newer and older both page in. */
  anchor?: Date;
  /** Activity types offered in the filter bar. */
  availableTypes?: readonly ActivityType[];
  types?: ActivityType[];
  defaultTypes?: ActivityType[];
  onTypesChange?: (types: ActivityType[]) => void;
  timeMode?: TimeMode;
  defaultTimeMode?: TimeMode;
  onTimeModeChange?: (mode: TimeMode) => void;
  pinnedIds?: string[];
  defaultPinnedIds?: string[];
  onPinnedIdsChange?: (ids: string[]) => void;
  /** Items that are pinned but may not be in the loaded window (server usually returns them separately). */
  pinnedItems?: TimelineActivity[];
  /** Height of the scroll viewport. Default 560. */
  height?: number | string;
  /** Accessible name of the feed. */
  label?: string;
  emptyState?: ReactNode;
  /** Use a specific QueryClient; otherwise the nearest provider, or a private one. */
  queryClient?: QueryClient;
  className?: string;
}

/** Unified email / call / meeting / note / stage feed with bidirectional virtualised paging. */
export function ProActivityTimeline({ queryClient, ...props }: ProActivityTimelineProps) {
  const ctx = useContext(QueryClientContext);
  const [own] = useState(() => (queryClient || ctx ? null : new QueryClient()));
  const client = queryClient ?? own;
  if (client)
    return (
      <QueryClientProvider client={client}>
        <Timeline {...props} />
      </QueryClientProvider>
    );
  return <Timeline {...props} />;
}

const ROW_ESTIMATE = { day: 36, item: 76 } as const;

function Timeline({
  queryKey,
  fetchPage,
  items,
  anchor,
  availableTypes = ACTIVITY_TYPES,
  types: typesProp,
  defaultTypes,
  onTypesChange,
  timeMode: timeModeProp,
  defaultTimeMode = "relative",
  onTimeModeChange,
  pinnedIds: pinnedProp,
  defaultPinnedIds = [],
  onPinnedIdsChange,
  pinnedItems = [],
  height = 560,
  label = "Activity",
  emptyState,
  className,
}: Omit<ProActivityTimelineProps, "queryClient">) {
  const [types, setTypes] = useControllableState(
    typesProp,
    defaultTypes ?? [...availableTypes],
    onTypesChange,
  );
  const [timeMode, setTimeMode] = useControllableState(
    timeModeProp,
    defaultTimeMode,
    onTimeModeChange,
  );
  const [pinnedIds, setPinnedIds] = useControllableState(
    pinnedProp,
    defaultPinnedIds,
    onPinnedIdsChange,
  );
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const source = useMemo<FetchActivityPage>(
    () => fetchPage ?? createLocalActivitySource(items ?? [], { anchor }),
    [fetchPage, items, anchor],
  );
  const feed = useActivityFeed({ queryKey, fetchPage: source, types, enabled: types.length > 0 });
  const { rows } = feed;

  // Everything we have ever seen, so pinned items stay resolvable after filters change.
  const seen = useRef(new Map<string, TimelineActivity>());
  for (const it of pinnedItems) if (!seen.current.has(it.id)) seen.current.set(it.id, it);
  for (const it of feed.items) seen.current.set(it.id, it);
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  const pinned = pinnedIds
    .map((id) => seen.current.get(id))
    .filter((x): x is TimelineActivity => !!x);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const pinnedRef = useRef(pinnedIds);
  pinnedRef.current = pinnedIds;
  const togglePin = useCallback(
    (id: string) => {
      const cur = pinnedRef.current;
      setPinnedIds(cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur]);
    },
    [setPinnedIds],
  );

  // ---- virtualisation with sticky day headers ----
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickyIndexes = useMemo(
    () => rows.reduce<number[]>((acc, r, i) => (r.kind === "day" ? (acc.push(i), acc) : acc), []),
    [rows],
  );
  const activeSticky = useRef(0);
  const rangeExtractor = useCallback(
    (range: Range) => {
      // binary search: last day header at or above the first visible row
      let lo = 0;
      let hi = stickyIndexes.length - 1;
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (stickyIndexes[mid]! <= range.startIndex) {
          found = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      activeSticky.current = found >= 0 ? stickyIndexes[found]! : -1;
      const next = new Set(defaultRangeExtractor(range));
      if (activeSticky.current >= 0) next.add(activeSticky.current);
      return [...next].sort((a, b) => a - b);
    },
    [stickyIndexes],
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => ROW_ESTIMATE[rows[i]?.kind ?? "item"],
    getItemKey: (i) => rows[i]?.key ?? i,
    overscan: 8,
    rangeExtractor,
  });
  const virtualItems = virtualizer.getVirtualItems();

  // Keep the viewport steady when newer activity is prepended above it.
  const firstKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    const prev = firstKey.current;
    firstKey.current = rows[0]?.key ?? null;
    if (!prev || prev === rows[0]?.key) return;
    const k = rows.findIndex((r) => r.key === prev);
    const el = scrollRef.current;
    if (k <= 0 || !el) return;
    const start = virtualizer.measurementsCache[k]?.start ?? 0;
    virtualizer.scrollToOffset(el.scrollTop + start);
  }, [rows, virtualizer]);

  // Page in either direction as the viewport nears an edge.
  const firstVisible = virtualItems.find((v) => v.index !== activeSticky.current)?.index ?? 0;
  const lastVisible = virtualItems.at(-1)?.index ?? 0;
  const {
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
  } = feed;
  const canPage = !feed.isFetchNextPageError && !feed.isFetchPreviousPageError;
  useEffect(() => {
    if (!rows.length || !canPage) return;
    if (lastVisible >= rows.length - 6 && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [lastVisible, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage, canPage]);
  useEffect(() => {
    if (!rows.length || !canPage) return;
    if (firstVisible <= 3 && hasPreviousPage && !isFetchingPreviousPage) void fetchPreviousPage();
  }, [
    firstVisible,
    rows.length,
    hasPreviousPage,
    isFetchingPreviousPage,
    fetchPreviousPage,
    canPage,
  ]);

  // ---- feed keyboard pattern (WAI-ARIA APG "feed"): PageUp/PageDown move between articles ----
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => r.kind === "item" && m.set(r.key, i));
    return m;
  }, [rows]);
  const pendingFocus = useRef<string | null>(null);
  const focusArticle = useCallback((id: string) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(
      `[data-activity-id="${CSS.escape(id)}"]`,
    );
    if (el) {
      el.focus({ preventScroll: true });
      pendingFocus.current = null;
    } else pendingFocus.current = id;
  }, []);
  useEffect(() => {
    if (pendingFocus.current) focusArticle(pendingFocus.current);
  });
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["PageDown", "PageUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const art = (e.target as HTMLElement).closest<HTMLElement>("[data-activity-id]");
    const itemRows = feed.items;
    if (!itemRows.length) return;
    const cur = art ? itemRows.findIndex((x) => x.id === art.dataset.activityId) : -1;
    let target = cur;
    if (e.key === "PageDown") target = Math.min(itemRows.length - 1, cur + 1);
    else if (e.key === "PageUp") target = Math.max(0, cur - 1);
    else if (e.key === "Home" && e.ctrlKey) target = 0;
    else if (e.key === "End" && e.ctrlKey) target = itemRows.length - 1;
    else return;
    e.preventDefault();
    const id = itemRows[target]!.id;
    virtualizer.scrollToIndex(indexById.get(id) ?? 0, { align: "auto" });
    focusArticle(id);
  };

  const [pinnedOpen, setPinnedOpen] = useState(true);
  const setsize = hasNextPage || hasPreviousPage ? -1 : feed.items.length;

  let body: ReactNode;
  if (types.length === 0) {
    body = (
      <State icon={<Inbox className="size-5" />} title="No activity types selected">
        <button type="button" className={linkBtn} onClick={() => setTypes([...availableTypes])}>
          Show all types
        </button>
      </State>
    );
  } else if (feed.isPending) {
    body = <Skeleton />;
  } else if (feed.isError && !rows.length) {
    body = (
      <State
        icon={<AlertTriangle className="size-5 text-crm-danger" />}
        title="Couldn't load activity"
        role="alert"
      >
        <p className="text-xs text-crm-muted-fg">{feed.error.message}</p>
        <button type="button" className={linkBtn} onClick={() => void feed.refetch()}>
          <RotateCw className="size-3.5" /> Try again
        </button>
      </State>
    );
  } else if (!rows.length) {
    body = emptyState ?? (
      <State icon={<Inbox className="size-5" />} title="No activity yet">
        {types.length < availableTypes.length && (
          <button type="button" className={linkBtn} onClick={() => setTypes([...availableTypes])}>
            Clear filters
          </button>
        )}
      </State>
    );
  }

  return (
    <section
      aria-label={label}
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <TimelineToolbar
        available={availableTypes}
        types={types}
        onTypesChange={setTypes}
        timeMode={timeMode}
        onTimeModeChange={setTimeMode}
        loadedCount={feed.items.length}
        fetching={feed.isFetching && !isFetchingNextPage && !isFetchingPreviousPage}
      />

      {pinned.length > 0 && (
        <div className="border-b border-crm-border bg-crm-bg/40">
          <button
            type="button"
            aria-expanded={pinnedOpen}
            onClick={() => setPinnedOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left crm-eyebrow text-crm-muted-fg hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-crm-ring"
          >
            <Pin className="size-3 text-crm-warning" aria-hidden />
            Pinned ({pinned.length})
            <ChevronDown
              className={cn("ml-auto size-3.5 transition-transform", !pinnedOpen && "-rotate-90")}
              aria-hidden
            />
          </button>
          {pinnedOpen && (
            <div className="max-h-48 overflow-y-auto px-1 pb-1">
              {pinned.map((it, i) => (
                <ActivityItem
                  key={it.id}
                  item={it}
                  posinset={i + 1}
                  setsize={pinned.length}
                  timeMode={timeMode}
                  now={now}
                  expanded={expanded.has(it.id)}
                  pinned
                  onToggleExpanded={toggleExpanded}
                  onTogglePin={togglePin}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        className="relative overflow-y-auto overscroll-contain"
        style={{ height }}
      >
        {body ?? (
          <>
            {isFetchingPreviousPage && <EdgeLoader label="Loading newer activity" />}
            {feed.isFetchPreviousPageError && (
              <EdgeError
                label="Couldn't load newer activity"
                onRetry={() => void fetchPreviousPage()}
              />
            )}
            <div
              role="feed"
              aria-label={label}
              aria-busy={feed.isFetching}
              onKeyDown={onKeyDown}
              className="relative w-full"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualItems.map((v) => {
                const row = rows[v.index]!;
                const isSticky = v.index === activeSticky.current;
                return (
                  <div
                    key={v.key}
                    data-index={v.index}
                    ref={virtualizer.measureElement}
                    className={cn(
                      "left-0 w-full",
                      isSticky ? "sticky top-0 z-10" : "absolute top-0",
                    )}
                    style={isSticky ? undefined : { transform: `translateY(${v.start}px)` }}
                  >
                    {row.kind === "day" ? (
                      <h3 className="flex h-9 items-center gap-2 border-b border-crm-border/60 bg-crm-card/95 px-4 text-xs font-semibold text-crm-soft backdrop-blur">
                        {row.label}
                      </h3>
                    ) : (
                      <div className="px-1">
                        <ActivityItem
                          item={row.item}
                          posinset={row.index + 1}
                          setsize={setsize}
                          timeMode={timeMode}
                          now={now}
                          expanded={expanded.has(row.item.id)}
                          pinned={pinnedSet.has(row.item.id)}
                          onToggleExpanded={toggleExpanded}
                          onTogglePin={togglePin}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {isFetchingNextPage && <EdgeLoader label="Loading older activity" />}
            {feed.isFetchNextPageError && (
              <EdgeError
                label="Couldn't load older activity"
                onRetry={() => void fetchNextPage()}
              />
            )}
            {!hasNextPage && rows.length > 0 && (
              <p className="py-4 text-center text-xs text-crm-muted-fg">Beginning of history</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

const linkBtn =
  "inline-flex items-center gap-1.5 rounded-crm px-2 py-1 text-xs font-medium text-crm-fg hover:bg-crm-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring";

function State({
  icon,
  title,
  children,
  role,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  role?: "alert";
}) {
  return (
    <div
      role={role}
      className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center"
    >
      <span className="grid size-10 place-items-center rounded-full bg-crm-muted text-crm-soft">
        {icon}
      </span>
      <p className="text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}

function EdgeLoader({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-3 text-xs text-crm-muted-fg"
    >
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

function EdgeError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 py-3 text-xs text-crm-danger"
    >
      {label}
      <button type="button" className={linkBtn} onClick={onRetry}>
        <RotateCw className="size-3.5" aria-hidden /> Retry
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading activity" className="space-y-1 p-3">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="flex animate-pulse gap-3 px-1 py-2">
          <span className="size-7 rounded-full bg-crm-muted" />
          <div className="flex-1 space-y-2">
            <span className="block h-3 w-2/3 rounded bg-crm-muted" />
            <span className="block h-3 w-1/3 rounded bg-crm-muted/60" />
          </div>
        </div>
      ))}
    </div>
  );
}
