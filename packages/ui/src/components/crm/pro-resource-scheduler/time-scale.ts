import { TZDate } from "@date-fns/tz";
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { SchedulerView } from "@/components/crm/pro-resource-scheduler/types";

export interface TimeScale {
  view: SchedulerView;
  timeZone: string;
  start: number;
  end: number;
  pxPerMs: number;
  width: number;
  /** Snap step in ms for drag. */
  snapMs: number;
  /** Major ticks (labelled groups) and minor ticks (grid lines). */
  major: { x: number; w: number; label: string }[];
  minor: { x: number; label: string; weekend?: boolean }[];
  toX: (t: number) => number;
  toTime: (x: number) => number;
  snap: (t: number) => number;
}

const MIN = 60_000;
const CONFIG: Record<
  SchedulerView,
  { pxPerMinute: number; snapMinutes: number; minorFmt: string; majorFmt: string }
> = {
  day: { pxPerMinute: 72 / 60, snapMinutes: 15, minorFmt: "HH:mm", majorFmt: "EEEE d MMMM" },
  week: { pxPerMinute: 216 / 1440, snapMinutes: 60, minorFmt: "HH", majorFmt: "EEE d MMM" },
  month: { pxPerMinute: 52 / 1440, snapMinutes: 1440, minorFmt: "d", majorFmt: "MMMM yyyy" },
};

export function rangeFor(
  view: SchedulerView,
  anchor: number,
  timeZone: string,
  weekStartsOn: 0 | 1,
) {
  const a = new TZDate(anchor, timeZone);
  if (view === "day") {
    const s = startOfDay(a);
    return [s, addDays(s, 1)] as const;
  }
  if (view === "week") {
    const s = startOfWeek(a, { weekStartsOn });
    return [s, addWeeks(s, 1)] as const;
  }
  const s = startOfMonth(a);
  return [s, addMonths(s, 1)] as const;
}

export function shiftAnchor(view: SchedulerView, anchor: number, dir: 1 | -1, timeZone: string) {
  const a = new TZDate(anchor, timeZone);
  return (
    view === "day" ? addDays(a, dir) : view === "week" ? addWeeks(a, dir) : addMonths(a, dir)
  ).getTime();
}

/**
 * Linear time -> pixel mapping over real elapsed time, so DST days are 23h/25h wide and bars never
 * drift from their labels. Tick labels are generated in the chosen zone with date-fns.
 */
export function buildScale(
  view: SchedulerView,
  anchor: number,
  timeZone: string,
  weekStartsOn: 0 | 1 = 1,
): TimeScale {
  const cfg = CONFIG[view];
  const [s, e] = rangeFor(view, anchor, timeZone, weekStartsOn);
  const start = s.getTime();
  const end = e.getTime();
  const pxPerMs = cfg.pxPerMinute / MIN;
  const toX = (t: number) => (t - start) * pxPerMs;
  const snapMs = cfg.snapMinutes * MIN;
  const major: TimeScale["major"] = [];
  const minor: TimeScale["minor"] = [];

  if (view === "month") {
    major.push({ x: 0, w: toX(end), label: format(s, cfg.majorFmt) });
    const days = differenceInCalendarDays(e, s);
    for (let i = 0; i < days; i++) {
      const d = addDays(s, i);
      minor.push({
        x: toX(d.getTime()),
        label: format(d, "EEEEE d"),
        weekend: [0, 6].includes(d.getDay()),
      });
    }
  } else {
    const days = differenceInCalendarDays(e, s);
    for (let i = 0; i < days; i++) {
      const d = addDays(s, i);
      const x = toX(d.getTime());
      major.push({ x, w: toX(addDays(d, 1).getTime()) - x, label: format(d, cfg.majorFmt) });
      const step = view === "day" ? 1 : 6;
      for (let h = 0; h < 24; h += step) {
        const t = addHours(d, h);
        if (t.getTime() >= addDays(d, 1).getTime()) break;
        minor.push({
          x: toX(t.getTime()),
          label: format(t, cfg.minorFmt),
          weekend: [0, 6].includes(d.getDay()),
        });
      }
    }
  }

  // Sub-day snaps count from local midnight of the range; day snaps round to the nearest local
  // midnight in the zone so they stay on day boundaries across DST changes.
  const snap = (t: number) =>
    snapMs >= 1440 * MIN
      ? startOfDay(new TZDate(t + snapMs / 2, timeZone)).getTime()
      : start + Math.round((t - start) / snapMs) * snapMs;
  return {
    view,
    timeZone,
    start,
    end,
    pxPerMs,
    width: Math.ceil(toX(end)),
    snapMs,
    major,
    minor,
    toX,
    toTime: (x: number) => start + x / pxPerMs,
    snap,
  };
}
