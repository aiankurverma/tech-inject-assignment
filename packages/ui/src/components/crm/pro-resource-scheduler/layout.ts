import type { SchedulerOccurrence } from "@/components/crm/pro-resource-scheduler/types";

export interface RowLayout {
  items: (SchedulerOccurrence & { lane: number })[];
  lanes: number;
}

/**
 * Greedy interval-graph lane packing (O(n log n) per row) that also flags overlaps: any occurrence
 * that shares time with another one on the same resource is a conflict.
 */
export function layoutRow(occ: SchedulerOccurrence[], conflicts: Set<string>): RowLayout {
  const sorted = [...occ].sort((a, b) => a.start - b.start || b.end - a.end);
  const laneEnds: number[] = [];
  const items: RowLayout["items"] = [];
  // Sweep: anything starting before the running max end overlaps the event that owns that end.
  let maxEnd = -Infinity;
  let maxKey: string | null = null;
  for (const o of sorted) {
    if (o.start < maxEnd && maxKey) {
      conflicts.add(o.key);
      conflicts.add(maxKey);
    }
    if (o.end > maxEnd) {
      maxEnd = o.end;
      maxKey = o.key;
    }
    let lane = laneEnds.findIndex((end) => end <= o.start);
    if (lane === -1) lane = laneEnds.push(o.end) - 1;
    else laneEnds[lane] = o.end;
    items.push({ ...o, lane });
  }
  return { items, lanes: Math.max(1, laneEnds.length) };
}

/** True when [start,end) overlaps any occurrence on the resource except `ignoreKey`. */
export function hasConflict(
  occ: SchedulerOccurrence[] | undefined,
  start: number,
  end: number,
  ignoreEventId?: string,
) {
  if (!occ) return false;
  return occ.some((o) => o.event.id !== ignoreEventId && o.start < end && start < o.end);
}
