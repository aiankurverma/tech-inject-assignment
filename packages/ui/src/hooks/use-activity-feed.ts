import { useMemo } from "react";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import {
  toDate,
  type ActivityPage,
  type ActivityType,
  type FeedRow,
  type FetchActivityPage,
  type TimelineActivity,
} from "@/components/crm/pro-activity-timeline/types";

interface PageParam {
  cursor: string | null;
  direction: "older" | "newer";
}

export interface UseActivityFeedOptions {
  queryKey: readonly unknown[];
  fetchPage: FetchActivityPage;
  types: ActivityType[];
  enabled?: boolean;
}

export function dayLabel(day: Date): string {
  if (isToday(day)) return "Today";
  if (isYesterday(day)) return "Yesterday";
  return format(day, "EEEE, d MMMM yyyy");
}

/**
 * Bidirectional cursor feed on top of TanStack Query's useInfiniteQuery:
 * `fetchNextPage` loads older activity (appended), `fetchPreviousPage` loads newer (prepended).
 * Rows are flattened once per data change into day headers + items (O(n)).
 */
export function useActivityFeed({
  queryKey,
  fetchPage,
  types,
  enabled = true,
}: UseActivityFeedOptions) {
  const query = useInfiniteQuery<
    ActivityPage,
    Error,
    InfiniteData<ActivityPage, PageParam>,
    readonly unknown[],
    PageParam
  >({
    queryKey: [...queryKey, { types }],
    enabled,
    initialPageParam: { cursor: null, direction: "older" },
    queryFn: ({ pageParam, signal }) =>
      fetchPage({ cursor: pageParam.cursor, direction: pageParam.direction, types, signal }),
    getNextPageParam: (last) =>
      last.olderCursor ? { cursor: last.olderCursor, direction: "older" } : undefined,
    getPreviousPageParam: (first) =>
      first.newerCursor ? { cursor: first.newerCursor, direction: "newer" } : undefined,
    staleTime: 30_000,
  });

  const { rows, items } = useMemo(() => {
    const items: TimelineActivity[] = [];
    const seen = new Set<string>();
    for (const page of query.data?.pages ?? []) {
      for (const it of page.items) {
        if (seen.has(it.id)) continue; // pages may overlap when new activity arrives
        seen.add(it.id);
        items.push(it);
      }
    }
    const rows: FeedRow[] = [];
    let lastDay = -1;
    items.forEach((item, index) => {
      const day = startOfDay(toDate(item.at));
      const t = day.getTime();
      if (t !== lastDay) {
        lastDay = t;
        rows.push({ kind: "day", key: `day-${t}`, day, label: dayLabel(day) });
      }
      rows.push({ kind: "item", key: item.id, item, index });
    });
    return { rows, items };
  }, [query.data]);

  return { ...query, rows, items };
}

/**
 * Turns an in-memory array into a cursor source (handy for demos, tests and small feeds).
 * `anchor` opens the feed at that moment so both directions have data to load.
 */
export function createLocalActivitySource(
  all: TimelineActivity[],
  {
    pageSize = 40,
    anchor,
    latencyMs = 250,
  }: { pageSize?: number; anchor?: Date; latencyMs?: number } = {},
): FetchActivityPage {
  const sorted = [...all].sort((a, b) => toDate(b.at).getTime() - toDate(a.at).getTime());
  const byType = new Map<string, TimelineActivity[]>();
  const listFor = (types: ActivityType[]) => {
    const k = [...types].sort().join(",");
    let list = byType.get(k);
    if (!list) {
      const set = new Set(types);
      list = sorted.filter((a) => set.has(a.type));
      byType.set(k, list);
    }
    return list;
  };
  const firstAtOrBefore = (list: TimelineActivity[], t: number) => {
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (toDate(list[mid]!.at).getTime() > t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return async ({ cursor, direction, types, signal }) => {
    await new Promise<void>((resolve, reject) => {
      const id = setTimeout(resolve, latencyMs);
      signal?.addEventListener("abort", () => {
        clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
    const list = listFor(types);
    let start: number;
    let end: number;
    if (cursor === null) {
      start = anchor ? firstAtOrBefore(list, anchor.getTime()) : 0;
      end = Math.min(list.length, start + pageSize);
    } else if (direction === "older") {
      start = Number(cursor);
      end = Math.min(list.length, start + pageSize);
    } else {
      end = Number(cursor);
      start = Math.max(0, end - pageSize);
    }
    return {
      items: list.slice(start, end),
      olderCursor: end < list.length ? String(end) : null,
      newerCursor: start > 0 ? String(start) : null,
    };
  };
}
