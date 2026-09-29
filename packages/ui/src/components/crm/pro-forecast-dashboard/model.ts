import { addMonths, format } from "date-fns";
import type {
  DrillFilter,
  ForecastCategory,
  ForecastDeal,
  Granularity,
  Movement,
  PeriodBucket,
  QuotaFn,
  WaterfallStep,
} from "@/components/crm/pro-forecast-dashboard/types";

export const STACK_KEYS = ["closed", "commit", "best", "pipeline"] as const;
export type StackKey = (typeof STACK_KEYS)[number];

export const CATEGORY_LABEL: Record<ForecastCategory, string> = {
  closed: "Closed won",
  commit: "Commit",
  best: "Best case",
  pipeline: "Pipeline",
  lost: "Closed lost",
};

export const CATEGORY_COLOR: Record<StackKey, string> = {
  closed: "var(--color-crm-success, #22c55e)",
  commit: "var(--color-crm-primary, #4124fb)",
  best: "#8b7cf6",
  pipeline: "var(--color-crm-track, #3a3a3a)",
};

export const MOVEMENT_LABEL: Record<Movement, string> = {
  new: "New deals",
  "pulled-in": "Pulled in",
  upgraded: "Upgraded to commit",
  increased: "Increased",
  decreased: "Decreased",
  downgraded: "Downgraded",
  slipped: "Slipped out",
  lost: "Lost",
};

const MOVEMENT_ORDER: Movement[] = [
  "new",
  "pulled-in",
  "upgraded",
  "increased",
  "decreased",
  "downgraded",
  "slipped",
  "lost",
];

/** Categories that count toward the called forecast in the waterfall. */
export const FORECAST_CATS: ReadonlySet<ForecastCategory> = new Set(["closed", "commit"]);

/** Start of the (fiscal) period containing `d`. */
export function periodStart(d: Date, g: Granularity, fyStartMonth: number): Date {
  if (g === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
  const fyYear = d.getMonth() >= fyStartMonth ? d.getFullYear() : d.getFullYear() - 1;
  if (g === "year") return new Date(fyYear, fyStartMonth, 1);
  const offset = (d.getMonth() - fyStartMonth + 12) % 12;
  return new Date(fyYear, fyStartMonth + Math.floor(offset / 3) * 3, 1);
}

export function periodEnd(start: Date, g: Granularity): Date {
  return addMonths(start, g === "month" ? 1 : g === "quarter" ? 3 : 12);
}

const fyLabel = (start: Date, fyStartMonth: number) => {
  const endYear = fyStartMonth === 0 ? start.getFullYear() : start.getFullYear() + 1;
  return `FY${String(endYear).slice(-2)}`;
};

export function periodKey(start: Date): string {
  return format(start, "yyyy-MM");
}

export function periodLabel(start: Date, g: Granularity, fyStartMonth: number): string {
  if (g === "month") return format(start, "MMM yy");
  const fyStart = periodStart(start, "year", fyStartMonth);
  if (g === "year") return fyLabel(fyStart, fyStartMonth);
  const q = Math.floor(((start.getMonth() - fyStartMonth + 12) % 12) / 3) + 1;
  return `Q${q} ${fyLabel(fyStart, fyStartMonth)}`;
}

/** The periods shown for a granularity around `asOf`: the fiscal year's months/quarters, or 3 years. */
export function visiblePeriods(asOf: Date, g: Granularity, fyStartMonth: number): Date[] {
  const fy = periodStart(asOf, "year", fyStartMonth);
  if (g === "year") return [-12, 0, 12].map((m) => addMonths(fy, m));
  const n = g === "month" ? 12 : 4;
  const step = g === "month" ? 1 : 3;
  return Array.from({ length: n }, (_, i) => addMonths(fy, i * step));
}

/** One pass over deals: O(n + periods). */
export function buildBuckets(
  deals: readonly ForecastDeal[],
  asOf: Date,
  g: Granularity,
  fyStartMonth: number,
  quota?: QuotaFn,
): PeriodBucket[] {
  const starts = visiblePeriods(asOf, g, fyStartMonth);
  const byKey = new Map<string, PeriodBucket>();
  const buckets = starts.map((start) => {
    const b: PeriodBucket = {
      key: periodKey(start),
      label: periodLabel(start, g, fyStartMonth),
      start,
      end: periodEnd(start, g),
      closed: 0,
      commit: 0,
      best: 0,
      pipeline: 0,
      quota: quota?.(start, g) ?? null,
      count: 0,
    };
    byKey.set(b.key, b);
    return b;
  });
  for (const d of deals) {
    if (d.category === "lost") continue;
    const b = byKey.get(periodKey(periodStart(d.closeDate, g, fyStartMonth)));
    if (!b) continue;
    b[d.category] += d.amount;
    b.count += 1;
  }
  return buckets;
}

const inRange = (d: Date, s: Date, e: Date) => d >= s && d < e;

/** Classify how a deal moved the called forecast of [start, end). `null` = no effect. */
export function classify(
  d: ForecastDeal,
  start: Date,
  end: Date,
): { movement: Movement; delta: number } | null {
  if (d.prior === undefined) return null;
  const p = d.prior;
  const inPrior = !!p && FORECAST_CATS.has(p.category) && inRange(p.closeDate, start, end);
  const inNow = FORECAST_CATS.has(d.category) && inRange(d.closeDate, start, end);
  if (!inPrior && inNow) {
    if (!p) return { movement: "new", delta: d.amount };
    if (!inRange(p.closeDate, start, end)) return { movement: "pulled-in", delta: d.amount };
    return { movement: "upgraded", delta: d.amount };
  }
  if (inPrior && !inNow) {
    if (d.category === "lost") return { movement: "lost", delta: -p!.amount };
    if (!inRange(d.closeDate, start, end)) return { movement: "slipped", delta: -p!.amount };
    return { movement: "downgraded", delta: -p!.amount };
  }
  if (inPrior && inNow) {
    const delta = d.amount - p!.amount;
    if (delta > 0) return { movement: "increased", delta };
    if (delta < 0) return { movement: "decreased", delta };
  }
  return null;
}

/** Forecast change waterfall for one period: prior call → movements → current call. */
export function buildWaterfall(
  deals: readonly ForecastDeal[],
  start: Date,
  end: Date,
): { steps: WaterfallStep[]; movementById: Map<string, { movement: Movement; delta: number }> } {
  let current = 0;
  const sums = new Map<Movement, { value: number; count: number }>();
  const movementById = new Map<string, { movement: Movement; delta: number }>();
  for (const d of deals) {
    if (FORECAST_CATS.has(d.category) && inRange(d.closeDate, start, end)) current += d.amount;
    const m = classify(d, start, end);
    if (!m) continue;
    movementById.set(d.id, m);
    const s = sums.get(m.movement) ?? { value: 0, count: 0 };
    s.value += m.delta;
    s.count += 1;
    sums.set(m.movement, s);
  }
  // Deals without snapshot history cannot be attributed; fold them into the opening balance.
  const attributed = [...sums.values()].reduce((a, s) => a + s.value, 0);
  const opening = current - attributed;
  const steps: WaterfallStep[] = [
    { id: "start", label: "Last call", value: opening, base: 0, count: 0, kind: "total" },
  ];
  let running = opening;
  for (const m of MOVEMENT_ORDER) {
    const s = sums.get(m);
    if (!s || s.value === 0) continue;
    const base = s.value >= 0 ? running : running + s.value;
    steps.push({
      id: m,
      label: MOVEMENT_LABEL[m],
      value: s.value,
      base,
      count: s.count,
      kind: s.value >= 0 ? "up" : "down",
    });
    running += s.value;
  }
  steps.push({
    id: "end",
    label: "Current call",
    value: current,
    base: 0,
    count: 0,
    kind: "total",
  });
  return { steps, movementById };
}

export function matchesDrill(
  d: ForecastDeal,
  f: DrillFilter,
  bucketOf: (d: ForecastDeal) => string,
  movementOf: (d: ForecastDeal) => Movement | undefined,
): boolean {
  if (f.periodKey && bucketOf(d) !== f.periodKey) return false;
  if (f.category && d.category !== f.category) return false;
  if (f.movement && movementOf(d) !== f.movement) return false;
  return true;
}
