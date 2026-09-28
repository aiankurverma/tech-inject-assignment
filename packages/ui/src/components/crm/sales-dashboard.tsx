import * as React from "react";
import { Clock, DollarSign, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { Progress } from "@/components/crm/progress";
import { SegmentedControl } from "@/components/crm/segmented-control";

export interface SalesDeal {
  id: string;
  name: string;
  owner: string;
  amount: number;
  stage: string;
  status: "open" | "won" | "lost";
  createdAt: string;
  /** Close date for won/lost deals, expected close for open ones. */
  closeDate: string;
}

export interface SalesRep {
  name: string;
  /** Quota for the selected period, in currency units. */
  quota: number;
}

export interface SalesDashboardProps {
  deals: SalesDeal[];
  reps: SalesRep[];
  /** Ordered open stages with win probability (0-1) for weighted pipeline. */
  stages: { id: string; label: string; probability: number }[];
  currency?: string;
  /** Reference date for periods. */
  now?: Date;
  className?: string;
}

type Period = "month" | "quarter" | "year";

function periodRange(p: Period, now: Date, offset = 0): [Date, Date] {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (p === "month") return [new Date(y, m - offset, 1), new Date(y, m - offset + 1, 1)];
  if (p === "quarter") {
    const q = Math.floor(m / 3) * 3 - offset * 3;
    return [new Date(y, q, 1), new Date(y, q + 3, 1)];
  }
  return [new Date(y - offset, 0, 1), new Date(y - offset + 1, 0, 1)];
}

const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);

/** Sales team dashboard: period KPIs vs prior period, weighted pipeline by stage, quota leaderboard. */
export function SalesDashboard({
  deals,
  reps,
  stages,
  currency = "USD",
  now = new Date(),
  className,
}: SalesDashboardProps) {
  const [period, setPeriod] = React.useState<Period>("quarter");
  const [rep, setRep] = React.useState("all");
  const fmt = React.useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [currency],
  );

  const scoped = rep === "all" ? deals : deals.filter((d) => d.owner === rep);

  const stats = (offset: number) => {
    const [from, to] = periodRange(period, now, offset);
    const inP = (d: SalesDeal) => {
      const t = new Date(d.closeDate);
      return t >= from && t < to;
    };
    const won = scoped.filter((d) => d.status === "won" && inP(d));
    const lost = scoped.filter((d) => d.status === "lost" && inP(d));
    const revenue = won.reduce((s, d) => s + d.amount, 0);
    const cycle = won.length
      ? won.reduce(
          (s, d) => s + (new Date(d.closeDate).getTime() - new Date(d.createdAt).getTime()),
          0,
        ) /
        won.length /
        86_400_000
      : 0;
    return {
      revenue,
      winRate: won.length + lost.length ? (won.length / (won.length + lost.length)) * 100 : 0,
      avg: won.length ? revenue / won.length : 0,
      cycle,
      won,
    };
  };
  const cur = stats(0);
  const prev = stats(1);

  const open = scoped.filter((d) => d.status === "open");
  const byStage = stages.map((s) => {
    const ds = open.filter((d) => d.stage === s.id);
    const total = ds.reduce((a, d) => a + d.amount, 0);
    return { ...s, count: ds.length, total, weighted: total * s.probability };
  });
  const maxStage = Math.max(1, ...byStage.map((s) => s.total));
  const weighted = byStage.reduce((a, s) => a + s.weighted, 0);

  const board = reps
    .map((r) => {
      const closed = cur.won.filter((d) => d.owner === r.name).reduce((a, d) => a + d.amount, 0);
      return { ...r, closed, attainment: r.quota ? (closed / r.quota) * 100 : 0 };
    })
    .filter((r) => rep === "all" || r.name === rep)
    .sort((a, b) => b.attainment - a.attainment);

  return (
    <section
      aria-label="Sales dashboard"
      className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Sales performance</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by rep"
            value={rep}
            onChange={(e) => setRep(e.target.value)}
            className="h-7 rounded-md border border-crm-border bg-crm-card px-2 text-xs text-crm-fg"
          >
            <option value="all">All reps</option>
            {reps.map((r) => (
              <option key={r.name}>{r.name}</option>
            ))}
          </select>
          <SegmentedControl
            size="sm"
            label="Period"
            value={period}
            onValueChange={(v) => setPeriod(v as Period)}
            options={[
              { value: "month", label: "Month" },
              { value: "quarter", label: "Quarter" },
              { value: "year", label: "Year" },
            ]}
          />
        </div>
      </div>

      <KpiGrid
        items={[
          {
            label: "Closed won",
            value: fmt.format(cur.revenue),
            delta: pct(cur.revenue, prev.revenue),
            caption: `vs last ${period}`,
            icon: <DollarSign />,
          },
          {
            label: "Win rate",
            value: `${cur.winRate.toFixed(0)}%`,
            delta: cur.winRate - prev.winRate,
            caption: "pts change",
            icon: <Target />,
          },
          {
            label: "Avg deal size",
            value: fmt.format(cur.avg),
            delta: pct(cur.avg, prev.avg),
            icon: <TrendingUp />,
          },
          {
            label: "Sales cycle",
            value: `${Math.round(cur.cycle)} days`,
            delta: pct(cur.cycle, prev.cycle),
            invert: true,
            icon: <Clock />,
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised lg:col-span-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium">Open pipeline</h3>
            <span className="text-xs text-crm-soft tabular-nums">
              {open.length} deals · weighted {fmt.format(weighted)}
            </span>
          </div>
          {open.length === 0 ? (
            <p className="py-6 text-center text-sm text-crm-soft">No open deals for this filter.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {byStage.map((s) => (
                <li
                  key={s.id}
                  className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-xs"
                >
                  <span className="truncate text-crm-muted-fg">{s.label}</span>
                  <span className="relative h-5 overflow-hidden rounded bg-crm-muted/60">
                    <span
                      className="absolute inset-y-0 left-0 rounded bg-crm-primary/35"
                      style={{ width: `${(s.total / maxStage) * 100}%` }}
                    />
                    <span
                      className="absolute inset-y-0 left-0 rounded bg-crm-primary"
                      style={{ width: `${(s.weighted / maxStage) * 100}%` }}
                    />
                  </span>
                  <span className="w-24 text-right text-crm-fg tabular-nums">
                    {fmt.format(s.total)} <span className="text-crm-subtle">({s.count})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="crm-caption">Solid bar = weighted by stage probability.</p>
        </div>

        <div className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised lg:col-span-2">
          <h3 className="text-sm font-medium">Quota leaderboard</h3>
          <ol className="flex flex-col gap-3">
            {board.map((r, i) => (
              <li key={r.name} className="flex items-center gap-2.5">
                <span className="w-4 text-xs text-crm-subtle tabular-nums">{i + 1}</span>
                <Avatar name={r.name} size="md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="text-crm-soft tabular-nums">
                      {fmt.format(r.closed)} / {fmt.format(r.quota)}
                    </span>
                  </div>
                  <Progress
                    size="sm"
                    value={Math.min(r.attainment, 100)}
                    tone={
                      r.attainment >= 100 ? "success" : r.attainment >= 60 ? "primary" : "warning"
                    }
                    label={`${r.name} quota attainment ${r.attainment.toFixed(0)}%`}
                  />
                </div>
                <span className="w-10 text-right text-xs font-medium tabular-nums">
                  {r.attainment.toFixed(0)}%
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
