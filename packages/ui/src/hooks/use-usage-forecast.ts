import * as React from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isAfter,
  max as maxDate,
  min as minDate,
} from "date-fns";
import {
  overageCost,
  type DateRangeValue,
  type MeterSummary,
  type SeriesPoint,
  type UsageMeter,
  type UsageRecord,
} from "@/components/crm/pro-usage-metering-dashboard/types";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export interface UsageForecast {
  summaries: MeterSummary[];
  series: Record<string, SeriesPoint[]>;
  /** Records inside the range with day <= asOf, used by the cost breakdown. */
  inRange: UsageRecord[];
  totals: { cost: number; projectedCost: number };
  elapsedDays: number;
  totalDays: number;
}

/**
 * Aggregates raw usage records (single O(n) pass) into per-meter daily buckets, cumulative series
 * and a linear forecast to period end based on the trailing `windowDays` average daily rate.
 */
export function useUsageForecast(
  meters: UsageMeter[],
  records: UsageRecord[],
  range: DateRangeValue,
  asOf: Date,
  windowDays = 7,
  thresholdsOverride?: Record<string, number[]>,
): UsageForecast {
  const fromIso = iso(range.from);
  const toIso = iso(range.to);
  const asOfIso = iso(asOf);

  // Bucket once; independent of thresholds so editing alerts never re-scans records.
  const buckets = React.useMemo(() => {
    const cutoff = asOfIso < toIso ? asOfIso : toIso;
    const byMeter = new Map<string, Map<string, number>>();
    const inRange: UsageRecord[] = [];
    for (const r of records) {
      if (r.date < fromIso || r.date > cutoff) continue;
      inRange.push(r);
      let m = byMeter.get(r.meterId);
      if (!m) byMeter.set(r.meterId, (m = new Map()));
      m.set(r.date, (m.get(r.date) ?? 0) + r.quantity);
    }
    return { byMeter, inRange };
  }, [records, fromIso, toIso, asOfIso]);

  return React.useMemo(() => {
    const totalDays = differenceInCalendarDays(range.to, range.from) + 1;
    const lastActual = minDate([asOf, range.to]);
    const elapsedDays = isAfter(range.from, asOf)
      ? 0
      : differenceInCalendarDays(lastActual, range.from) + 1;
    const days: string[] = [];
    for (let i = 0; i < totalDays; i++) days.push(iso(addDays(range.from, i)));

    const series: Record<string, SeriesPoint[]> = {};
    const summaries: MeterSummary[] = [];
    let cost = 0;
    let projectedCost = 0;

    for (const meter of meters) {
      const daily = buckets.byMeter.get(meter.id) ?? new Map<string, number>();
      const windowStart = iso(maxDate([range.from, addDays(lastActual, -(windowDays - 1))]));
      let windowSum = 0;
      let windowLen = 0;
      const points: SeriesPoint[] = [];
      let cum = 0;
      for (const d of days) {
        if (d > asOfIso) break;
        const q = daily.get(d) ?? 0;
        cum += q;
        if (d >= windowStart) {
          windowSum += q;
          windowLen++;
        }
        points.push({ date: d, actual: cum, daily: q });
      }
      const used = cum;
      const rate = windowLen ? windowSum / windowLen : 0;
      const remaining = totalDays - points.length;
      const projected = used + rate * remaining;

      let exhaustsOn: string | null = null;
      if (points.length) points[points.length - 1]!.forecast = used;
      for (let i = 0; i < remaining; i++) {
        const f = used + rate * (i + 1);
        const date = days[points.length]!;
        if (meter.limit !== undefined && exhaustsOn === null && f >= meter.limit) exhaustsOn = date;
        points.push({ date, forecast: f });
      }
      if (meter.limit !== undefined && used >= meter.limit) {
        exhaustsOn = points.find((p) => (p.actual ?? 0) >= meter.limit!)?.date ?? exhaustsOn;
      }

      const thresholds = thresholdsOverride?.[meter.id] ?? meter.alertThresholds ?? [];
      const ratio = meter.limit ? used / meter.limit : null;
      const breached =
        ratio === null
          ? null
          : ([...thresholds].sort((a, b) => b - a).find((t) => ratio >= t) ?? null);
      const c = overageCost(meter, used);
      const pc = overageCost(meter, projected);
      cost += c;
      projectedCost += pc;
      series[meter.id] = points;
      summaries.push({
        meter: { ...meter, alertThresholds: thresholds },
        used,
        projected,
        dailyRate: rate,
        cost: c,
        projectedCost: pc,
        ratio,
        projectedRatio: meter.limit ? projected / meter.limit : null,
        breached,
        exhaustsOn,
      });
    }
    return {
      summaries,
      series,
      inRange: buckets.inRange,
      totals: { cost, projectedCost },
      elapsedDays,
      totalDays,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets, meters, fromIso, toIso, asOfIso, windowDays, thresholdsOverride]);
}
