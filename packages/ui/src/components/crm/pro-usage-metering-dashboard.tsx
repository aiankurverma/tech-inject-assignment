import * as React from "react";
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { AlertTriangle, Gauge, Receipt, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUsageForecast } from "@/hooks/use-usage-forecast";
import {
  formatMoney,
  formatPct,
  formatQuantity,
  type DateRangeValue,
  type MeterSummary,
  type UsageMeter,
  type UsageRecord,
} from "@/components/crm/pro-usage-metering-dashboard/types";
import { MeterChart } from "@/components/crm/pro-usage-metering-dashboard/meter-chart";
import { QuotaBar } from "@/components/crm/pro-usage-metering-dashboard/quota-bar";
import { CostBreakdown } from "@/components/crm/pro-usage-metering-dashboard/cost-breakdown";
import { ThresholdEditor } from "@/components/crm/pro-usage-metering-dashboard/threshold-editor";
import {
  DateRangePicker,
  type RangePreset,
} from "@/components/crm/pro-usage-metering-dashboard/date-range-picker";

export type {
  DateRangeValue,
  MeterSummary,
  UsageMeter,
  UsageRecord,
} from "@/components/crm/pro-usage-metering-dashboard/types";

export interface ProUsageMeteringDashboardProps {
  meters: UsageMeter[];
  records: UsageRecord[];
  /** "Today": days after it are forecast. Default: now. */
  asOf?: Date;
  /** Controlled billing-period / view range. */
  range?: DateRangeValue;
  /** Uncontrolled initial range; default is the calendar month containing asOf. */
  defaultRange?: DateRangeValue;
  onRangeChange?: (range: DateRangeValue) => void;
  /** Controlled alert thresholds keyed by meter id (fractions of limit). */
  thresholds?: Record<string, number[]>;
  onThresholdsChange?: (next: Record<string, number[]>) => void;
  /** Base platform fee added to the bill. */
  baseFee?: number;
  currency?: string;
  /** Trailing days used for the forecast's daily rate. Default 7. */
  forecastWindowDays?: number;
  /** Dimension keys offered in the breakdown; inferred from records when omitted. */
  dimensions?: string[];
  presets?: RangePreset[];
  loading?: boolean;
  error?: React.ReactNode;
  onRetry?: () => void;
  /** Read-only mode hides the threshold editor controls. */
  readOnly?: boolean;
  className?: string;
}

function inferDimensions(records: UsageRecord[]): string[] {
  const keys = new Set<string>();
  const step = Math.max(1, Math.floor(records.length / 500));
  for (let i = 0; i < records.length; i += step) {
    const d = records[i]!.dimensions;
    if (d) for (const k in d) keys.add(k);
  }
  return [...keys];
}

/**
 * Usage-based billing dashboard: per-meter cumulative series with limit and alert lines, quota bars,
 * a linear forecast to period end, projected bill, cost breakdown by dimension and alert editing.
 */
export function ProUsageMeteringDashboard({
  meters,
  records,
  asOf: asOfProp,
  range: rangeProp,
  defaultRange,
  onRangeChange,
  thresholds: thresholdsProp,
  onThresholdsChange,
  baseFee = 0,
  currency = "USD",
  forecastWindowDays = 7,
  dimensions: dimensionsProp,
  presets,
  loading,
  error,
  onRetry,
  readOnly,
  className,
}: ProUsageMeteringDashboardProps) {
  const asOf = React.useMemo(() => asOfProp ?? new Date(), [asOfProp]);
  const [innerRange, setInnerRange] = React.useState<DateRangeValue>(
    () => defaultRange ?? { from: startOfMonth(asOf), to: endOfMonth(asOf) },
  );
  const range = rangeProp ?? innerRange;
  const setRange = (r: DateRangeValue) => {
    if (!rangeProp) setInnerRange(r);
    onRangeChange?.(r);
  };

  const [innerThresholds, setInnerThresholds] = React.useState<Record<string, number[]>>({});
  const thresholds = thresholdsProp ?? innerThresholds;
  const setThresholds = (t: Record<string, number[]>) => {
    if (!thresholdsProp) setInnerThresholds(t);
    onThresholdsChange?.(t);
  };

  const dimensions = React.useMemo(
    () => dimensionsProp ?? inferDimensions(records),
    [dimensionsProp, records],
  );
  const [dimension, setDimension] = React.useState<string>("");
  const activeDimension = dimensions.includes(dimension) ? dimension : (dimensions[0] ?? "");

  const f = useUsageForecast(meters, records, range, asOf, forecastWindowDays, thresholds);
  const [selected, setSelected] = React.useState<string | null>(null);
  const focused = f.summaries.find((s) => s.meter.id === selected) ?? f.summaries[0];
  const alerts = f.summaries.filter((s) => s.breached !== null || (s.projectedRatio ?? 0) >= 1);

  const shell = cn(
    "flex flex-col gap-4 rounded-crm border border-crm-border bg-crm-bg p-4 text-crm-fg shadow-crm-raised",
    className,
  );

  if (error) {
    return (
      <div className={shell} role="alert">
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <AlertTriangle className="h-6 w-6 text-crm-danger" aria-hidden />
          <p className="text-sm font-medium">Couldn't load usage</p>
          <p className="text-xs text-crm-muted-fg">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 h-8 rounded-crm bg-crm-primary px-3 text-xs font-medium text-crm-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={shell} aria-busy={loading || undefined}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Usage & billing</h2>
          <p className="text-xs text-crm-muted-fg">
            Day {Math.min(f.elapsedDays, f.totalDays)} of {f.totalDays} - data through{" "}
            {format(asOf, "MMM d")}
          </p>
        </div>
        <DateRangePicker
          value={range}
          onChange={setRange}
          asOf={asOf}
          presets={presets}
          disabled={loading}
        />
      </header>

      {loading ? (
        <div role="status" aria-label="Loading usage" className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-crm bg-crm-muted" />
          ))}
          <div className="h-64 animate-pulse rounded-crm bg-crm-muted sm:col-span-4" />
        </div>
      ) : meters.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Gauge className="h-6 w-6 text-crm-icon" aria-hidden />
          <p className="text-sm font-medium">No meters configured</p>
          <p className="text-xs text-crm-muted-fg">
            Define a meter to start tracking metered usage.
          </p>
        </div>
      ) : (
        <>
          <section aria-label="Bill summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={<Receipt className="h-4 w-4" />}
              label="Bill to date"
              value={formatMoney(baseFee + f.totals.cost, currency)}
              hint={`incl. ${formatMoney(baseFee, currency)} platform fee`}
            />
            <Kpi
              icon={<TrendingUp className="h-4 w-4" />}
              label="Projected bill"
              value={formatMoney(baseFee + f.totals.projectedCost, currency)}
              hint={`+${formatMoney(f.totals.projectedCost - f.totals.cost, currency)} by ${format(range.to, "MMM d")}`}
            />
            <Kpi
              icon={<Gauge className="h-4 w-4" />}
              label="Period elapsed"
              value={`${Math.round((f.elapsedDays / f.totalDays) * 100)}%`}
              hint={`${Math.max(0, f.totalDays - f.elapsedDays)} days left`}
            />
            <Kpi
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Active alerts"
              value={String(alerts.length)}
              hint={
                alerts.length
                  ? alerts.map((a) => a.meter.name).join(", ")
                  : "All meters within thresholds"
              }
              tone={alerts.length ? "warning" : undefined}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section
              aria-labelledby="meters-title"
              className="rounded-crm border border-crm-border bg-crm-card"
            >
              <h3 id="meters-title" className="sr-only">
                Meters
              </h3>
              <MeterTabs
                summaries={f.summaries}
                selected={focused?.meter.id}
                onSelect={setSelected}
              />
              {focused && (
                <div
                  className="space-y-4 p-4"
                  role="tabpanel"
                  id={`meter-panel-${focused.meter.id}`}
                  aria-labelledby={`meter-tab-${focused.meter.id}`}
                >
                  <MeterHeadline s={focused} currency={currency} />
                  <MeterChart summary={focused} data={f.series[focused.meter.id] ?? []} />
                  <QuotaBar summary={focused} />
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <section
                aria-labelledby="quotas-title"
                className="rounded-crm border border-crm-border bg-crm-card p-4"
              >
                <h3 id="quotas-title" className="mb-3 text-sm font-medium">
                  Quotas
                </h3>
                <ul className="space-y-4">
                  {f.summaries.map((s) => (
                    <li key={s.meter.id}>
                      <p className="mb-1 flex justify-between text-xs">
                        <span>{s.meter.name}</span>
                        <span className="tabular-nums text-crm-muted-fg">
                          {formatMoney(s.projectedCost, currency)}
                        </span>
                      </p>
                      <QuotaBar summary={s} />
                    </li>
                  ))}
                </ul>
              </section>
              {!readOnly && (
                <section
                  aria-labelledby="alerts-title"
                  className="rounded-crm border border-crm-border bg-crm-card p-4"
                >
                  <h3 id="alerts-title" className="mb-3 text-sm font-medium">
                    Alert thresholds
                  </h3>
                  <ThresholdEditor meters={meters} value={thresholds} onChange={setThresholds} />
                </section>
              )}
            </aside>
          </div>

          {activeDimension && (
            <CostBreakdown
              records={f.inRange}
              summaries={f.summaries}
              dimensions={dimensions}
              dimension={activeDimension}
              onDimensionChange={setDimension}
              currency={currency}
            />
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "warning";
}) {
  return (
    <div className="rounded-crm border border-crm-border bg-crm-card p-3">
      <p className="flex items-center gap-1.5 text-xs text-crm-muted-fg">
        <span className="text-crm-icon" aria-hidden>
          {icon}
        </span>
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          tone === "warning" && "text-crm-warning",
        )}
      >
        {value}
      </p>
      <p className="truncate text-[11px] text-crm-muted-fg" title={hint}>
        {hint}
      </p>
    </div>
  );
}

function MeterTabs({
  summaries,
  selected,
  onSelect,
}: {
  summaries: MeterSummary[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const n = summaries.length;
    const next =
      e.key === "ArrowRight"
        ? (i + 1) % n
        : e.key === "ArrowLeft"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    onSelect(summaries[next]!.meter.id);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label="Meters"
      className="flex gap-1 overflow-x-auto border-b border-crm-border px-2 pt-2"
    >
      {summaries.map((s, i) => {
        const active = s.meter.id === selected;
        return (
          <button
            key={s.meter.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`meter-tab-${s.meter.id}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={`meter-panel-${s.meter.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(s.meter.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
              active
                ? "border-crm-primary text-crm-fg"
                : "border-transparent text-crm-muted-fg hover:text-crm-fg",
            )}
          >
            {s.meter.name}
            {s.breached !== null && (
              <span className="h-1.5 w-1.5 rounded-full bg-crm-warning" aria-label="alert" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function MeterHeadline({ s, currency }: { s: MeterSummary; currency: string }) {
  const m = s.meter;
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-2xl font-semibold tabular-nums">{formatQuantity(s.used, m.unit)}</p>
        <p className="text-xs text-crm-muted-fg">
          {m.limit !== undefined
            ? `${formatPct(s.ratio)} of ${formatQuantity(m.limit, m.unit)}`
            : "No limit"}{" "}
          - {formatQuantity(s.dailyRate, m.unit)}/day trailing avg
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
        <dt className="text-crm-muted-fg">Forecast</dt>
        <dd className="text-right tabular-nums">{formatQuantity(s.projected, m.unit)}</dd>
        <dt className="text-crm-muted-fg">Projected overage</dt>
        <dd className="text-right tabular-nums">{formatMoney(s.projectedCost, currency)}</dd>
        {s.exhaustsOn && (
          <>
            <dt className="text-crm-danger">Limit reached</dt>
            <dd className="text-right tabular-nums text-crm-danger">
              {format(parseISO(s.exhaustsOn), "MMM d")}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
