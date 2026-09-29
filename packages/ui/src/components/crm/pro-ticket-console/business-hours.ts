import { TZDate } from "@date-fns/tz";
import { addDays, format, getDay, set, startOfDay } from "date-fns";
import type { BusinessHours } from "@/components/crm/pro-ticket-console/types";

export interface ResolvedBusinessHours {
  timeZone: string;
  days: Set<number>;
  startMin: number;
  endMin: number;
  holidays: Set<string>;
}

const MAX_DAYS = 800;

function parseHm(v: string, fallback: number) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
}

export function resolveBusinessHours(bh: BusinessHours = {}): ResolvedBusinessHours {
  const startMin = parseHm(bh.start ?? "09:00", 540);
  const endMin = Math.max(startMin + 1, parseHm(bh.end ?? "18:00", 1080));
  return {
    timeZone: bh.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    days: new Set(bh.days ?? [1, 2, 3, 4, 5]),
    startMin,
    endMin,
    holidays: new Set(bh.holidays ?? []),
  };
}

/** Working window [open, close] of the zone-local day containing `day`, or null when closed. */
function windowOf(day: TZDate, bh: ResolvedBusinessHours): [number, number] | null {
  if (!bh.days.has(getDay(day)) || bh.holidays.has(format(day, "yyyy-MM-dd"))) return null;
  const d0 = startOfDay(day);
  const open = set(d0, { hours: Math.floor(bh.startMin / 60), minutes: bh.startMin % 60 });
  const close = set(d0, { hours: Math.floor(bh.endMin / 60), minutes: bh.endMin % 60 });
  return [open.getTime(), close.getTime()];
}

/** Adds `minutes` of working time to `from`, skipping nights, weekends and holidays (DST safe). */
export function addBusinessMinutes(
  from: Date | number,
  minutes: number,
  bh: ResolvedBusinessHours,
) {
  let remaining = minutes * 60_000;
  let cursor = new TZDate(+from, bh.timeZone);
  for (let i = 0; i < MAX_DAYS; i++) {
    const w = windowOf(cursor, bh);
    if (w) {
      const start = Math.max(cursor.getTime(), w[0]);
      if (start < w[1]) {
        const avail = w[1] - start;
        if (avail >= remaining) return new Date(start + remaining);
        remaining -= avail;
      }
    }
    cursor = startOfDay(addDays(cursor, 1));
  }
  return new Date(cursor.getTime());
}

/** Working milliseconds between a and b; negative when b is before a. */
export function businessMsBetween(a: number, b: number, bh: ResolvedBusinessHours): number {
  if (b < a) return -businessMsBetween(b, a, bh);
  let total = 0;
  let cursor = new TZDate(a, bh.timeZone);
  for (let i = 0; i < MAX_DAYS && cursor.getTime() < b; i++) {
    const w = windowOf(cursor, bh);
    if (w) {
      const s = Math.max(cursor.getTime(), w[0]);
      const e = Math.min(b, w[1]);
      if (e > s) total += e - s;
    }
    cursor = startOfDay(addDays(cursor, 1));
  }
  return total;
}

export function isWithinBusinessHours(at: number, bh: ResolvedBusinessHours) {
  const w = windowOf(new TZDate(at, bh.timeZone), bh);
  return !!w && at >= w[0] && at < w[1];
}

/** "2h 05m" / "3d 4h" style compact duration. */
export function formatDuration(ms: number) {
  const neg = ms < 0;
  let m = Math.floor(Math.abs(ms) / 60_000);
  const d = Math.floor(m / 1440);
  m -= d * 1440;
  const h = Math.floor(m / 60);
  m -= h * 60;
  const s = Math.floor((Math.abs(ms) % 60_000) / 1000);
  const body =
    d > 0
      ? `${d}d ${h}h`
      : h > 0
        ? `${h}h ${String(m).padStart(2, "0")}m`
        : `${m}m ${String(s).padStart(2, "0")}s`;
  return neg ? `-${body}` : body;
}
