import * as React from "react";
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, ArrowUp, BellOff, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildInboxRows, matchesView, useNotificationInbox } from "@/hooks/use-notification-inbox";
import { NotificationRow } from "@/components/crm/pro-notification-inbox/notification-row";
import {
  BulkBar,
  SearchBox,
  TypeFilters,
  ViewTabs,
} from "@/components/crm/pro-notification-inbox/inbox-toolbar";
import type {
  InboxAction,
  InboxNotification,
  InboxTypeMeta,
  InboxView,
} from "@/components/crm/pro-notification-inbox/types";

export type {
  InboxAction,
  InboxNotification,
  InboxTypeMeta,
  InboxView,
} from "@/components/crm/pro-notification-inbox/types";
export { applyInboxAction } from "@/hooks/use-notification-inbox";

export interface ProNotificationInboxProps {
  /** Local/uncontrolled data. Ignored for fetching when `queryFn` is given (used as placeholder). */
  items?: InboxNotification[];
  /** Remote loader (TanStack Query). */
  queryFn?: () => Promise<InboxNotification[]>;
  queryKey?: QueryKey;
  /** Bring your own QueryClient; otherwise an isolated one is created. */
  queryClient?: QueryClient;
  /** Persist an action; a rejected promise rolls back the optimistic update. */
  onAction?: (action: InboxAction) => Promise<void> | void;
  /** Realtime feed. Call `emit(n)` for each new notification; return an unsubscribe fn. */
  subscribe?: (emit: (n: InboxNotification) => void) => () => void;
  onOpen?: (n: InboxNotification) => void;
  onError?: (err: unknown, action: InboxAction) => void;
  /** Label + tone per notification type; drives the filter chips. */
  typeMeta?: Record<string, InboxTypeMeta>;
  view?: InboxView;
  defaultView?: InboxView;
  onViewChange?: (v: InboxView) => void;
  /** Reference clock for grouping and snooze expiry (ticks every minute when omitted). */
  now?: Date;
  /** Mark notifications read when opened. */
  markReadOnOpen?: boolean;
  title?: string;
  height?: number | string;
  className?: string;
}

export function ProNotificationInbox({ queryClient, ...props }: ProNotificationInboxProps) {
  const [fallback] = React.useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient ?? fallback}>
      <InboxInner {...props} />
    </QueryClientProvider>
  );
}

const EMPTY: Record<InboxView, string> = {
  inbox: "You're all caught up. New notifications will appear here.",
  unread: "No unread notifications.",
  snoozed: "Nothing snoozed. Snoozed items return to your inbox automatically.",
  archived: "Archive is empty.",
};

function useClock(external?: Date) {
  const [tick, setTick] = React.useState(() => new Date());
  React.useEffect(() => {
    if (external) return;
    const t = setInterval(() => setTick(new Date()), 60_000);
    return () => clearInterval(t);
  }, [external]);
  return external ?? tick;
}

function InboxInner({
  items: initialItems,
  queryFn,
  queryKey = ["pro-notification-inbox"],
  onAction,
  subscribe,
  onOpen,
  onError,
  typeMeta = {},
  view: viewProp,
  defaultView = "inbox",
  onViewChange,
  now: nowProp,
  markReadOnOpen = true,
  title = "Notifications",
  height = 640,
  className,
}: Omit<ProNotificationInboxProps, "queryClient">) {
  const now = useClock(nowProp);
  const inbox = useNotificationInbox({
    queryKey,
    queryFn,
    initialItems,
    onAction,
    subscribe,
    onError,
  });
  const { items, dispatch, fresh, clearFresh } = inbox;

  const [viewState, setViewState] = React.useState<InboxView>(defaultView);
  const view = viewProp ?? viewState;
  const [types, setTypes] = React.useState<ReadonlySet<string>>(() => new Set());
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(() => new Set());
  const [active, setActive] = React.useState(0);
  const anchor = React.useRef<number | null>(null);

  const changeView = (v: InboxView) => {
    setViewState(v);
    onViewChange?.(v);
    setSelected(new Set());
    setActive(0);
  };

  // Single pass for all tab + type counts.
  const { viewCounts, typeCounts, allTypes, unreadTotal } = React.useMemo(() => {
    const viewCounts: Record<InboxView, number> = { inbox: 0, unread: 0, snoozed: 0, archived: 0 };
    const typeCounts = new Map<string, number>();
    const seen = new Set<string>(Object.keys(typeMeta));
    for (const n of items) {
      seen.add(n.type);
      for (const v of ["inbox", "unread", "snoozed", "archived"] as const)
        if (matchesView(n, v, now)) viewCounts[v]++;
      if (matchesView(n, view, now)) typeCounts.set(n.type, (typeCounts.get(n.type) ?? 0) + 1);
    }
    return { viewCounts, typeCounts, allTypes: [...seen], unreadTotal: viewCounts.unread };
  }, [items, now, view, typeMeta]);

  const { rows, itemIndex, visible } = React.useMemo(
    () => buildInboxRows(items, view, types, now, deferredSearch),
    [items, view, types, now, deferredSearch],
  );

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.kind === "header" ? 32 : 68),
    getItemKey: (i) => rows[i]?.key ?? i,
    overscan: 8,
  });

  const clampedActive = Math.min(active, Math.max(visible.length - 1, 0));
  const listId = React.useId();
  const optionId = (id: string) => `${listId}-${id}`;

  const run = React.useCallback(
    (action: InboxAction) => {
      if (action.ids.length) dispatch(action);
    },
    [dispatch],
  );

  const toggleSelect = React.useCallback(
    (id: string, range: boolean) => {
      const idx = visible.findIndex((n) => n.id === id);
      setSelected((prev) => {
        const next = new Set(prev);
        if (range && anchor.current != null && idx >= 0) {
          const [a, b] = [Math.min(anchor.current, idx), Math.max(anchor.current, idx)];
          for (let i = a; i <= b; i++) next.add(visible[i]!.id);
        } else if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      if (idx >= 0) {
        anchor.current = idx;
        setActive(idx);
      }
    },
    [visible],
  );

  const open = React.useCallback(
    (n: InboxNotification) => {
      if (markReadOnOpen && !n.readAt) run({ kind: "read", ids: [n.id] });
      onOpen?.(n);
    },
    [markReadOnOpen, onOpen, run],
  );
  const onRead = React.useCallback(
    (id: string, read: boolean) => run({ kind: read ? "read" : "unread", ids: [id] }),
    [run],
  );
  const onArchive = React.useCallback(
    (id: string, archive: boolean) => run({ kind: archive ? "archive" : "restore", ids: [id] }),
    [run],
  );
  const onSnooze = React.useCallback(
    (id: string, until: Date) => run({ kind: "snooze", ids: [id], until }),
    [run],
  );

  const moveTo = (i: number, extend = false) => {
    if (!visible.length) return;
    const next = Math.max(0, Math.min(visible.length - 1, i));
    setActive(next);
    const rowIdx = itemIndex[next];
    if (rowIdx != null) virtualizer.scrollToIndex(rowIdx, { align: "auto" });
    if (extend) {
      if (anchor.current == null) anchor.current = clampedActive;
      const [a, b] = [Math.min(anchor.current, next), Math.max(anchor.current, next)];
      setSelected(new Set(visible.slice(a, b + 1).map((n) => n.id)));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const cur = visible[clampedActive];
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key;
    let handled = true;
    if (key === "ArrowDown" || key === "j") moveTo(clampedActive + 1, e.shiftKey);
    else if (key === "ArrowUp" || key === "k") moveTo(clampedActive - 1, e.shiftKey);
    else if (key === "Home") moveTo(0, e.shiftKey);
    else if (key === "End") moveTo(visible.length - 1, e.shiftKey);
    else if (key === "PageDown") moveTo(clampedActive + 10);
    else if (key === "PageUp") moveTo(clampedActive - 10);
    else if (mod && key.toLowerCase() === "a") setSelected(new Set(visible.map((n) => n.id)));
    else if ((key === " " || key === "x") && cur) toggleSelect(cur.id, e.shiftKey);
    else if (key === "Enter" && cur) open(cur);
    else if (key === "Escape") setSelected(new Set());
    else if (key === "e" && cur) {
      const ids = selected.size ? [...selected] : [cur.id];
      run({ kind: view === "archived" ? "restore" : "archive", ids });
      setSelected(new Set());
    } else if (key === "u" && cur) onRead(cur.id, !cur.readAt);
    else handled = false;
    if (handled) e.preventDefault();
  };

  const bulk = (kind: "read" | "unread" | "archive" | "restore") => {
    run({ kind, ids: [...selected] });
    if (kind === "archive" || kind === "restore") setSelected(new Set());
  };

  // "N new" pill when realtime items land while scrolled down.
  const [scrolled, setScrolled] = React.useState(false);
  const freshCount = fresh.size;

  const cur = visible[clampedActive];
  const isLoading = inbox.status === "pending" && !items.length;
  const isError = inbox.status === "error" && !items.length;

  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card text-crm-fg shadow-crm-raised",
        className,
      )}
      style={{ height }}
    >
      <header className="flex flex-col gap-3 border-b border-crm-border p-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-medium">
            {title}
            {unreadTotal > 0 && (
              <span className="ml-2 rounded-full bg-crm-primary px-1.5 py-0.5 text-[11px] text-crm-primary-fg tabular-nums">
                {unreadTotal > 999 ? "999+" : unreadTotal}
              </span>
            )}
          </h2>
          {inbox.isFetching && !isLoading && (
            <span className="text-xs text-crm-muted-fg" aria-live="polite">
              Syncing…
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewTabs view={view} counts={viewCounts} onChange={changeView} />
          <SearchBox value={search} onChange={setSearch} />
        </div>
        <TypeFilters
          types={allTypes}
          meta={typeMeta}
          counts={typeCounts}
          selected={types}
          onToggle={(t) =>
            setTypes((s) => {
              const n = new Set(s);
              if (n.has(t)) n.delete(t);
              else n.add(t);
              return n;
            })
          }
          onClear={() => setTypes(new Set())}
        />
      </header>
      <div className="border-b border-crm-border">
        <BulkBar
          count={selected.size}
          view={view}
          now={now}
          unreadTotal={unreadTotal}
          onRead={() => bulk("read")}
          onUnread={() => bulk("unread")}
          onArchive={() => bulk("archive")}
          onRestore={() => bulk("restore")}
          onSnooze={(until) => {
            run({ kind: "snooze", ids: [...selected], until });
            setSelected(new Set());
          }}
          onClear={() => setSelected(new Set())}
          onMarkAllRead={() =>
            run({
              kind: "read",
              ids: items.filter((n) => !n.readAt && !n.archivedAt).map((n) => n.id),
            })
          }
        />
      </div>

      <div className="relative min-h-0 flex-1">
        {isLoading ? (
          <div aria-busy="true" aria-label="Loading notifications" className="space-y-px">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="flex animate-pulse gap-3 px-3 py-3">
                <div className="size-8 rounded-full bg-crm-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-crm-muted" />
                  <div className="h-2.5 w-1/2 rounded bg-crm-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
          >
            <AlertTriangle className="size-6 text-crm-danger" aria-hidden />
            <p className="text-sm text-crm-soft">Couldn't load notifications.</p>
            <button
              type="button"
              onClick={() => void inbox.refetch()}
              className="inline-flex h-8 items-center gap-1.5 rounded-crm border border-crm-border px-3 text-xs hover:bg-crm-muted"
            >
              <RotateCw className="size-3.5" aria-hidden /> Retry
            </button>
          </div>
        ) : !rows.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <BellOff className="size-6 text-crm-subtle" aria-hidden />
            <p className="max-w-xs text-sm text-crm-muted-fg">
              {search || types.size ? "No notifications match your filters." : EMPTY[view]}
            </p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            role="listbox"
            aria-label={`${title}, ${view}`}
            aria-multiselectable="true"
            aria-activedescendant={cur ? optionId(cur.id) : undefined}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 40)}
            className="h-full overflow-y-auto overscroll-contain focus-visible:outline-none"
          >
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((vi) => {
                const row = rows[vi.index]!;
                return (
                  <div
                    key={vi.key}
                    data-index={vi.index}
                    ref={virtualizer.measureElement}
                    className="absolute inset-x-0 top-0"
                    style={{ transform: `translateY(${vi.start}px)` }}
                  >
                    {row.kind === "header" ? (
                      <div
                        role="presentation"
                        className="flex h-8 items-center justify-between bg-crm-card/95 px-3 crm-eyebrow text-crm-muted-fg"
                      >
                        <span>{row.label}</span>
                        <span className="tabular-nums">{row.count}</span>
                      </div>
                    ) : (
                      <NotificationRow
                        id={optionId(row.item.id)}
                        item={row.item}
                        meta={typeMeta[row.item.type]}
                        selected={selected.has(row.item.id)}
                        active={row.index === clampedActive}
                        fresh={fresh.has(row.item.id)}
                        now={now}
                        posinset={row.index + 1}
                        setsize={visible.length}
                        onToggleSelect={toggleSelect}
                        onOpen={open}
                        onRead={onRead}
                        onArchive={onArchive}
                        onSnooze={onSnooze}
                        onAnimated={clearFresh}
                        onPointerActivate={() => setActive(row.index)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {scrolled && freshCount > 0 && (
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className="absolute top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-crm-primary px-3 py-1 text-xs text-crm-primary-fg shadow-crm-primary"
          >
            <ArrowUp className="size-3.5" aria-hidden /> {freshCount} new
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {freshCount ? `${freshCount} new notification${freshCount > 1 ? "s" : ""}` : ""}
      </p>
    </section>
  );
}
