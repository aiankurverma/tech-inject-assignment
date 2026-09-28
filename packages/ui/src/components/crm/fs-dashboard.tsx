import * as React from "react";
import { AlarmClock, CheckCircle2, Repeat, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { SegmentedControl } from "@/components/crm/segmented-control";

export interface ServiceVisit {
  id: string;
  region: string;
  technician: string;
  jobType: string;
  /** ISO timestamps. */
  createdAt: string;
  arrivedAt?: string;
  completedAt?: string;
  /** SLA response target in hours. */
  slaHours: number;
  /** True when the job needed a return visit. */
  returnVisit?: boolean;
  /** Invoice amount, 0 if warranty. */
  revenue: number;
}

export interface FsDashboardProps {
  visits: ServiceVisit[];
  now?: Date;
  currency?: string;
  locale?: string;
  className?: string;
}

const HOUR = 3_600_000;

function stats(v: ServiceVisit[], nowMs: number) {
  const done = v.filter((x) => x.completedAt);
  const arrived = v.filter((x) => x.arrivedAt);
  const response = arrived.length
    ? arrived.reduce(
        (s, x) => s + (new Date(x.arrivedAt ?? "").getTime() - new Date(x.createdAt).getTime()),
        0,
      ) /
      arrived.length /
      HOUR
    : 0;
  const breached = v.filter((x) => {
    const due = new Date(x.createdAt).getTime() + x.slaHours * HOUR;
    const hit = x.arrivedAt ? new Date(x.arrivedAt).getTime() : nowMs;
    return hit > due;
  }).length;
  const ftf = done.length ? (done.filter((x) => !x.returnVisit).length / done.length) * 100 : 0;
  return {
    total: v.length,
    done: done.length,
    response,
    breachRate: v.length ? (breached / v.length) * 100 : 0,
    ftf,
    revenue: done.reduce((s, x) => s + x.revenue, 0),
  };
}

/** Field-service operations dashboard: SLA, response, first-time-fix, backlog by type and tech leaderboard. */
export function FsDashboard({
  visits,
  now,
  currency = "USD",
  locale = "en-US",
  className,
}: FsDashboardProps) {
  const nowMs = (now ?? new Date()).getTime();
  const regions = React.useMemo(() => [...new Set(visits.map((v) => v.region))].sort(), [visits]);
  const [region, setRegion] = React.useState("all");
  const scoped = region === "all" ? visits : visits.filter((v) => v.region === region);
  const s = stats(scoped, nowMs);
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
  });

  const byType = React.useMemo(() => {
    const m = new Map<string, { open: number; done: number }>();
    for (const v of scoped) {
      const e = m.get(v.jobType) ?? { open: 0, done: 0 };
      if (v.completedAt) e.done += 1;
      else e.open += 1;
      m.set(v.jobType, e);
    }
    return [...m.entries()].sort((a, b) => b[1].open + b[1].done - (a[1].open + a[1].done));
  }, [scoped]);
  const maxType = Math.max(1, ...byType.map(([, e]) => e.open + e.done));

  const leaderboard = React.useMemo(() => {
    const m = new Map<string, ServiceVisit[]>();
    for (const v of scoped) m.set(v.technician, [...(m.get(v.technician) ?? []), v]);
    return [...m.entries()]
      .map(([name, list]) => ({ name, ...stats(list, nowMs) }))
      .sort((a, b) => b.done - a.done || b.ftf - a.ftf);
  }, [scoped, nowMs]);

  const backlogAging = React.useMemo(() => {
    const buckets = [
      { label: "< 4h", max: 4, n: 0 },
      { label: "4–24h", max: 24, n: 0 },
      { label: "1–3d", max: 72, n: 0 },
      { label: "> 3d", max: Infinity, n: 0 },
    ];
    for (const v of scoped) {
      if (v.completedAt) continue;
      const age = (nowMs - new Date(v.createdAt).getTime()) / HOUR;
      const b = buckets.find((x) => age < x.max);
      if (b) b.n += 1;
    }
    return buckets;
  }, [scoped, nowMs]);

  return (
    <section
      aria-label="Field service dashboard"
      className={cn("flex flex-col gap-3 font-crm", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="crm-eyebrow">Field operations</span>
          <span className="text-xs text-crm-subtle">
            {s.total} visits · {s.total - s.done} open · {money.format(s.revenue)} billed
          </span>
        </div>
        <div className="max-w-full overflow-x-auto">
          <SegmentedControl
            size="sm"
            label="Region"
            value={region}
            onValueChange={setRegion}
            options={[
              { value: "all", label: "All regions", count: visits.length },
              ...regions.map((r) => ({
                value: r,
                label: r,
                count: visits.filter((v) => v.region === r).length,
              })),
            ]}
          />
        </div>
      </header>

      <KpiGrid
        items={[
          {
            label: "Completed",
            value: `${s.done}/${s.total}`,
            caption: `${s.total ? Math.round((s.done / s.total) * 100) : 0}% closed`,
            icon: <CheckCircle2 />,
          },
          {
            label: "Avg response",
            value: `${s.response.toFixed(1)}h`,
            caption: "logged → on site",
            icon: <Timer />,
          },
          {
            label: "SLA breach rate",
            value: `${s.breachRate.toFixed(0)}%`,
            caption: s.breachRate > 10 ? "above 10% target" : "within target",
            icon: <AlarmClock />,
          },
          {
            label: "First-time fix",
            value: `${s.ftf.toFixed(0)}%`,
            caption: "no return visit",
            icon: <Repeat />,
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <span className="crm-caption text-crm-soft">Jobs by type</span>
          {byType.length === 0 ? (
            <p className="text-xs text-crm-subtle">No visits in this region.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-xs">
              {byType.map(([type, e]) => (
                <li key={type} className="flex flex-col gap-1">
                  <span className="flex justify-between">
                    <span className="text-crm-fg">{type}</span>
                    <span className="text-crm-subtle tabular-nums">
                      {e.open} open · {e.done} done
                    </span>
                  </span>
                  <span
                    className="flex h-1.5 overflow-hidden rounded-full bg-crm-muted"
                    role="img"
                    aria-label={`${type}: ${e.done} done, ${e.open} open`}
                  >
                    <span
                      className="bg-crm-success"
                      style={{ width: `${(e.done / maxType) * 100}%` }}
                    />
                    <span
                      className="bg-crm-warning"
                      style={{ width: `${(e.open / maxType) * 100}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <span className="crm-caption text-crm-soft">Open backlog age</span>
          <div className="flex h-28 items-end gap-2" role="list">
            {backlogAging.map((b, i) => {
              const max = Math.max(1, ...backlogAging.map((x) => x.n));
              return (
                <div
                  key={b.label}
                  role="listitem"
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <span className="text-xs text-crm-fg tabular-nums">{b.n}</span>
                  <span
                    className={cn(
                      "w-full rounded-t-sm",
                      i >= 2 ? "bg-crm-danger/70" : "bg-crm-primary/70",
                    )}
                    style={{ height: `${Math.max(4, (b.n / max) * 72)}px` }}
                    aria-hidden
                  />
                  <span className="text-[11px] text-crm-subtle">{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <span className="crm-caption text-crm-soft">Technician leaderboard</span>
          <ol className="flex flex-col gap-1.5 text-xs">
            {leaderboard.slice(0, 6).map((t, i) => (
              <li key={t.name} className="flex items-center gap-2">
                <span className="w-4 text-crm-subtle tabular-nums">{i + 1}</span>
                <Avatar name={t.name} size="sm" />
                <span className="flex-1 truncate text-crm-fg">{t.name}</span>
                <span className="text-crm-soft tabular-nums">{t.done} jobs</span>
                <span
                  className={cn(
                    "w-10 text-right tabular-nums",
                    t.ftf < 75 ? "text-crm-danger" : "text-crm-success",
                  )}
                >
                  {t.ftf.toFixed(0)}%
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
