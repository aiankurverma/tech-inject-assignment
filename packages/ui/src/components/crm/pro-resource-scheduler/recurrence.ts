import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, addWeeks, getDay, startOfWeek } from "date-fns";
import type {
  SchedulerEvent,
  SchedulerOccurrence,
} from "@/components/crm/pro-resource-scheduler/types";

/**
 * In-house expansion of a small RRULE subset (daily / weekly+byWeekday / monthly, interval, count,
 * until, exdates). Written from scratch because `rrule` is not on the approved list. Expansion
 * happens in the event's display zone so "every Monday 09:00" survives DST changes.
 */
const HARD_LIMIT = 5000;

export function expandEvent(
  ev: SchedulerEvent,
  rangeStart: number,
  rangeEnd: number,
  timeZone: string,
): SchedulerOccurrence[] {
  const start = Date.parse(ev.start);
  const end = Date.parse(ev.end);
  const dur = Math.max(0, end - start);
  const r = ev.recurrence;
  if (!r) {
    return end > rangeStart && start < rangeEnd
      ? [{ key: ev.id, event: ev, start, end, resourceId: ev.resourceId }]
      : [];
  }
  const interval = Math.max(1, r.interval ?? 1);
  const until = r.until ? Date.parse(r.until) : Infinity;
  const ex = new Set((r.exdates ?? []).map((d) => Date.parse(d)));
  const out: SchedulerOccurrence[] = [];
  const first = new TZDate(start, timeZone);
  let emitted = 0;

  const push = (t: number) => {
    emitted++;
    if (ex.has(t)) return;
    if (t + dur > rangeStart && t < rangeEnd) {
      out.push({
        key: `${ev.id}::${t}`,
        event: ev,
        start: t,
        end: t + dur,
        resourceId: ev.resourceId,
        occurrenceStart: t,
      });
    }
  };
  const done = (t: number) =>
    t > until || t >= rangeEnd || (r.count !== undefined && emitted >= r.count);

  if (r.freq === "weekly") {
    const days = [...new Set(r.byWeekday?.length ? r.byWeekday : [getDay(first)])].sort();
    const week0 = startOfWeek(first, { weekStartsOn: 0 });
    for (let w = 0; w < HARD_LIMIT; w += interval) {
      const wk = addWeeks(week0, w);
      let stop = false;
      for (const d of days) {
        const day = addDays(wk, d);
        day.setHours(first.getHours(), first.getMinutes(), 0, 0);
        const t = day.getTime();
        if (t < start) continue;
        if (done(t)) {
          stop = true;
          break;
        }
        push(t);
      }
      if (stop) break;
    }
    return out;
  }

  for (let i = 0; i < HARD_LIMIT; i++) {
    const d = r.freq === "daily" ? addDays(first, i * interval) : addMonths(first, i * interval);
    const t = d.getTime();
    if (done(t)) break;
    // Skip monthly dates that date-fns clamped (e.g. Jan 31 -> Feb 28).
    if (r.freq === "monthly" && d.getDate() !== first.getDate()) {
      emitted++;
      continue;
    }
    push(t);
  }
  return out;
}

export function describeRecurrence(ev: SchedulerEvent): string | null {
  const r = ev.recurrence;
  if (!r) return null;
  const n = r.interval ?? 1;
  const unit = { daily: "day", weekly: "week", monthly: "month" }[r.freq];
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let s = n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
  if (r.freq === "weekly" && r.byWeekday?.length)
    s += ` on ${r.byWeekday.map((d) => names[d]).join(", ")}`;
  if (r.count) s += `, ${r.count} times`;
  if (r.until) s += `, until ${r.until.slice(0, 10)}`;
  return s;
}
