export interface UsageMeter {
  id: string;
  name: string;
  /** Display unit, e.g. "requests", "GB", "seats". */
  unit: string;
  /** Hard or contractual limit for the billing period. Omit for unlimited. */
  limit?: number;
  /** Quantity included in the base plan before overage pricing applies. */
  included?: number;
  /** Price per `per` units above `included`. */
  unitPrice: number;
  /** Pricing block size; 1000 means "$x per 1k units". Default 1. */
  per?: number;
  /** Alert thresholds as fractions of `limit` (0.8 = 80%). */
  alertThresholds?: number[];
}

export interface UsageRecord {
  meterId: string;
  /** ISO day, "yyyy-mm-dd". */
  date: string;
  quantity: number;
  /** Arbitrary cost dimensions such as { region: "eu-west", project: "api" }. */
  dimensions?: Record<string, string>;
}

export interface DateRangeValue {
  from: Date;
  to: Date;
}

export interface MeterSummary {
  meter: UsageMeter;
  used: number;
  projected: number;
  /** Mean of the trailing window, per day. */
  dailyRate: number;
  cost: number;
  projectedCost: number;
  /** used / limit, or null when unlimited. */
  ratio: number | null;
  projectedRatio: number | null;
  /** Highest crossed threshold (fraction), or null. */
  breached: number | null;
  /** ISO day the forecast crosses the limit, if it does before period end. */
  exhaustsOn: string | null;
}

export interface SeriesPoint {
  date: string;
  /** Cumulative actual usage; undefined for future days. */
  actual?: number;
  /** Daily actual usage. */
  daily?: number;
  /** Cumulative forecast; only set on and after the as-of day. */
  forecast?: number;
}

export function overageCost(meter: UsageMeter, quantity: number): number {
  const billable = Math.max(0, quantity - (meter.included ?? 0));
  return (billable / (meter.per ?? 1)) * meter.unitPrice;
}

export function formatQuantity(n: number, unit?: string): string {
  const abs = Math.abs(n);
  const s =
    abs >= 1e9
      ? `${(n / 1e9).toFixed(1)}B`
      : abs >= 1e6
        ? `${(n / 1e6).toFixed(1)}M`
        : abs >= 1e4
          ? `${(n / 1e3).toFixed(1)}k`
          : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return unit ? `${s} ${unit}` : s;
}

const currencyCache = new Map<string, Intl.NumberFormat>();
export function formatMoney(n: number, currency = "USD"): string {
  let f = currencyCache.get(currency);
  if (!f) {
    f = new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 });
    currencyCache.set(currency, f);
  }
  return f.format(n);
}

export function formatPct(r: number | null): string {
  return r === null ? "Unlimited" : `${Math.round(r * 100)}%`;
}
