import * as React from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";
import { segmentItem } from "@/components/crm/pro-forecast-dashboard/chart-frame";
import { DealsTable, type DealRow } from "@/components/crm/pro-forecast-dashboard/deals-table";
import { ForecastChart } from "@/components/crm/pro-forecast-dashboard/forecast-chart";
import {
  buildBuckets,
  buildWaterfall,
  CATEGORY_LABEL,
  MOVEMENT_LABEL,
  periodKey,
  periodStart,
  type StackKey,
} from "@/components/crm/pro-forecast-dashboard/model";
import type {
  DrillFilter,
  ForecastDeal,
  Granularity,
  QuotaFn,
} from "@/components/crm/pro-forecast-dashboard/types";
import { WaterfallChart } from "@/components/crm/pro-forecast-dashboard/waterfall-chart";

export type {
  DealSnapshot,
  DrillFilter,
  ForecastCategory,
  ForecastDeal,
  Granularity,
  Movement,
  QuotaFn,
} from "@/components/crm/pro-forecast-dashboard/types";

export interface ProForecastDashboardProps {
  deals: ForecastDeal[];
  /** Quota per period; return null when there is none. */
  quota?: QuotaFn;
  /** "Today" for the forecast; defaults to now. */
  asOf?: Date;
  /** 0 = January. Drives quarter and FY labels. */
  fiscalYearStartMonth?: number;
  granularity?: Granularity;
  defaultGranularity?: Granularity;
  onGranularityChange?: (g: Granularity) => void;
  /** Controlled drilldown. */
  drill?: DrillFilter;
  onDrillChange?: (d: DrillFilter) => void;
  currency?: string;
  locale?: string;
  /** Label of the comparison snapshot, e.g. "Mon 23 Sep call". */
  snapshotLabel?: string;
  title?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onDealClick?: (deal: ForecastDeal) => void;
  className?: string;
}

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

/**
 * Sales-leadership forecast view: stacked closed / commit / best-case / pipeline vs quota,
 * a change waterfall since the last call, and a virtualized deal drilldown.
 */
export function ProForecastDashboard({
  deals,
  quota,
  asOf: asOfProp,
  fiscalYearStartMonth = 0,
  granularity: gProp,
  defaultGranularity = "quarter",
  onGranularityChange,
  drill: drillProp,
  onDrillChange,
  currency = "USD",
  locale = "en-US",
  snapshotLabel = "last call",
  title = "Revenue forecast",
  loading = false,
  error = null,
  onRetry,
  onDealClick,
  className,
}: ProForecastDashboardProps) {
  const [g, setG] = useControllableState(gProp, defaultGranularity, onGranularityChange);
  const [drill, setDrill] = useControllableState<DrillFilter>(drillProp, {}, onDrillChange);
  const [hidden, setHidden] = React.useState<ReadonlySet<StackKey>>(new Set());
  const asOfTime = (asOfProp ?? new Date()).getTime();
  const asOf = React.useMemo(() => new Date(asOfTime), [asOfTime]);

  const fmt = React.useMemo(() => {
    const full = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    const compact = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    });
    return { full: (n: number) => full.format(n), compact: (n: number) => compact.format(n) };
  }, [locale, currency]);

  const buckets = React.useMemo(
    () => buildBuckets(deals, asOf, g, fiscalYearStartMonth, quota),
    [deals, asOf, g, fiscalYearStartMonth, quota],
  );

  const currentKey = periodKey(periodStart(asOf, g, fiscalYearStartMonth));
  const focus =
    buckets.find((b) => b.key === drill.periodKey) ??
    buckets.find((b) => b.key === currentKey) ??
    buckets[0];

  const waterfall = React.useMemo(
    () =>
      focus
        ? buildWaterfall(deals, focus.start, focus.end)
        : { steps: [], movementById: new Map() },
    [deals, focus],
  );

  const rows = React.useMemo<DealRow[]>(() => {
    const out: DealRow[] = [];
    const bucketKey = (d: ForecastDeal) =>
      periodKey(periodStart(d.closeDate, g, fiscalYearStartMonth));
    for (const d of deals) {
      const m = waterfall.movementById.get(d.id);
      if (drill.movement) {
        if (m?.movement !== drill.movement) continue;
      } else {
        if (drill.periodKey && bucketKey(d) !== drill.periodKey) continue;
        if (drill.category && d.category !== drill.category) continue;
      }
      out.push(m ? { ...d, movement: m.movement, delta: m.delta } : d);
    }
    return out;
  }, [deals, drill, waterfall, g, fiscalYearStartMonth]);

  const changeGranularity = (next: Granularity) => {
    setG(next);
    setDrill({});
  };

  const filters = [
    drill.periodKey && {
      id: "period",
      label: buckets.find((b) => b.key === drill.periodKey)?.label ?? drill.periodKey,
      onClear: () => setDrill({}),
    },
    drill.category && {
      id: "category",
      label: CATEGORY_LABEL[drill.category],
      onClear: () => setDrill({ ...drill, category: undefined }),
    },
    drill.movement && {
      id: "movement",
      label: `${MOVEMENT_LABEL[drill.movement]} · ${focus?.label ?? ""}`,
      onClear: () => setDrill({ ...drill, movement: undefined }),
    },
  ].filter(Boolean) as { id: string; label: string; onClear: () => void }[];

  const k = focus
    ? (() => {
        const called = focus.closed + focus.commit;
        const q = focus.quota;
        const gap = q != null ? Math.max(0, q - focus.closed) : null;
        const open = focus.commit + focus.best + focus.pipeline;
        return [
          { label: "Quota", value: q != null ? fmt.full(q) : "—" },
          {
            label: "Closed won",
            value: fmt.full(focus.closed),
            sub: q ? `${Math.round((focus.closed / q) * 100)}% of quota` : undefined,
          },
          {
            label: "Called (closed + commit)",
            value: fmt.full(called),
            sub: q ? `${Math.round((called / q) * 100)}% attainment` : undefined,
            tone: q ? (called >= q ? "good" : called >= q * 0.9 ? "warn" : "bad") : undefined,
          },
          {
            label: "Best case upside",
            value: fmt.full(focus.best),
            sub: q ? `${Math.round(((called + focus.best) / q) * 100)}% if all land` : undefined,
          },
          {
            label: "Pipeline coverage",
            value: gap ? `${(open / gap).toFixed(1)}×` : gap === 0 ? "Quota met" : "—",
            sub: gap ? `${fmt.compact(open)} open for ${fmt.compact(gap)} gap` : undefined,
            tone: gap ? (open / gap >= 3 ? "good" : open / gap >= 2 ? "warn" : "bad") : undefined,
          },
        ] as { label: string; value: string; sub?: string; tone?: "good" | "warn" | "bad" }[];
      })()
    : [];

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-crm-fg">{title}</h2>
        <p className="text-xs text-crm-muted-fg">
          {focus ? `${focus.label} · ` : ""}
          {deals.length.toLocaleString()} deals · compared with {snapshotLabel}
        </p>
      </div>
      <ToggleGroup.Root
        type="single"
        value={g}
        onValueChange={(v) => v && changeGranularity(v as Granularity)}
        aria-label="Period"
        className="flex rounded-[6px] border border-crm-border bg-crm-card p-0.5"
      >
        {GRANULARITIES.map((x) => (
          <ToggleGroup.Item key={x.value} value={x.value} className={cn(segmentItem, "px-3")}>
            {x.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );

  if (error) {
    return (
      <div className={cn("flex flex-col gap-4 font-crm", className)}>
        {header}
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-crm border border-crm-border bg-crm-card px-6 py-12 text-center"
        >
          <AlertCircle className="size-6 text-crm-danger" aria-hidden />
          <p className="text-sm text-crm-fg">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-crm-input px-3 text-sm text-crm-fg hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
            >
              <RefreshCw className="size-3.5" aria-hidden /> Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading forecast"
        className={cn("flex flex-col gap-4 font-crm", className)}
      >
        {header}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-crm bg-crm-muted" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-80 animate-pulse rounded-crm bg-crm-muted lg:col-span-2" />
          <div className="h-80 animate-pulse rounded-crm bg-crm-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-4 font-crm text-crm-fg", className)}>
      {header}
      {deals.length === 0 ? (
        <div className="rounded-crm border border-dashed border-crm-input px-6 py-12 text-center text-sm text-crm-muted-fg">
          No deals in this forecast yet. Deals with a close date in the fiscal year will appear
          here.
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {k.map((x) => (
              <div
                key={x.label}
                className="rounded-crm border border-crm-border bg-crm-card px-3 py-2.5 shadow-crm-raised"
              >
                <dt className="truncate text-xs text-crm-muted-fg">{x.label}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{x.value}</dd>
                {x.sub && (
                  <dd
                    className={cn(
                      "truncate text-xs text-crm-subtle",
                      x.tone === "good" && "text-crm-success",
                      x.tone === "warn" && "text-crm-warning",
                      x.tone === "bad" && "text-crm-danger",
                    )}
                  >
                    {x.sub}
                  </dd>
                )}
              </div>
            ))}
          </dl>
          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <ForecastChart
              buckets={buckets}
              format={fmt.full}
              formatCompact={fmt.compact}
              drill={drill}
              hidden={hidden}
              onToggleSeries={(key) =>
                setHidden((h) => {
                  const n = new Set(h);
                  if (n.has(key)) n.delete(key);
                  else n.add(key);
                  return n;
                })
              }
              onDrill={(pk, cat) =>
                setDrill(
                  drill.periodKey === pk && drill.category === cat && !drill.movement
                    ? {}
                    : { periodKey: pk, category: cat },
                )
              }
            />
            <WaterfallChart
              steps={waterfall.steps}
              periodLabel={focus?.label ?? ""}
              format={fmt.full}
              formatCompact={fmt.compact}
              activeMovement={drill.movement}
              onSelectMovement={(m) =>
                setDrill(
                  m ? { periodKey: focus?.key, movement: m } : { periodKey: drill.periodKey },
                )
              }
            />
          </div>
          <DealsTable rows={rows} format={fmt.full} filters={filters} onDealClick={onDealClick} />
        </>
      )}
    </div>
  );
}
