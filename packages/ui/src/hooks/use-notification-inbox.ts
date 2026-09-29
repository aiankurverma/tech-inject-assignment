import * as React from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { differenceInCalendarDays, format, isThisYear } from "date-fns";
import type {
  InboxAction,
  InboxNotification,
  InboxRow,
  InboxView,
} from "@/components/crm/pro-notification-inbox/types";

const toDate = (v: Date | string | null | undefined) =>
  v == null ? null : v instanceof Date ? v : new Date(v);

export function isSnoozed(n: InboxNotification, now: Date) {
  const s = toDate(n.snoozedUntil);
  return !!s && s.getTime() > now.getTime();
}

export function matchesView(n: InboxNotification, view: InboxView, now: Date) {
  const archived = !!n.archivedAt;
  const snoozed = isSnoozed(n, now);
  switch (view) {
    case "archived":
      return archived;
    case "snoozed":
      return !archived && snoozed;
    case "unread":
      return !archived && !snoozed && !n.readAt;
    default:
      return !archived && !snoozed;
  }
}

/** Pure reducer used for optimistic updates and for uncontrolled mode. */
export function applyInboxAction(list: InboxNotification[], action: InboxAction, now = new Date()) {
  const ids = new Set(action.ids);
  const iso = now.toISOString();
  return list.map((n) => {
    if (!ids.has(n.id)) return n;
    switch (action.kind) {
      case "read":
        return n.readAt ? n : { ...n, readAt: iso };
      case "unread":
        return { ...n, readAt: null };
      case "archive":
        return { ...n, archivedAt: iso, readAt: n.readAt ?? iso };
      case "restore":
        return { ...n, archivedAt: null, snoozedUntil: null };
      case "snooze":
        return { ...n, snoozedUntil: action.until.toISOString() };
    }
  });
}

function groupLabel(d: Date, now: Date) {
  const diff = differenceInCalendarDays(now, d);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "Earlier this week";
  return format(d, isThisYear(d) ? "MMMM" : "MMMM yyyy");
}

/** Filters, sorts (newest first) and groups into a flat header+item row list. O(n log n). */
export function buildInboxRows(
  list: InboxNotification[],
  view: InboxView,
  types: ReadonlySet<string>,
  now: Date,
  query = "",
) {
  const q = query.trim().toLowerCase();
  const items = list
    .filter(
      (n) =>
        matchesView(n, view, now) &&
        (types.size === 0 || types.has(n.type)) &&
        (!q ||
          n.title.toLowerCase().includes(q) ||
          (n.body ?? "").toLowerCase().includes(q) ||
          (n.actor?.name ?? "").toLowerCase().includes(q)),
    )
    .map((n) => ({ n, t: toDate(n.createdAt)!.getTime() }))
    .sort((a, b) => b.t - a.t);

  const rows: InboxRow[] = [];
  const itemIndex: number[] = [];
  let current = "";
  let headerAt = -1;
  items.forEach(({ n, t }, i) => {
    const label = groupLabel(new Date(t), now);
    if (label !== current) {
      current = label;
      headerAt = rows.length;
      rows.push({ kind: "header", key: `h:${label}`, label, count: 0 });
    }
    const h = rows[headerAt];
    if (h && h.kind === "header") h.count++;
    itemIndex.push(rows.length);
    rows.push({ kind: "item", key: n.id, item: n, index: i });
  });
  return { rows, itemIndex, visible: items.map((x) => x.n) };
}

export interface UseNotificationInboxOptions {
  queryKey: QueryKey;
  /** Remote source. When omitted the hook runs in local mode seeded by `initialItems`. */
  queryFn?: () => Promise<InboxNotification[]>;
  initialItems?: InboxNotification[];
  /** Persist an action. Rejections roll the optimistic update back. */
  onAction?: (action: InboxAction) => Promise<void> | void;
  /** Realtime source: call `emit` for every new notification; return an unsubscribe. */
  subscribe?: (emit: (n: InboxNotification) => void) => () => void;
  onError?: (err: unknown, action: InboxAction) => void;
}

export function useNotificationInbox({
  queryKey,
  queryFn,
  initialItems,
  onAction,
  subscribe,
  onError,
}: UseNotificationInboxOptions) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: queryFn ?? (async () => initialItems ?? []),
    initialData: queryFn ? undefined : initialItems,
    staleTime: queryFn ? 30_000 : Infinity,
  });

  // Track ids that arrived via realtime so rows can animate in once.
  const [fresh, setFresh] = React.useState<ReadonlySet<string>>(() => new Set());
  const subRef = React.useRef(subscribe);
  subRef.current = subscribe;
  const keyHash = JSON.stringify(queryKey);

  React.useEffect(() => {
    const sub = subRef.current;
    if (!sub) return;
    return sub((n) => {
      qc.setQueryData<InboxNotification[]>(queryKey, (old = []) =>
        old.some((o) => o.id === n.id) ? old : [n, ...old],
      );
      setFresh((s) => new Set(s).add(n.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, keyHash]);

  const clearFresh = React.useCallback((id: string) => {
    setFresh((s) => {
      if (!s.has(id)) return s;
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }, []);

  const mutation = useMutation({
    mutationFn: async (action: InboxAction) => {
      await onAction?.(action);
    },
    onMutate: async (action) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<InboxNotification[]>(queryKey);
      qc.setQueryData<InboxNotification[]>(queryKey, (old = []) => applyInboxAction(old, action));
      return { previous };
    },
    onError: (err, action, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
      onError?.(err, action);
    },
    onSettled: () => {
      if (queryFn) void qc.invalidateQueries({ queryKey });
    },
  });

  return {
    items: query.data ?? [],
    status: query.status,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    dispatch: mutation.mutate,
    pending: mutation.isPending,
    fresh,
    clearFresh,
  };
}
