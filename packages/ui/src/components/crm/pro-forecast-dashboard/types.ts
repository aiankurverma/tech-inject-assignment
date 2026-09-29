/** Forecast category a rep has put the deal in (plus terminal states). */
export type ForecastCategory = "closed" | "commit" | "best" | "pipeline" | "lost";

export type Granularity = "month" | "quarter" | "year";

/** The deal as it stood at the comparison snapshot (e.g. last Monday's call). */
export interface DealSnapshot {
  amount: number;
  closeDate: Date;
  category: ForecastCategory;
}

export interface ForecastDeal {
  id: string;
  name: string;
  account: string;
  owner: string;
  stage: string;
  amount: number;
  closeDate: Date;
  category: ForecastCategory;
  /** State at the comparison snapshot. `null` = created since then. Omit when unknown. */
  prior?: DealSnapshot | null;
}

/** Why a deal moved the forecast between the snapshot and now. */
export type Movement =
  "new" | "pulled-in" | "upgraded" | "increased" | "decreased" | "downgraded" | "slipped" | "lost";

export interface PeriodBucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
  closed: number;
  commit: number;
  best: number;
  pipeline: number;
  quota: number | null;
  count: number;
}

export interface WaterfallStep {
  id: "start" | Movement | "end";
  label: string;
  value: number;
  /** Running total before this step (bar base). */
  base: number;
  count: number;
  kind: "total" | "up" | "down";
}

export type QuotaFn = (periodStart: Date, granularity: Granularity) => number | null | undefined;

export interface DrillFilter {
  periodKey?: string;
  category?: ForecastCategory;
  movement?: Movement;
}
