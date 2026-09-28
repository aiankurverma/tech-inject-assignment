import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { SegmentedControl } from "@/components/crm/segmented-control";

export interface ClosedDeal {
  id: string;
  name: string;
  outcome: "won" | "lost";
  amount: number;
  /** ISO close date. */
  closedAt: string;
  /** Primary win or loss reason. */
  reason: string;
  competitor?: string;
  segment?: string;
  /** Days from creation to close. */
  cycleDays?: number;
}

export interface WinLossReportProps {
  deals: ClosedDeal[];
  currency?: string;
  /** Group the trend by month or quarter. */
  bucket?: "month" | "quarter";
  onDealSelect?: (dealId: string) => void;
  className?: string;
}

function bucketOf(iso: string, b: "month" | "quarter") {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  return b === "quarter"
    ? `${y} Q${Math.floor(d.getUTCMonth() / 3) + 1}`
    : `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Win/loss analysis: win-rate trend, ranked win and loss reasons, competitor head-to-head
 * and a drill-down list. Clicking any reason, competitor or period filters everything else.
 */
export function WinLossReport({
  deals,
  currency = "USD",
  bucket = "quarter",
  onDealSelect,
  className,
}: WinLossReportProps) {
  const [segment, setSegment] = React.useState("All");
  const [filter, setFilter] = React.useState<{
    kind: "reason" | "competitor" | "period";
    value: string;
  } | null>(null);
  const [weight, setWeight] = React.useState<"count" | "amount">("count");

  const segments = React.useMemo(
    () => [
      "All",
      ...Array.from(new Set(deals.map((d) => d.segment).filter((s): s is string => !!s))),
    ],
    [deals],
  );

  const scoped = deals.filter((d) => segment === "All" || d.segment === segment);
  const filtered = scoped.filter((d) =>
    !filter
      ? true
      : filter.kind === "reason"
        ? d.reason === filter.value
        : filter.kind === "competitor"
          ? (d.competitor ?? "No competitor") === filter.value
          : bucketOf(d.closedAt, bucket) === filter.value,
  );

  const w = (d: ClosedDeal) => (weight === "amount" ? d.amount : 1);
  const won = filtered.filter((d) => d.outcome === "won");
  const lost = filtered.filter((d) => d.outcome === "lost");
  const wonW = won.reduce((a, d) => a + w(d), 0);
  const lostW = lost.reduce((a, d) => a + w(d), 0);
  const rate = wonW + lostW ? wonW / (wonW + lostW) : 0;
  const avg = (xs: ClosedDeal[], f: (d: ClosedDeal) => number | undefined) => {
    const v = xs.map(f).filter((n): n is number => n !== undefined);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };
  const money = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);

  const trend = React.useMemo(() => {
    const m = new Map<string, { won: number; lost: number }>();
    for (const d of scoped) {
      const k = bucketOf(d.closedAt, bucket);
      const e = m.get(k) ?? { won: 0, lost: 0 };
      e[d.outcome] += weight === "amount" ? d.amount : 1;
      m.set(k, e);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [scoped, bucket, weight]);

  const reasons = (xs: ClosedDeal[]) => {
    const m = new Map<string, number>();
    xs.forEach((d) => m.set(d.reason, (m.get(d.reason) ?? 0) + w(d)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const competitors = React.useMemo(() => {
    const m = new Map<string, { won: number; lost: number }>();
    for (const d of filtered) {
      const k = d.competitor ?? "No competitor";
      const e = m.get(k) ?? { won: 0, lost: 0 };
      e[d.outcome] += 1;
      m.set(k, e);
    }
    return [...m.entries()].sort((a, b) => b[1].won + b[1].lost - (a[1].won + a[1].lost));
  }, [filtered]);

  const toggle = (kind: "reason" | "competitor" | "period", value: string) =>
    setFilter((f) => (f && f.kind === kind && f.value === value ? null : { kind, value }));

  const renderReasons = (title: string, items: [string, number][], tone: string) => {
    const top = Math.max(1, ...items.map((i) => i[1]));
    const total = items.reduce((a, i) => a + i[1], 0);
    return (
      <div className="rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
        <h3 className="mb-3 text-sm font-medium">{title}</h3>
        {items.length === 0 ? (
          <p className="text-xs text-crm-subtle">No deals match.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map(([reason, v]) => (
              <li key={reason}>
                <button
                  type="button"
                  aria-pressed={filter?.kind === "reason" && filter.value === reason}
                  onClick={() => toggle("reason", reason)}
                  className="grid w-full grid-cols-[1fr_auto] gap-x-2 rounded-sm px-1 py-1 text-left text-xs hover:bg-crm-muted/50 aria-[pressed=true]:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                >
                  <span className="truncate">{reason}</span>
                  <span className="text-crm-soft tabular-nums">
                    {weight === "amount" ? money(v) : v} · {Math.round((v / total) * 100)}%
                  </span>
                  <span className="col-span-2 mt-1 h-1.5 rounded-full bg-crm-muted">
                    <span
                      className={cn("block h-full rounded-full", tone)}
                      style={{ width: `${(v / top) * 100}%` }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <section
      aria-label="Win/loss report"
      className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Win / loss</p>
          <h2 className="text-lg font-semibold tracking-tight">{filtered.length} closed deals</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <SegmentedControl
            label="Segment"
            size="sm"
            value={segment}
            onValueChange={setSegment}
            options={segments.map((s) => ({ value: s, label: s }))}
          />
          <SegmentedControl
            label="Weight by"
            size="sm"
            value={weight}
            onValueChange={(v) => setWeight(v as "count" | "amount")}
            options={[
              { value: "count", label: "Deals" },
              { value: "amount", label: "Value" },
            ]}
          />
        </div>
      </header>

      {filter ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-crm-subtle">Filtered by {filter.kind}:</span>
          <button
            type="button"
            onClick={() => setFilter(null)}
            className="inline-flex h-6 items-center gap-1 rounded-full border border-tag-blue-border bg-tag-blue-bg px-2 text-tag-blue-text focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
          >
            {filter.value} <X className="size-3" aria-label="Clear filter" />
          </button>
        </div>
      ) : null}

      <KpiGrid
        items={[
          {
            label: "Win rate",
            value: `${(rate * 100).toFixed(1)}%`,
            caption: weight === "amount" ? "by value" : "by count",
          },
          {
            label: "Won",
            value: money(won.reduce((a, d) => a + d.amount, 0)),
            caption: `${won.length} deals`,
          },
          {
            label: "Lost",
            value: money(lost.reduce((a, d) => a + d.amount, 0)),
            caption: `${lost.length} deals`,
          },
          {
            label: "Cycle (won / lost)",
            value: `${Math.round(avg(won, (d) => d.cycleDays))}d / ${Math.round(avg(lost, (d) => d.cycleDays))}d`,
          },
        ]}
      />

      <div className="rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
        <h3 className="mb-3 text-sm font-medium">Win rate by {bucket}</h3>
        {trend.length === 0 ? (
          <p className="text-xs text-crm-subtle">No closed deals in scope.</p>
        ) : (
          <div className="flex h-36 items-end gap-2">
            {trend.map(([k, v]) => {
              const r = v.won + v.lost ? v.won / (v.won + v.lost) : 0;
              const active = filter?.kind === "period" && filter.value === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${k}: ${Math.round(r * 100)}% win rate`}
                  onClick={() => toggle("period", k)}
                  className="group flex h-full flex-1 flex-col items-center justify-end gap-1 rounded-sm focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                >
                  <span className="text-[11px] text-crm-soft tabular-nums">
                    {Math.round(r * 100)}%
                  </span>
                  <span className="flex w-full max-w-12 flex-1 flex-col-reverse overflow-hidden rounded-sm bg-crm-muted">
                    <span
                      className={cn(
                        "w-full bg-crm-success",
                        active ? "opacity-100" : "opacity-80 group-hover:opacity-100",
                      )}
                      style={{ height: `${r * 100}%` }}
                    />
                  </span>
                  <span
                    className={cn(
                      "text-[11px] whitespace-nowrap",
                      active ? "font-medium text-crm-fg" : "text-crm-subtle",
                    )}
                  >
                    {k}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {renderReasons("Why we win", reasons(won), "bg-crm-success")}
        {renderReasons("Why we lose", reasons(lost), "bg-crm-danger")}
      </div>

      <div className="overflow-x-auto rounded-crm border border-crm-border bg-crm-card shadow-crm-raised">
        <table className="w-full min-w-[480px] text-sm">
          <caption className="px-4 pt-3 text-left text-sm font-medium">
            Competitor head-to-head
          </caption>
          <thead>
            <tr className="border-b border-crm-border">
              {["Competitor", "Won", "Lost", "Win rate"].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    "crm-caption h-9 px-4 font-normal text-crm-subtle",
                    i ? "text-right" : "text-left",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {competitors.map(([name, v]) => {
              const r = v.won / (v.won + v.lost);
              return (
                <tr key={name} className="border-b border-crm-border last:border-0">
                  <td className="h-10 px-4">
                    <button
                      type="button"
                      onClick={() => toggle("competitor", name)}
                      className="rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                    >
                      {name}
                    </button>
                  </td>
                  <td className="px-4 text-right tabular-nums">{v.won}</td>
                  <td className="px-4 text-right tabular-nums">{v.lost}</td>
                  <td
                    className={cn(
                      "px-4 text-right font-medium tabular-nums",
                      r < 0.4 ? "text-crm-danger" : r >= 0.6 ? "text-crm-success" : "",
                    )}
                  >
                    {Math.round(r * 100)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filter ? (
        <ul
          className="rounded-crm border border-crm-border bg-crm-card shadow-crm-raised"
          aria-label="Matching deals"
        >
          {filtered.slice(0, 12).map((d) => (
            <li key={d.id} className="border-b border-crm-border last:border-0">
              <button
                type="button"
                onClick={() => onDealSelect?.(d.id)}
                className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-crm-muted/40 focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
              >
                <span className="truncate">{d.name}</span>
                <span className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "rounded-full border px-1.5",
                      d.outcome === "won"
                        ? "border-tag-green-border bg-tag-green-bg text-tag-green-text"
                        : "border-tag-red-border bg-tag-red-bg text-tag-red-text",
                    )}
                  >
                    {d.outcome}
                  </span>
                  <span className="tabular-nums">{money(d.amount)}</span>
                </span>
              </button>
            </li>
          ))}
          {filtered.length > 12 ? (
            <li className="px-4 py-2 text-xs text-crm-subtle">+{filtered.length - 12} more</li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
