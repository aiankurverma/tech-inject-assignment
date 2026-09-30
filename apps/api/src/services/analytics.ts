import { UsageDaily } from "../models";
import { log } from "../utils/logger";

export const USAGE_EVENTS = ["view", "copy", "install", "preview"] as const;
export type UsageEvent = (typeof USAGE_EVENTS)[number];
export type UsageField = "views" | "copies" | "installs" | "previews";
export const FIELD: Record<UsageEvent, UsageField> = {
  view: "views",
  copy: "copies",
  install: "installs",
  preview: "previews",
};
const FIELDS: UsageField[] = ["views", "copies", "installs", "previews"];
/** Pseudo-slug for downloads of the CLI tarball (not tied to one component). */
export const CLI_SLUG = "_cli";

export type Counts = Record<UsageField, number>;
export interface UsageRow extends Counts {
  day: string;
  slug: string;
}

const zero = (): Counts => ({ views: 0, copies: 0, installs: 0, previews: 0 });
export const utcDay = (d: Date) => d.toISOString().slice(0, 10);
const DAY_MS = 86_400_000;

/** Folds raw events into per-(day, slug) counters: the daily aggregation. */
export function aggregateEvents(events: { slug: string; type: UsageEvent; at: Date }[]) {
  const rows = new Map<string, UsageRow>();
  for (const e of events) {
    const day = utcDay(e.at);
    const key = `${day}|${e.slug}`;
    const row = rows.get(key) ?? { day, slug: e.slug, ...zero() };
    row[FIELD[e.type]] += 1;
    rows.set(key, row);
  }
  return [...rows.values()];
}

/** One `$inc` upsert per aggregated row (only non-zero counters). */
export function toUpsertOps(rows: UsageRow[]) {
  return rows.map(({ day, slug, ...counts }) => ({
    updateOne: {
      filter: { day, slug },
      update: {
        $inc: Object.fromEntries(FIELDS.filter((f) => counts[f]).map((f) => [f, counts[f]])),
      },
      upsert: true,
    },
  }));
}

/**
 * Buffers events in memory and flushes them every `flushMs` as one bulk write, so a burst of
 * beacons costs a single round trip. Recording never throws and never blocks a request.
 */
export function createUsageRecorder({ flushMs = 10_000, enabled = true } = {}) {
  let pending: { slug: string; type: UsageEvent; at: Date }[] = [];
  const flush = async () => {
    if (!pending.length) return;
    const rows = aggregateEvents(pending);
    pending = [];
    try {
      await UsageDaily.bulkWrite(toUpsertOps(rows), { ordered: false });
    } catch (e) {
      log.warn("usage flush failed", { error: String(e), rows: rows.length });
    }
  };
  const timer = enabled ? setInterval(() => void flush(), flushMs) : null;
  timer?.unref();
  return {
    record(slug: string, type: UsageEvent) {
      if (!enabled) return;
      pending.push({ slug, type, at: new Date() });
      if (pending.length >= 5_000) void flush();
    },
    flush,
    async close() {
      if (timer) clearInterval(timer);
      await flush();
    },
  };
}
export type UsageRecorder = ReturnType<typeof createUsageRecorder>;

export interface UsageSummary {
  days: number;
  totals: Counts;
  /** One entry per day in the range (zero-filled), oldest first. */
  daily: ({ day: string } & Counts)[];
  top: Record<"views" | "copies" | "installs", { slug: string; count: number }[]>;
  cliDownloads: number;
}

/** Turns stored daily rows into totals, a zero-filled daily series and top-N lists. */
export function summarizeUsage(
  rows: UsageRow[],
  days: number,
  now = new Date(),
  limit = 10,
): UsageSummary {
  const dayList: string[] = [];
  for (let i = days - 1; i >= 0; i--) dayList.push(utcDay(new Date(now.getTime() - i * DAY_MS)));
  const byDay = new Map(dayList.map((d) => [d, zero()]));
  const bySlug = new Map<string, Counts>();
  const totals = zero();
  let cliDownloads = 0;
  for (const r of rows) {
    const d = byDay.get(r.day);
    if (!d) continue;
    if (r.slug === CLI_SLUG) {
      cliDownloads += r.installs ?? 0;
      continue;
    }
    const s = bySlug.get(r.slug) ?? zero();
    for (const f of FIELDS) {
      const n = r[f] ?? 0;
      d[f] += n;
      s[f] += n;
      totals[f] += n;
    }
    bySlug.set(r.slug, s);
  }
  const topBy = (f: UsageField) =>
    [...bySlug.entries()]
      .filter(([, c]) => c[f] > 0)
      .sort((a, b) => b[1][f] - a[1][f] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([slug, c]) => ({ slug, count: c[f] }));
  return {
    days,
    totals,
    daily: dayList.map((day) => ({ day, ...byDay.get(day)! })),
    top: { views: topBy("views"), copies: topBy("copies"), installs: topBy("installs") },
    cliDownloads,
  };
}

/** Reads the rows for the last `days` days (bounded: days x published components). */
export async function loadUsage(days: number, now = new Date()) {
  const from = utcDay(new Date(now.getTime() - (days - 1) * DAY_MS));
  const rows = await UsageDaily.find({ day: { $gte: from } }, { _id: 0 }).lean<UsageRow[]>();
  return summarizeUsage(rows, days, now);
}
