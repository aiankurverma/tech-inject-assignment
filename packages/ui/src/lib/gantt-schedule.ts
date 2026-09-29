import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import type { GanttTask, ScheduleInfo } from "@/components/crm/pro-gantt-roadmap/types";

export const toDate = (v: Date | string) => (v instanceof Date ? v : new Date(v));
export const dayIndex = (origin: Date, v: Date | string) =>
  differenceInCalendarDays(toDate(v), origin);
export const fromDay = (origin: Date, d: number) => addDays(origin, d);

export function durationDays(t: GanttTask) {
  return Math.max(0, differenceInCalendarDays(toDate(t.end), toDate(t.start)));
}

/** Kahn topological order over finish-to-start edges. O(V + E). */
export function topoOrder(tasks: GanttTask[]) {
  const ids = new Set(tasks.map((t) => t.id));
  const indeg = new Map<string, number>();
  const succ = new Map<string, string[]>();
  for (const t of tasks) {
    indeg.set(t.id, indeg.get(t.id) ?? 0);
    for (const p of t.dependencies ?? []) {
      if (!ids.has(p) || p === t.id) continue;
      indeg.set(t.id, (indeg.get(t.id) ?? 0) + 1);
      const list = succ.get(p);
      if (list) list.push(t.id);
      else succ.set(p, [t.id]);
    }
  }
  const queue: string[] = [];
  for (const [id, d] of indeg) if (d === 0) queue.push(id);
  const order: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    order.push(id);
    for (const s of succ.get(id) ?? []) {
      const d = (indeg.get(s) ?? 0) - 1;
      indeg.set(s, d);
      if (d === 0) queue.push(s);
    }
  }
  const cyclic = new Set<string>();
  if (order.length < ids.size) for (const id of ids) if ((indeg.get(id) ?? 0) > 0) cyclic.add(id);
  return { order, succ, cyclic };
}

/**
 * Critical path on the current schedule (CPM backward pass).
 * Late finish of a task = min(late start of successors), bounded by the project finish;
 * slack = lateStart - actualStart. Summary tasks are skipped (their span is derived).
 */
export function computeSchedule(tasks: GanttTask[], summaryIds: ReadonlySet<string>): ScheduleInfo {
  const leaves = tasks.filter((t) => !summaryIds.has(t.id));
  const byId = new Map(leaves.map((t) => [t.id, t]));
  const { order, succ, cyclic } = topoOrder(leaves);
  let projectEnd = -Infinity;
  const s = new Map<string, number>();
  const e = new Map<string, number>();
  for (const t of leaves) {
    const st = toDate(t.start).getTime() / 864e5;
    const en = toDate(t.end).getTime() / 864e5;
    s.set(t.id, Math.round(st));
    e.set(t.id, Math.round(en));
    projectEnd = Math.max(projectEnd, Math.round(en));
  }
  const lateStart = new Map<string, number>();
  const slack = new Map<string, number>();
  const critical = new Set<string>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]!;
    let lf = projectEnd;
    for (const n of succ.get(id) ?? []) lf = Math.min(lf, lateStart.get(n) ?? projectEnd);
    const dur = e.get(id)! - s.get(id)!;
    const ls = lf - dur;
    lateStart.set(id, ls);
    const f = ls - s.get(id)!;
    slack.set(id, f);
    if (f <= 0) critical.add(id);
  }
  const violations = new Set<string>();
  for (const t of leaves)
    for (const p of t.dependencies ?? [])
      if (byId.has(p) && s.get(t.id)! < e.get(p)!) violations.add(`${p}->${t.id}`);
  return { slack, critical, cyclic, violations };
}

/** Push successors forward so no finish-to-start constraint is violated. Returns a new array. */
export function autoSchedule(tasks: GanttTask[], summaryIds: ReadonlySet<string>) {
  const leaves = tasks.filter((t) => !summaryIds.has(t.id));
  const { order } = topoOrder(leaves);
  const current = new Map(tasks.map((t) => [t.id, t]));
  let changed = false;
  for (const id of order) {
    const t = current.get(id)!;
    let min = -Infinity;
    for (const p of t.dependencies ?? []) {
      const pt = current.get(p);
      if (pt && !summaryIds.has(p)) min = Math.max(min, toDate(pt.end).getTime());
    }
    const start = toDate(t.start).getTime();
    if (min > start) {
      const delta = differenceInCalendarDays(new Date(min), new Date(start));
      current.set(id, {
        ...t,
        start: addDays(startOfDay(toDate(t.start)), delta),
        end: addDays(startOfDay(toDate(t.end)), delta),
      });
      changed = true;
    }
  }
  return changed ? tasks.map((t) => current.get(t.id)!) : tasks;
}

/** Parent -> children index and roll-up spans for summary rows. O(n). */
export function buildHierarchy(tasks: GanttTask[]) {
  const ids = new Set(tasks.map((t) => t.id));
  const children = new Map<string | null, GanttTask[]>();
  for (const t of tasks) {
    const p = t.parentId && ids.has(t.parentId) ? t.parentId : null;
    const list = children.get(p);
    if (list) list.push(t);
    else children.set(p, [t]);
  }
  const span = new Map<string, { s: number; e: number; progress: number; weight: number }>();
  const visit = (t: GanttTask, guard: Set<string>) => {
    if (guard.has(t.id)) return span.get(t.id);
    guard.add(t.id);
    const kids = children.get(t.id);
    const st = toDate(t.start).getTime();
    const en = toDate(t.end).getTime();
    if (!kids?.length) {
      const w = Math.max(en - st, 864e5);
      const r = { s: st, e: en, progress: (t.progress ?? 0) * w, weight: w };
      span.set(t.id, r);
      return r;
    }
    const r = { s: Infinity, e: -Infinity, progress: 0, weight: 0 };
    for (const k of kids) {
      const c = visit(k, guard);
      if (!c) continue;
      r.s = Math.min(r.s, c.s);
      r.e = Math.max(r.e, c.e);
      r.progress += c.progress;
      r.weight += c.weight;
    }
    span.set(t.id, r);
    return r;
  };
  const guard = new Set<string>();
  for (const t of tasks) visit(t, guard);
  const summaryIds = new Set<string>();
  for (const [p, list] of children) if (p && list.length) summaryIds.add(p);
  return { children, span, summaryIds };
}
