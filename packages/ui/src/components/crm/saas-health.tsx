import * as React from "react";
import { Activity, AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { EmptyState } from "@/components/crm/feedback";
import { ProgressRing } from "@/components/crm/progress";
import { Slider } from "@/components/crm/slider";
import { Sparkline } from "@/components/crm/sparkline";
import { Tag } from "@/components/crm/tag";

export type HealthFactorKey = "usage" | "adoption" | "support" | "sentiment" | "billing";

export interface HealthAccount {
  id: string;
  name: string;
  arr: number;
  /** Raw factor scores, each 0–100. */
  factors: Record<HealthFactorKey, number>;
  /** Weekly composite scores, oldest first (for the trend). */
  history: number[];
}

export type HealthWeights = Record<HealthFactorKey, number>;

export interface SaasHealthProps {
  accounts: HealthAccount[];
  /** Controlled factor weights (any positive numbers; normalised to 100%). */
  weights?: HealthWeights;
  defaultWeights?: HealthWeights;
  onWeightsChange?: (weights: HealthWeights) => void;
  selectedId?: string;
  onSelectedIdChange?: (id: string) => void;
  currency?: string;
  locale?: string;
  className?: string;
}

export const DEFAULT_HEALTH_WEIGHTS: HealthWeights = {
  usage: 30,
  adoption: 25,
  support: 15,
  sentiment: 15,
  billing: 15,
};

const factorMeta: Record<HealthFactorKey, { label: string; hint: string }> = {
  usage: { label: "Product usage", hint: "Weekly active users vs. seats" },
  adoption: { label: "Feature adoption", hint: "Key features used of the core set" },
  support: { label: "Support load", hint: "Inverse of ticket volume and severity" },
  sentiment: { label: "Sentiment", hint: "NPS / CSAT normalised to 0–100" },
  billing: { label: "Billing", hint: "On-time payments, no failed charges" },
};

const keys = Object.keys(factorMeta) as HealthFactorKey[];

/** Weighted composite health score (0–100) with weights normalised to sum to 1. */
export function healthScore(factors: Record<HealthFactorKey, number>, weights: HealthWeights) {
  const total = keys.reduce((s, k) => s + Math.max(0, weights[k]), 0);
  if (!total) return 0;
  return keys.reduce((s, k) => s + (factors[k] * Math.max(0, weights[k])) / total, 0);
}

const band = (s: number) =>
  s >= 70
    ? { label: "Healthy", color: "green" as const, tone: "success" as const }
    : s >= 40
      ? { label: "Needs attention", color: "amber" as const, tone: "warning" as const }
      : { label: "At risk", color: "red" as const, tone: "danger" as const };

/** Customer health workbench: tunable factor weights, recomputed ranking, per-account driver breakdown with each factor's point contribution. */
export function SaasHealth({
  accounts,
  weights: weightsProp,
  defaultWeights = DEFAULT_HEALTH_WEIGHTS,
  onWeightsChange,
  selectedId,
  onSelectedIdChange,
  currency = "USD",
  locale = "en-US",
  className,
}: SaasHealthProps) {
  const [innerW, setInnerW] = React.useState(defaultWeights);
  const weights = weightsProp ?? innerW;
  const setWeights = (w: HealthWeights) => {
    if (!weightsProp) setInnerW(w);
    onWeightsChange?.(w);
  };
  const [innerSel, setInnerSel] = React.useState(accounts[0]?.id ?? "");
  const selId = selectedId ?? innerSel;
  const select = (id: string) => {
    if (selectedId === undefined) setInnerSel(id);
    onSelectedIdChange?.(id);
  };
  const money = new Intl.NumberFormat(locale, { style: "currency", currency, notation: "compact" });
  const wTotal = keys.reduce((s, k) => s + Math.max(0, weights[k]), 0);

  const ranked = accounts
    .map((a) => ({ a, score: healthScore(a.factors, weights) }))
    .sort((x, y) => x.score - y.score);
  const current = ranked.find((r) => r.a.id === selId) ?? ranked[0];

  if (!accounts.length)
    return (
      <EmptyState
        icon={<Activity />}
        title="No accounts to score"
        description="Health scores appear once usage data syncs."
        className={cn("rounded-crm border border-crm-border bg-crm-card", className)}
      />
    );

  const onListKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const i = ranked.findIndex((r) => r.a.id === current?.a.id);
    const next = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : -2;
    const target = ranked[next];
    if (next !== -2 && target) {
      e.preventDefault();
      select(target.a.id);
      e.currentTarget.querySelector<HTMLElement>(`[data-id="${target.a.id}"]`)?.focus();
    }
  };

  return (
    <section
      aria-label="Customer health"
      className={cn("grid gap-3 font-crm lg:grid-cols-[260px_minmax(0,1fr)_260px]", className)}
    >
      <div className="rounded-crm border border-crm-border bg-crm-card shadow-crm-raised">
        <h3 className="crm-eyebrow border-b border-crm-border px-3 py-2 text-crm-subtle">
          Lowest health first
        </h3>
        <ul
          role="listbox"
          aria-label="Accounts by health"
          onKeyDown={onListKey}
          className="max-h-96 overflow-y-auto p-1"
        >
          {ranked.map(({ a, score }) => {
            const active = a.id === current?.a.id;
            const b = band(score);
            return (
              <li
                key={a.id}
                data-id={a.id}
                role="option"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => select(a.id)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-crm px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-crm-primary",
                  active ? "bg-crm-raised text-crm-fg" : "text-crm-soft hover:bg-crm-raised/60",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{a.name}</span>
                  <span className="text-xs text-crm-subtle tabular-nums">
                    {money.format(a.arr)} ARR
                  </span>
                </span>
                <Tag size="sm" color={b.color} className="tabular-nums">
                  {Math.round(score)}
                </Tag>
              </li>
            );
          })}
        </ul>
      </div>

      {current ? (
        <div className="flex flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <div className="flex items-center gap-4">
            <ProgressRing
              value={Math.round(current.score)}
              size={72}
              tone={band(current.score).tone}
              label={`${current.a.name} health score`}
            />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold text-crm-fg">{current.a.name}</h3>
              <Tag size="sm" color={band(current.score).color}>
                {band(current.score).label}
              </Tag>
              {current.a.history.length > 1 ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-crm-soft">
                  <Sparkline
                    data={current.a.history}
                    height={20}
                    label={`${current.a.name} 12-week health`}
                  />
                  {(() => {
                    const h = current.a.history;
                    const d = (h[h.length - 1] ?? 0) - (h[0] ?? 0);
                    return (
                      <span
                        className={cn(
                          "tabular-nums",
                          d < 0 ? "text-crm-danger" : "text-crm-success",
                        )}
                      >
                        {d > 0 ? "+" : ""}
                        {d} pts over {h.length} wks
                      </span>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          </div>
          <table className="w-full text-sm">
            <caption className="sr-only">Health drivers</caption>
            <thead>
              <tr className="crm-caption text-crm-subtle">
                <th scope="col" className="pb-1 text-left font-normal">
                  Driver
                </th>
                <th scope="col" className="pb-1 text-right font-normal">
                  Score
                </th>
                <th scope="col" className="pb-1 text-right font-normal">
                  Weight
                </th>
                <th scope="col" className="pb-1 text-right font-normal">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const v = current.a.factors[k];
                const w = wTotal ? Math.max(0, weights[k]) / wTotal : 0;
                const lost = (100 - v) * w;
                return (
                  <tr key={k} className="border-t border-crm-border">
                    <th scope="row" className="py-2 text-left font-normal">
                      <span className="block text-crm-fg">{factorMeta[k].label}</span>
                      <span
                        className="block h-1 w-full max-w-48 overflow-hidden rounded-full bg-crm-muted"
                        aria-hidden
                      >
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            v >= 70
                              ? "bg-crm-success"
                              : v >= 40
                                ? "bg-crm-warning"
                                : "bg-crm-danger",
                          )}
                          style={{ width: `${v}%` }}
                        />
                      </span>
                    </th>
                    <td className="text-right text-crm-fg tabular-nums">{v}</td>
                    <td className="text-right text-crm-soft tabular-nums">
                      {Math.round(w * 100)}%
                    </td>
                    <td className="text-right tabular-nums">
                      <span className="text-crm-fg">{(v * w).toFixed(1)}</span>
                      {lost >= 5 ? (
                        <span className="block text-xs text-crm-danger">
                          −{lost.toFixed(1)} lost
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(() => {
            const worst = keys
              .map((k) => ({
                k,
                lost:
                  (100 - current.a.factors[k]) * (wTotal ? Math.max(0, weights[k]) / wTotal : 0),
              }))
              .sort((a, b) => b.lost - a.lost)[0];
            return worst && worst.lost >= 5 ? (
              <p className="flex items-start gap-1.5 rounded-crm border border-crm-border bg-crm-raised p-2 text-xs text-crm-soft">
                <AlertTriangle className="mt-0.5 size-3 shrink-0 text-crm-warning" aria-hidden />
                Biggest lever: {factorMeta[worst.k].label.toLowerCase()} (
                {factorMeta[worst.k].hint.toLowerCase()}) — recovering it is worth up to{" "}
                {worst.lost.toFixed(1)} points.
              </p>
            ) : null;
          })()}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-crm-fg">Score model</h3>
          <Button size="sm" variant="ghost" onClick={() => setWeights(DEFAULT_HEALTH_WEIGHTS)}>
            <RotateCcw className="size-3" aria-hidden /> Reset
          </Button>
        </div>
        {keys.map((k) => (
          <Slider
            key={k}
            label={factorMeta[k].label}
            min={0}
            max={50}
            step={5}
            value={weights[k]}
            onValueChange={(v) => setWeights({ ...weights, [k]: v })}
            formatValue={(v) => `${wTotal ? Math.round((v / wTotal) * 100) : 0}%`}
          />
        ))}
        {wTotal === 0 ? (
          <p role="alert" className="text-xs text-crm-danger">
            All weights are zero — raise at least one factor.
          </p>
        ) : (
          <p className="text-xs text-crm-subtle">
            Weights are normalised to 100%. Ranking updates live.
          </p>
        )}
      </div>
    </section>
  );
}
