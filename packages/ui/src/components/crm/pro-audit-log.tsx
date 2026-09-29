import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import {
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { AlertTriangle, Check, Columns3, Download, Loader2, RotateCw, SearchX } from "lucide-react";
import { AuditEventDrawer } from "@/components/crm/pro-audit-log/event-drawer";
import { AuditEventTable } from "@/components/crm/pro-audit-log/event-table";
import { AuditFilterBar } from "@/components/crm/pro-audit-log/filter-bar";
import { downloadText, eventsToCsv, localFacets } from "@/components/crm/pro-audit-log/format";
import {
  EMPTY_AUDIT_FILTERS,
  type AuditColumnId,
  type AuditEvent,
  type AuditFetchPage,
  type AuditFilters,
  type AuditPage,
  type AuditTimeMode,
} from "@/components/crm/pro-audit-log/types";
import { cn } from "@/lib/utils";

export * from "@/components/crm/pro-audit-log/types";
export { JsonDiffView, diffLines } from "@/components/crm/pro-audit-log/json-diff";
export { eventsToCsv } from "@/components/crm/pro-audit-log/format";

export interface ProAuditLogProps {
  /** Cursor-paginated loader. Receives an AbortSignal; filtering happens server-side. */
  fetchPage: AuditFetchPage;
  pageSize?: number;
  /** Controlled filters. Pair with onFiltersChange (or use useAuditLogUrlState for URL sync). */
  filters?: AuditFilters;
  defaultFilters?: AuditFilters;
  onFiltersChange?: (filters: AuditFilters) => void;
  timeMode?: AuditTimeMode;
  defaultTimeMode?: AuditTimeMode;
  onTimeModeChange?: (mode: AuditTimeMode) => void;
  /** Columns hidden initially; users can toggle them from the Columns menu. */
  defaultHiddenColumns?: AuditColumnId[];
  /** Replace the built-in CSV export (e.g. trigger a server-side export job). */
  onExport?: (filters: AuditFilters) => void | Promise<void>;
  /** Cap for "Export all matching" (pages are fetched sequentially). */
  exportLimit?: number;
  exportFileName?: string;
  /** Fires when an event is opened in the drawer. */
  onEventOpen?: (event: AuditEvent) => void;
  renderEventActions?: (event: AuditEvent) => React.ReactNode;
  /** Base query key; filters are appended. */
  queryKey?: readonly unknown[];
  /** Existing React Query client. A private one is created when omitted. */
  queryClient?: QueryClient;
  /** Poll the first page for new events, in ms. */
  refetchInterval?: number;
  height?: number | string;
  rowHeight?: number;
  title?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

function useControllable<T>(value: T | undefined, initial: T, onChange?: (v: T) => void) {
  const [inner, setInner] = React.useState(initial);
  const current = value !== undefined ? value : inner;
  const set = React.useCallback(
    (v: T) => {
      if (value === undefined) setInner(v);
      onChange?.(v);
    },
    [value, onChange],
  );
  return [current, set] as const;
}

const COLUMN_LABELS: Record<AuditColumnId, string> = {
  time: "Time",
  actor: "Actor",
  action: "Action",
  resource: "Resource",
  outcome: "Outcome",
  source: "Source",
};

const ghostBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-crm border border-crm-border bg-crm-card px-2.5 text-sm text-crm-soft hover:text-crm-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-crm-ring disabled:opacity-50";
const menuItem =
  "flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-crm-soft outline-none data-[highlighted]:bg-crm-muted data-[highlighted]:text-crm-fg data-[disabled]:opacity-50";

/** Searchable, faceted, infinitely scrolling audit log explorer for SOC 2 / enterprise admin areas. */
export function ProAuditLog({ queryClient, ...props }: ProAuditLogProps) {
  const [ownClient] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={queryClient ?? ownClient}>
      <AuditLogExplorer {...props} />
    </QueryClientProvider>
  );
}

function AuditLogExplorer({
  fetchPage,
  pageSize = 100,
  filters: filtersProp,
  defaultFilters = EMPTY_AUDIT_FILTERS,
  onFiltersChange,
  timeMode: timeModeProp,
  defaultTimeMode = "relative",
  onTimeModeChange,
  defaultHiddenColumns = [],
  onExport,
  exportLimit = 50_000,
  exportFileName = "audit-log",
  onEventOpen,
  renderEventActions,
  queryKey = ["pro-audit-log"],
  refetchInterval,
  height = 560,
  rowHeight = 40,
  title = "Audit log",
  disabled,
  className,
}: Omit<ProAuditLogProps, "queryClient">) {
  const [filters, setFilters] = useControllable(filtersProp, defaultFilters, onFiltersChange);
  const [timeMode, setTimeMode] = useControllable(timeModeProp, defaultTimeMode, onTimeModeChange);
  const [hidden, setHidden] = React.useState<AuditColumnId[]>(defaultHiddenColumns);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const [exporting, setExporting] = React.useState<{ done: number } | null>(null);
  const exportAbort = React.useRef<AbortController | null>(null);

  const query = useInfiniteQuery({
    queryKey: [...queryKey, filters, pageSize],
    queryFn: ({ pageParam, signal }) => fetchPage({ cursor: pageParam, filters, pageSize, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: AuditPage) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    refetchInterval,
    enabled: !disabled,
  });

  const events = React.useMemo(
    () => query.data?.pages.flatMap((p) => p.events) ?? [],
    [query.data],
  );
  const firstPage = query.data?.pages[0];
  const total = firstPage?.total;
  const facets = React.useMemo(() => {
    const fallback = firstPage?.facets ? null : localFacets(events);
    return {
      actors: firstPage?.facets?.actors ?? fallback?.actors ?? [],
      actions: firstPage?.facets?.actions ?? fallback?.actions ?? [],
      resources: firstPage?.facets?.resources ?? fallback?.resources ?? [],
    };
  }, [firstPage, events]);

  // Reset the cursor and selection whenever the filter set changes.
  const filterKey = JSON.stringify(filters);
  const [prevKey, setPrevKey] = React.useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setActiveIndex(-1);
    setOpenIndex(null);
  }

  const open = React.useCallback(
    (i: number) => {
      setOpenIndex(i);
      const ev = events[i];
      if (ev) onEventOpen?.(ev);
    },
    [events, onEventOpen],
  );

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const loadMore = React.useCallback(() => void fetchNextPage(), [fetchNextPage]);

  const step = (delta: number) => {
    if (openIndex === null) return;
    const next = openIndex + delta;
    if (next < 0 || next >= events.length) return;
    setActiveIndex(next);
    open(next);
    if (next >= events.length - 5 && hasNextPage && !isFetchingNextPage) loadMore();
  };

  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  const exportLoaded = () => downloadText(eventsToCsv(events), `${exportFileName}-${stamp()}.csv`);

  const exportAll = async () => {
    if (onExport) {
      await onExport(filters);
      return;
    }
    const ctrl = new AbortController();
    exportAbort.current = ctrl;
    const all: AuditEvent[] = [];
    let cursor: string | null = null;
    setExporting({ done: 0 });
    try {
      do {
        const page: AuditPage = await fetchPage({
          cursor,
          filters,
          pageSize: 1000,
          signal: ctrl.signal,
        });
        all.push(...page.events);
        cursor = page.nextCursor;
        setExporting({ done: all.length });
      } while (cursor && all.length < exportLimit && !ctrl.signal.aborted);
      if (!ctrl.signal.aborted)
        downloadText(eventsToCsv(all.slice(0, exportLimit)), `${exportFileName}-${stamp()}.csv`);
    } catch {
      // Aborted or failed: nothing to download.
    } finally {
      setExporting(null);
      exportAbort.current = null;
    }
  };

  const isInitialLoading = query.isPending && !query.data;
  const empty = (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <SearchX className="size-8 text-crm-faint" aria-hidden />
      <p className="text-sm font-medium text-crm-fg">No events match these filters</p>
      <p className="text-sm text-crm-muted-fg">Widen the date range or remove a facet.</p>
      <button
        type="button"
        className={cn(ghostBtn, "mt-2")}
        onClick={() => setFilters(EMPTY_AUDIT_FILTERS)}
      >
        Reset filters
      </button>
    </div>
  );

  return (
    <section
      aria-label={typeof title === "string" ? title : "Audit log"}
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <header className="flex items-center gap-3 border-b border-crm-border px-3 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs tabular-nums text-crm-muted-fg" aria-live="polite">
          {isInitialLoading
            ? "Loading…"
            : `${events.length.toLocaleString()}${total !== undefined ? ` of ${total.toLocaleString()}` : ""} events`}
        </span>
        {query.isFetching && !isInitialLoading && !isFetchingNextPage && (
          <Loader2 className="size-3.5 animate-spin text-crm-muted-fg" aria-label="Refreshing" />
        )}
      </header>

      <AuditFilterBar filters={filters} onChange={setFilters} facets={facets} disabled={disabled}>
        <ToggleGroup.Root
          type="single"
          value={timeMode}
          onValueChange={(v) => v && setTimeMode(v as AuditTimeMode)}
          aria-label="Time format"
          className="flex h-8 rounded-crm border border-crm-border bg-crm-card p-0.5"
        >
          {(["relative", "absolute"] as const).map((m) => (
            <ToggleGroup.Item
              key={m}
              value={m}
              className="rounded px-2 text-xs capitalize text-crm-muted-fg outline-none focus-visible:ring-1 focus-visible:ring-crm-ring data-[state=on]:bg-crm-muted data-[state=on]:text-crm-fg"
            >
              {m}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger className={ghostBtn} aria-label="Toggle columns">
            <Columns3 className="size-3.5" aria-hidden />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 min-w-40 rounded-crm border border-crm-border bg-crm-popover p-1 shadow-crm-overlay animate-crm-in"
            >
              {(Object.keys(COLUMN_LABELS) as AuditColumnId[]).map((c) => (
                <DropdownMenu.CheckboxItem
                  key={c}
                  className={menuItem}
                  checked={!hidden.includes(c)}
                  disabled={c === "time" || c === "action"}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(on) =>
                    setHidden((h) => (on ? h.filter((x) => x !== c) : [...h, c]))
                  }
                >
                  <span className="grid size-4 place-items-center">
                    <DropdownMenu.ItemIndicator>
                      <Check className="size-3.5" />
                    </DropdownMenu.ItemIndicator>
                  </span>
                  {COLUMN_LABELS[c]}
                </DropdownMenu.CheckboxItem>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {exporting ? (
          <button type="button" className={ghostBtn} onClick={() => exportAbort.current?.abort()}>
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {exporting.done.toLocaleString()} rows · Cancel
          </button>
        ) : (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className={ghostBtn} disabled={disabled || isInitialLoading}>
              <Download className="size-3.5" aria-hidden /> Export
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-56 rounded-crm border border-crm-border bg-crm-popover p-1 shadow-crm-overlay animate-crm-in"
              >
                <DropdownMenu.Item
                  className={menuItem}
                  disabled={!events.length}
                  onSelect={exportLoaded}
                >
                  Loaded rows as CSV ({events.length.toLocaleString()})
                </DropdownMenu.Item>
                <DropdownMenu.Item className={menuItem} onSelect={() => void exportAll()}>
                  All matching as CSV
                  {total !== undefined && ` (${Math.min(total, exportLimit).toLocaleString()})`}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </AuditFilterBar>

      {query.isError && !query.data ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 px-6 py-16 text-center"
          style={{ height }}
        >
          <AlertTriangle className="size-8 text-crm-danger" aria-hidden />
          <p className="text-sm font-medium">Could not load audit events</p>
          <p className="max-w-sm text-sm text-crm-muted-fg">{(query.error as Error)?.message}</p>
          <button
            type="button"
            className={cn(ghostBtn, "mt-2")}
            onClick={() => void query.refetch()}
          >
            <RotateCw className="size-3.5" aria-hidden /> Retry
          </button>
        </div>
      ) : (
        <AuditEventTable
          events={events}
          total={total}
          timeMode={timeMode}
          hiddenColumns={hidden}
          rowHeight={rowHeight}
          height={height}
          hasNextPage={!!hasNextPage && !query.isFetchNextPageError}
          isFetchingNextPage={isFetchingNextPage}
          isLoading={isInitialLoading}
          fetchNextPage={loadMore}
          onOpen={open}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
          empty={empty}
        />
      )}
      {query.isFetchNextPageError && (
        <div
          role="alert"
          className="flex items-center gap-2 border-t border-crm-border px-3 py-2 text-sm text-crm-danger"
        >
          <AlertTriangle className="size-4" aria-hidden /> Failed to load more events.
          <button type="button" className="underline" onClick={loadMore}>
            Retry
          </button>
        </div>
      )}

      <AuditEventDrawer
        event={openIndex !== null ? (events[openIndex] ?? null) : null}
        onOpenChange={(o) => !o && setOpenIndex(null)}
        onPrev={openIndex !== null && openIndex > 0 ? () => step(-1) : undefined}
        onNext={openIndex !== null && openIndex < events.length - 1 ? () => step(1) : undefined}
        renderActions={renderEventActions}
      />
    </section>
  );
}
