import * as React from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { SearchInput } from "@/components/crm/search-input";

export interface HealthAccount {
  id: string;
  name: string;
  arr: number;
  /** 0..100 composite health score. */
  score: number;
  /** Score 30 days ago, for trend. */
  previousScore?: number;
  /** ISO renewal date. */
  renewalDate?: string;
  owner?: { name: string; avatar?: string };
  /** Top drivers, e.g. "Usage -32%", "2 P1 tickets". */
  signals?: string[];
}

export type HealthBand = "healthy" | "neutral" | "at-risk" | "critical";

export interface HealthOverviewProps {
  accounts: HealthAccount[];
  currency?: string;
  /** Score thresholds (lower bound of each band). */
  thresholds?: { healthy: number; neutral: number; atRisk: number };
  asOf?: string;
  /** Renewal window (days) that triggers the "renewing soon" flag. */
  renewalWindowDays?: number;
  onAccountSelect?: (id: string) => void;
  className?: string;
}

const bands: { key: HealthBand; label: string; bar: string; tag: string }[] = [
  {
    key: "healthy",
    label: "Healthy",
    bar: "bg-crm-success",
    tag: "border-tag-green-border bg-tag-green-bg text-tag-green-text",
  },
  {
    key: "neutral",
    label: "Neutral",
    bar: "bg-crm-faint",
    tag: "border-tag-neutral-border bg-tag-neutral-bg text-tag-neutral-text",
  },
  {
    key: "at-risk",
    label: "At risk",
    bar: "bg-crm-warning",
    tag: "border-tag-amber-border bg-tag-amber-bg text-tag-amber-text",
  },
  {
    key: "critical",
    label: "Critical",
    bar: "bg-crm-danger",
    tag: "border-tag-red-border bg-tag-red-bg text-tag-red-text",
  },
];

export function healthBand(
  score: number,
  t = { healthy: 75, neutral: 55, atRisk: 35 },
): HealthBand {
  return score >= t.healthy
    ? "healthy"
    : score >= t.neutral
      ? "neutral"
      : score >= t.atRisk
        ? "at-risk"
        : "critical";
}

/**
 * Customer health overview: ARR-weighted band distribution (click to filter), ARR at risk,
 * renewing-soon flags, score movers and a sortable account list with drivers.
 */
export function HealthOverview({
  accounts,
  currency = "USD",
  thresholds,
  asOf,
  renewalWindowDays = 90,
  onAccountSelect,
  className,
}: HealthOverviewProps) {
  const [band, setBand] = React.useState<HealthBand | null>(null);
  const [renewingOnly, setRenewingOnly] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<"risk" | "arr" | "renewal" | "movers">("risk");
  const now = asOf ? Date.parse(asOf) : Date.now();

  const money = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);

  const enriched = React.useMemo(
    () =>
      accounts.map((a) => ({
        a,
        band: healthBand(a.score, thresholds),
        delta: a.previousScore !== undefined ? a.score - a.previousScore : 0,
        renewIn: a.renewalDate
          ? Math.ceil((Date.parse(a.renewalDate) - now) / 86_400_000)
          : undefined,
      })),
    [accounts, thresholds, now],
  );

  const byBand = bands.map((b) => {
    const xs = enriched.filter((e) => e.band === b.key);
    return { ...b, count: xs.length, arr: xs.reduce((s, e) => s + e.a.arr, 0) };
  });
  const totalArr = byBand.reduce((s, b) => s + b.arr, 0);
  const atRiskArr = byBand
    .filter((b) => b.key === "at-risk" || b.key === "critical")
    .reduce((s, b) => s + b.arr, 0);
  const soon = enriched.filter(
    (e) => e.renewIn !== undefined && e.renewIn >= 0 && e.renewIn <= renewalWindowDays,
  );
  const soonRisk = soon.filter((e) => e.band === "at-risk" || e.band === "critical");

  const list = enriched
    .filter((e) => (!band || e.band === band) && (!renewingOnly || soon.includes(e)))
    .filter((e) => e.a.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((x, y) =>
      sort === "arr"
        ? y.a.arr - x.a.arr
        : sort === "renewal"
          ? (x.renewIn ?? 1e9) - (y.renewIn ?? 1e9)
          : sort === "movers"
            ? x.delta - y.delta
            : x.a.score - y.a.score || y.a.arr - x.a.arr,
    );

  return (
    <section
      aria-label="Customer health overview"
      className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}
    >
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="crm-eyebrow text-crm-subtle">Account health</p>
              <h2 className="text-lg font-semibold tracking-tight">
                {money(totalArr)} ARR · {accounts.length} accounts
              </h2>
            </div>
            <p className="text-sm">
              <span className="font-semibold text-crm-danger tabular-nums">{money(atRiskArr)}</span>{" "}
              <span className="text-crm-subtle">
                at risk ({totalArr ? Math.round((atRiskArr / totalArr) * 100) : 0}%)
              </span>
            </p>
          </div>
          <div
            className="flex h-3 w-full overflow-hidden rounded-full bg-crm-muted"
            role="img"
            aria-label="ARR by health band"
          >
            {byBand.map((b) => (
              <span
                key={b.key}
                className={cn("h-full", b.bar, band && band !== b.key && "opacity-30")}
                style={{ width: `${totalArr ? (b.arr / totalArr) * 100 : 0}%` }}
              />
            ))}
          </div>
          <div
            className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="group"
            aria-label="Filter by health band"
          >
            {byBand.map((b) => (
              <button
                key={b.key}
                type="button"
                aria-pressed={band === b.key}
                onClick={() => setBand(band === b.key ? null : b.key)}
                className="rounded-crm border border-crm-border p-2 text-left hover:bg-crm-muted/50 aria-[pressed=true]:border-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
              >
                <span className="flex items-center gap-1.5 text-xs text-crm-soft">
                  <span className={cn("size-2 rounded-full", b.bar)} aria-hidden />
                  {b.label}
                </span>
                <span className="block text-base font-semibold tabular-nums">{b.count}</span>
                <span className="text-[11px] text-crm-subtle tabular-nums">{money(b.arr)}</span>
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          aria-pressed={renewingOnly}
          onClick={() => setRenewingOnly(!renewingOnly)}
          className="flex flex-col justify-between gap-2 rounded-crm border border-crm-border bg-crm-card p-4 text-left shadow-crm-raised hover:bg-crm-muted/40 aria-[pressed=true]:border-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none md:w-56"
        >
          <span className="flex items-center gap-1.5 text-xs text-crm-soft">
            <CalendarClock className="size-3.5" aria-hidden /> Renewing ≤ {renewalWindowDays}d
          </span>
          <span className="text-2xl font-semibold tabular-nums">{soon.length}</span>
          {soon.length ? (
            <span className="flex flex-col gap-1 border-t border-crm-border pt-2">
              {[...soon]
                .sort((x, y) => (x.renewIn ?? 0) - (y.renewIn ?? 0))
                .slice(0, 3)
                .map((e) => (
                  <span key={e.a.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          bands.find((b) => b.key === e.band)?.bar,
                        )}
                        aria-hidden
                      />
                      <span className="truncate text-crm-soft">{e.a.name}</span>
                    </span>
                    <span className="shrink-0 text-crm-subtle tabular-nums">{e.renewIn}d</span>
                  </span>
                ))}
            </span>
          ) : null}
          <span className="text-xs text-crm-subtle">
            <span className={cn(soonRisk.length && "font-medium text-crm-danger")}>
              {soonRisk.length} unhealthy
            </span>{" "}
            · {money(soon.reduce((s, e) => s + e.a.arr, 0))}
          </span>
        </button>
      </div>

      <div className="rounded-crm border border-crm-border bg-crm-card shadow-crm-raised">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-crm-border p-3">
          <SearchInput
            size="sm"
            placeholder="Search accounts"
            value={q}
            onValueChange={setQ}
            className="max-w-60"
          />
          <label className="flex items-center gap-1.5 text-xs text-crm-subtle">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-7 rounded-crm border border-crm-border bg-crm-input px-1.5 text-xs text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
            >
              <option value="risk">Lowest score</option>
              <option value="arr">Highest ARR</option>
              <option value="renewal">Soonest renewal</option>
              <option value="movers">Biggest drop</option>
            </select>
          </label>
        </div>
        {list.length === 0 ? (
          <p className="p-8 text-center text-sm text-crm-subtle">
            No accounts match these filters.
          </p>
        ) : (
          <ul className="divide-y divide-crm-border">
            <li
              aria-hidden
              className="hidden grid-cols-[1fr_120px_110px_120px] gap-x-3 bg-crm-muted/30 px-4 py-2 text-[11px] font-medium tracking-wide text-crm-subtle uppercase sm:grid"
            >
              <span>Account · drivers</span>
              <span className="text-right">Score · 30d Δ</span>
              <span className="text-right">ARR</span>
              <span className="text-right">Renews · owner</span>
            </li>
            {list.map(({ a, band: bk, delta, renewIn }) => {
              const b = bands.find((x) => x.key === bk);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onAccountSelect?.(a.id)}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-crm-muted/40 focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none focus-visible:ring-inset sm:grid-cols-[1fr_120px_110px_120px]"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{a.name}</span>
                        <span
                          className={cn("shrink-0 rounded-full border px-1.5 text-[10px]", b?.tag)}
                        >
                          {b?.label}
                        </span>
                      </span>
                      {a.signals?.length ? (
                        <span className="block truncate text-xs text-crm-subtle">
                          {a.signals.join(" · ")}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center justify-end gap-1.5">
                      <span className="text-sm font-semibold tabular-nums">{a.score}</span>
                      {delta ? (
                        <span
                          className={cn(
                            "inline-flex items-center text-xs tabular-nums",
                            delta > 0 ? "text-crm-success" : "text-crm-danger",
                          )}
                        >
                          {delta > 0 ? (
                            <ArrowUpRight className="size-3" aria-hidden />
                          ) : (
                            <ArrowDownRight className="size-3" aria-hidden />
                          )}
                          {Math.abs(delta)}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs tabular-nums sm:text-right">{money(a.arr)}</span>
                    <span className="flex items-center justify-end gap-2 text-xs">
                      <span
                        className={cn(
                          "tabular-nums",
                          renewIn !== undefined && renewIn <= renewalWindowDays && renewIn >= 0
                            ? "font-medium text-crm-warning"
                            : "text-crm-subtle",
                        )}
                      >
                        {renewIn === undefined ? "—" : renewIn < 0 ? "Lapsed" : `${renewIn}d`}
                      </span>
                      {a.owner ? <Avatar name={a.owner.name} src={a.owner.avatar} /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
