import * as React from "react";
import { HandCoins, HeartHandshake, Repeat, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { SegmentedControl } from "@/components/crm/segmented-control";

export interface Gift {
  donorId: string;
  /** ISO date. */
  date: string;
  amount: number;
  fund: string;
  recurring?: boolean;
}

export interface NpDashboardProps {
  gifts: Gift[];
  /** Month (1–12) the fiscal year starts, e.g. 7 for July. */
  fiscalStartMonth?: number;
  /** Annual fundraising goal for the selected fiscal year. */
  goal?: number;
  now?: Date;
  currency?: string;
  locale?: string;
  className?: string;
}

/** Fiscal year label a date falls into (named by the year it ends). */
export function fiscalYear(date: Date, startMonth: number) {
  return date.getMonth() + 1 >= startMonth && startMonth !== 1
    ? date.getFullYear() + 1
    : date.getFullYear();
}

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round(((a - b) / b) * 1000) / 10);

/** Nonprofit development dashboard: fiscal-year giving, donor retention, recurring revenue and fund mix. */
export function NpDashboard({
  gifts,
  fiscalStartMonth = 7,
  goal,
  now,
  currency = "USD",
  locale = "en-US",
  className,
}: NpDashboardProps) {
  const ref = now ?? new Date();
  const refMs = ref.getTime();
  const currentFy = fiscalYear(ref, fiscalStartMonth);
  const years = React.useMemo(() => {
    const ys = new Set(gifts.map((g) => fiscalYear(new Date(g.date), fiscalStartMonth)));
    ys.add(currentFy);
    return [...ys].sort((a, b) => b - a).slice(0, 3);
  }, [gifts, fiscalStartMonth, currentFy]);
  const [fy, setFy] = React.useState(currentFy);

  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const compact = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
  });

  const data = React.useMemo(() => {
    const inFy = (y: number) =>
      gifts.filter((g) => fiscalYear(new Date(g.date), fiscalStartMonth) === y);
    const cur = inFy(fy);
    // Compare like-for-like: previous year up to the same point in its fiscal year.
    const isCurrent = fy === currentFy;
    const cutoff = new Date(refMs);
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const prev = inFy(fy - 1).filter((g) => !isCurrent || new Date(g.date) <= cutoff);
    const prevFull = inFy(fy - 1);
    const sum = (l: Gift[]) => l.reduce((s, g) => s + g.amount, 0);
    const donorsCur = new Set(cur.map((g) => g.donorId));
    const donorsPrevFull = new Set(prevFull.map((g) => g.donorId));
    const retained = [...donorsPrevFull].filter((d) => donorsCur.has(d)).length;
    const firstSeen = new Map<string, string>();
    for (const g of gifts) {
      const f = firstSeen.get(g.donorId);
      if (!f || g.date < f) firstSeen.set(g.donorId, g.date);
    }
    const newDonors = [...donorsCur].filter(
      (d) => fiscalYear(new Date(firstSeen.get(d) ?? ""), fiscalStartMonth) === fy,
    ).length;
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = ((fiscalStartMonth - 1 + i) % 12) + 1;
      return {
        label: new Date(2000, m - 1, 1).toLocaleString(locale, { month: "short" }),
        cur: sum(cur.filter((g) => new Date(g.date).getMonth() + 1 === m)),
        prev: sum(prevFull.filter((g) => new Date(g.date).getMonth() + 1 === m)),
      };
    });
    const funds = new Map<string, number>();
    for (const g of cur) funds.set(g.fund, (funds.get(g.fund) ?? 0) + g.amount);
    const recurringMonthly = (() => {
      const lastMonth = new Map<string, Gift>();
      for (const g of cur.filter((x) => x.recurring)) {
        const e = lastMonth.get(g.donorId);
        if (!e || g.date > e.date) lastMonth.set(g.donorId, g);
      }
      return [...lastMonth.values()].reduce((s, g) => s + g.amount, 0);
    })();
    return {
      raised: sum(cur),
      prevRaised: sum(prev),
      gifts: cur.length,
      avg: cur.length ? sum(cur) / cur.length : 0,
      prevAvg: prev.length ? sum(prev) / prev.length : 0,
      donors: donorsCur.size,
      prevDonors: new Set(prev.map((g) => g.donorId)).size,
      retention: donorsPrevFull.size ? (retained / donorsPrevFull.size) * 100 : 0,
      newDonors,
      recurringMonthly,
      recurringDonors: new Set(cur.filter((g) => g.recurring).map((g) => g.donorId)).size,
      months,
      funds: [...funds.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [gifts, fy, fiscalStartMonth, currentFy, locale, refMs]);

  const maxMonth = Math.max(1, ...data.months.flatMap((m) => [m.cur, m.prev]));
  const fundTotal = data.funds.reduce((s, [, v]) => s + v, 0) || 1;

  return (
    <section
      aria-label="Development dashboard"
      className={cn("flex flex-col gap-3 font-crm", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="crm-eyebrow">Development · FY{String(fy).slice(-2)}</span>
          <span className="text-xs text-crm-subtle">
            Fiscal year starts{" "}
            {new Date(2000, fiscalStartMonth - 1, 1).toLocaleString(locale, { month: "long" })}
            {fy === currentFy ? " · compared with the same point last year" : ""}
          </span>
        </div>
        <SegmentedControl
          size="sm"
          label="Fiscal year"
          value={String(fy)}
          onValueChange={(v) => setFy(Number(v))}
          options={years.map((y) => ({ value: String(y), label: `FY${String(y).slice(-2)}` }))}
        />
      </header>

      <KpiGrid
        items={[
          {
            label: "Raised",
            value: compact.format(data.raised),
            delta: pct(data.raised, data.prevRaised),
            caption: goal
              ? `${Math.round((data.raised / goal) * 100)}% of ${compact.format(goal)} goal`
              : "vs last FY",
            icon: <HandCoins />,
            trend: data.months.map((m) => m.cur),
          },
          {
            label: "Donors",
            value: data.donors.toLocaleString(locale),
            delta: pct(data.donors, data.prevDonors),
            caption: `${data.newDonors} new`,
            icon: <HeartHandshake />,
          },
          {
            label: "Donor retention",
            value: `${data.retention.toFixed(0)}%`,
            caption: "of last FY donors gave again",
            icon: <UserCheck />,
          },
          {
            label: "Recurring / month",
            value: money.format(data.recurringMonthly),
            caption: `${data.recurringDonors} sustainers · avg gift ${money.format(data.avg)}`,
            icon: <Repeat />,
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2 overflow-x-auto rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <div className="flex items-center justify-between">
            <span className="crm-caption text-crm-soft">Monthly giving</span>
            <span className="flex items-center gap-3 text-[11px] text-crm-subtle">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-sm bg-crm-primary" aria-hidden />
                FY{String(fy).slice(-2)}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-sm bg-crm-muted" aria-hidden />
                FY{String(fy - 1).slice(-2)}
              </span>
            </span>
          </div>
          <table className="sr-only">
            <caption>Monthly giving, this vs previous fiscal year</caption>
            <tbody>
              {data.months.map((m) => (
                <tr key={m.label}>
                  <th scope="row">{m.label}</th>
                  <td>{money.format(m.cur)}</td>
                  <td>{money.format(m.prev)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex h-36 min-w-[440px] items-end gap-1.5" aria-hidden>
            {data.months.map((m) => (
              <div
                key={m.label}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${m.label}: ${money.format(m.cur)} (prev ${money.format(m.prev)})`}
              >
                <div className="flex h-28 w-full items-end gap-0.5">
                  <span
                    className="flex-1 rounded-t-sm bg-crm-muted"
                    style={{ height: `${(m.prev / maxMonth) * 100}%` }}
                  />
                  <span
                    className="flex-1 rounded-t-sm bg-crm-primary"
                    style={{ height: `${(m.cur / maxMonth) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-crm-subtle">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <span className="crm-caption text-crm-soft">By fund designation</span>
          {data.funds.length === 0 ? (
            <p className="py-6 text-center text-xs text-crm-subtle">
              No gifts recorded this fiscal year.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-xs">
              {data.funds.map(([fund, v]) => (
                <li key={fund} className="flex flex-col gap-1">
                  <span className="flex justify-between gap-2">
                    <span className="truncate text-crm-fg">{fund}</span>
                    <span className="text-crm-soft tabular-nums">
                      {money.format(v)} · {((v / fundTotal) * 100).toFixed(0)}%
                    </span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-crm-muted">
                    <span
                      className="block h-full bg-crm-success"
                      style={{ width: `${(v / fundTotal) * 100}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
