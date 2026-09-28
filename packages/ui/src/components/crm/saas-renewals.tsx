import * as React from "react";
import { AlertTriangle, CalendarClock, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { EmptyState, Skeleton } from "@/components/crm/feedback";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export type RenewalForecast = "commit" | "likely" | "at-risk" | "churning";

export interface SaasRenewal {
  id: string;
  account: string;
  owner: string;
  /** ISO date the contract ends. */
  renewalDate: string;
  currentArr: number;
  /** Proposed price change in percent (e.g. 7 for +7%, -10 for a discount). */
  upliftPct: number;
  forecast: RenewalForecast;
  /** Days of notice required to cancel (auto-renew contracts). */
  noticeDays?: number;
  autoRenew?: boolean;
  note?: string;
}

export interface SaasRenewalsProps {
  renewals: SaasRenewal[];
  /** Controlled forecast overrides are applied through onForecastChange. */
  onForecastChange?: (id: string, forecast: RenewalForecast) => void;
  onUpliftChange?: (id: string, upliftPct: number) => void;
  today?: Date;
  /** Days ahead to include (overdue items are always shown). */
  horizon?: 30 | 60 | 90 | 180;
  defaultHorizon?: 30 | 60 | 90 | 180;
  currency?: string;
  locale?: string;
  loading?: boolean;
  error?: string;
  className?: string;
}

const forecastMeta: Record<RenewalForecast, { label: string; color: TagColor; weight: number }> = {
  commit: { label: "Commit", color: "green", weight: 1 },
  likely: { label: "Likely", color: "blue", weight: 0.8 },
  "at-risk": { label: "At risk", color: "amber", weight: 0.4 },
  churning: { label: "Churning", color: "red", weight: 0 },
};

function daysBetween(iso: string, today: Date) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - t) / 86_400_000);
}

/** Probability-weighted renewal ARR for one renewal. */
export function weightedRenewalArr(r: SaasRenewal) {
  return r.currentArr * (1 + r.upliftPct / 100) * forecastMeta[r.forecast].weight;
}

/** Renewal desk: upcoming contracts grouped by urgency, editable forecast + uplift, notice-window alerts, weighted and gross retention forecast. */
export function SaasRenewals({
  renewals,
  onForecastChange,
  onUpliftChange,
  today = new Date(),
  horizon,
  defaultHorizon = 90,
  currency = "USD",
  locale = "en-US",
  loading,
  error,
  className,
}: SaasRenewalsProps) {
  const [innerH, setInnerH] = React.useState(defaultHorizon);
  const h = horizon ?? innerH;
  const [local, setLocal] = React.useState<Record<string, Partial<SaasRenewal>>>({});
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const items = renewals
    .map((r) => ({ ...r, ...local[r.id] }))
    .map((r) => ({ r, days: daysBetween(r.renewalDate, today) }))
    .filter(({ days }) => days <= h)
    .sort((a, b) => a.days - b.days);

  const buckets = [
    { id: "overdue", label: "Past renewal date", test: (d: number) => d < 0 },
    { id: "30", label: "Next 30 days", test: (d: number) => d >= 0 && d <= 30 },
    { id: "60", label: "31–60 days", test: (d: number) => d > 30 && d <= 60 },
    { id: "90", label: "61–90 days", test: (d: number) => d > 60 && d <= 90 },
    { id: "later", label: "91–180 days", test: (d: number) => d > 90 },
  ];

  const current = items.reduce((s, { r }) => s + r.currentArr, 0);
  const weighted = items.reduce((s, { r }) => s + weightedRenewalArr(r), 0);
  const retained = items
    .filter(({ r }) => r.forecast !== "churning")
    .reduce((s, { r }) => s + Math.min(r.currentArr, r.currentArr * (1 + r.upliftPct / 100)), 0);
  const grr = current ? retained / current : 0;
  const nrr = current ? weighted / current : 0;

  const update = (id: string, patch: Partial<SaasRenewal>) => {
    setLocal((l) => ({ ...l, [id]: { ...l[id], ...patch } }));
    if (patch.forecast) onForecastChange?.(id, patch.forecast);
    if (patch.upliftPct !== undefined) onUpliftChange?.(id, patch.upliftPct);
  };

  return (
    <section
      aria-label="Renewals"
      className={cn(
        "flex flex-col rounded-crm border border-crm-border bg-crm-card font-crm shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-crm-border p-3">
        <SegmentedControl
          label="Renewal horizon"
          size="sm"
          value={String(h)}
          onValueChange={(v) => {
            const n = Number(v) as 30 | 60 | 90 | 180;
            if (horizon === undefined) setInnerH(n);
          }}
          options={[30, 60, 90, 180].map((n) => ({ value: String(n), label: `${n}d` }))}
        />
        <dl className="flex flex-wrap gap-5 text-xs" aria-live="polite">
          <div>
            <dt className="text-crm-subtle">Up for renewal</dt>
            <dd className="text-crm-fg tabular-nums">{money.format(current)}</dd>
          </div>
          <div>
            <dt className="text-crm-subtle">Weighted forecast</dt>
            <dd className="text-crm-fg tabular-nums">{money.format(weighted)}</dd>
          </div>
          <div>
            <dt className="text-crm-subtle">Forecast GRR</dt>
            <dd className={cn("tabular-nums", grr < 0.9 ? "text-crm-warning" : "text-crm-success")}>
              {(grr * 100).toFixed(1)}%
            </dd>
          </div>
          <div>
            <dt className="text-crm-subtle">Forecast NRR</dt>
            <dd className={cn("tabular-nums", nrr < 1 ? "text-crm-warning" : "text-crm-success")}>
              {(nrr * 100).toFixed(1)}%
            </dd>
          </div>
        </dl>
      </header>

      {error ? (
        <EmptyState
          tone="error"
          icon={<AlertTriangle />}
          title="Couldn't load renewals"
          description={error}
        />
      ) : loading ? (
        <div className="flex flex-col gap-2 p-3" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<RefreshCcw />}
          title="No renewals in this window"
          description="Widen the horizon to see later contracts."
        />
      ) : (
        <div className="flex flex-col">
          {buckets.map((b) => {
            const list = items.filter(({ days }) => b.test(days));
            if (!list.length) return null;
            const sum = list.reduce((s, { r }) => s + r.currentArr, 0);
            return (
              <div key={b.id} role="group" aria-label={b.label}>
                <h3
                  className={cn(
                    "crm-eyebrow flex justify-between border-b border-crm-border bg-crm-raised px-3 py-1.5",
                    b.id === "overdue" ? "text-crm-danger" : "text-crm-subtle",
                  )}
                >
                  <span>
                    {b.label} · {list.length}
                  </span>
                  <span className="tabular-nums">{money.format(sum)}</span>
                </h3>
                <ul>
                  {list.map(({ r, days }) => {
                    const next = r.currentArr * (1 + r.upliftPct / 100);
                    const noticeLeft =
                      r.autoRenew && r.noticeDays !== undefined ? days - r.noticeDays : null;
                    return (
                      <li
                        key={r.id}
                        className="grid grid-cols-1 items-center gap-2 border-b border-crm-border px-3 py-2.5 text-sm last:border-b-0 md:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar name={r.owner} size="md" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-crm-fg">{r.account}</p>
                            <p className="flex items-center gap-1 text-xs text-crm-subtle">
                              <CalendarClock className="size-3" aria-hidden />
                              {dateFmt.format(new Date(`${r.renewalDate}T00:00:00`))} ·{" "}
                              <span
                                className={cn(
                                  days < 0
                                    ? "text-crm-danger"
                                    : days <= 30
                                      ? "text-crm-warning"
                                      : "",
                                )}
                              >
                                {days < 0 ? `${-days}d overdue` : `${days}d left`}
                              </span>
                              {noticeLeft !== null ? (
                                <span
                                  className={cn(
                                    noticeLeft < 0
                                      ? "text-crm-faint"
                                      : noticeLeft <= 14
                                        ? "text-crm-warning"
                                        : "",
                                  )}
                                >
                                  {" "}
                                  ·{" "}
                                  {noticeLeft < 0
                                    ? "notice window closed"
                                    : `notice closes in ${noticeLeft}d`}
                                </span>
                              ) : null}
                            </p>
                            {r.note ? (
                              <p className="truncate text-xs text-crm-soft">{r.note}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-xs tabular-nums">
                          <span className="text-crm-soft">{money.format(r.currentArr)} → </span>
                          <span className="text-crm-fg">{money.format(next)}</span>
                        </div>
                        <label className="flex items-center gap-1 text-xs text-crm-soft">
                          Uplift
                          <input
                            type="number"
                            step={0.5}
                            min={-50}
                            max={50}
                            value={r.upliftPct}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v))
                                update(r.id, { upliftPct: Math.max(-50, Math.min(50, v)) });
                            }}
                            className="h-7 w-16 rounded-crm border border-crm-border bg-crm-raised px-1.5 text-right text-xs text-crm-fg tabular-nums focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
                            aria-label={`${r.account} uplift percent`}
                          />
                          %
                        </label>
                        <div className="flex items-center gap-2">
                          <Tag size="sm" color={forecastMeta[r.forecast].color}>
                            {forecastMeta[r.forecast].label}
                          </Tag>
                          <select
                            value={r.forecast}
                            onChange={(e) =>
                              update(r.id, { forecast: e.target.value as RenewalForecast })
                            }
                            aria-label={`${r.account} forecast category`}
                            className="h-7 rounded-crm border border-crm-border bg-crm-raised px-1.5 text-xs text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
                          >
                            {(Object.keys(forecastMeta) as RenewalForecast[]).map((f) => (
                              <option key={f} value={f}>
                                {forecastMeta[f].label} ({Math.round(forecastMeta[f].weight * 100)}
                                %)
                              </option>
                            ))}
                          </select>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
