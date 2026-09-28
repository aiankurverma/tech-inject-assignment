import * as React from "react";
import { AlertTriangle, Clock, Inbox, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag } from "@/components/crm/tag";

export type TicketPriority = "urgent" | "high" | "normal" | "low";

export interface SupportTicket {
  id: string;
  subject: string;
  customer: string;
  priority: TicketPriority;
  status: "open" | "pending" | "solved";
  assignee?: string;
  createdAt: string;
  firstResponseAt?: string;
  solvedAt?: string;
  /** 1–5 satisfaction score after solve. */
  csat?: number;
}

export interface SupportDashboardProps {
  tickets: SupportTicket[];
  /** First-response SLA in minutes per priority. */
  sla?: Record<TicketPriority, number>;
  /** Fixed "now" for demos/tests; otherwise ticks every 30s. */
  now?: Date;
  onTicketClick?: (id: string) => void;
  className?: string;
}

const defaultSla: Record<TicketPriority, number> = {
  urgent: 30,
  high: 120,
  normal: 480,
  low: 1440,
};
const prioColor = { urgent: "red", high: "orange", normal: "blue", low: "neutral" } as const;

function dur(min: number) {
  const m = Math.abs(Math.round(min));
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
}

/** Support ops dashboard: live SLA countdowns, breach tracking, response times and CSAT. */
export function SupportDashboard({
  tickets,
  sla = defaultSla,
  now: fixedNow,
  onTicketClick,
  className,
}: SupportDashboardProps) {
  const [tick, setTick] = React.useState(() => Date.now());
  const [view, setView] = React.useState("at-risk");
  React.useEffect(() => {
    if (fixedNow) return;
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [fixedNow]);
  const now = fixedNow?.getTime() ?? tick;
  const mins = (a: string, b?: string | number) =>
    ((b === undefined ? now : typeof b === "number" ? b : new Date(b).getTime()) -
      new Date(a).getTime()) /
    60_000;

  const enriched = tickets.map((t) => {
    const target = sla[t.priority];
    const responded = t.firstResponseAt !== undefined;
    const elapsed = mins(t.createdAt, t.firstResponseAt);
    const remaining = target - elapsed;
    return { ...t, target, responded, elapsed, remaining, breached: remaining < 0 };
  });

  const open = enriched.filter((t) => t.status !== "solved");
  const awaiting = open.filter((t) => !t.responded);
  const breachedNow = awaiting.filter((t) => t.breached);
  const respondedAll = enriched.filter((t) => t.responded);
  const slaMet = respondedAll.length
    ? (respondedAll.filter((t) => !t.breached).length / respondedAll.length) * 100
    : 100;
  const medianFrt = (() => {
    const v = respondedAll.map((t) => t.elapsed).sort((a, b) => a - b);
    if (!v.length) return 0;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
  })();
  const rated = enriched.filter((t) => t.csat !== undefined);
  const csat = rated.length
    ? (rated.filter((t) => (t.csat ?? 0) >= 4).length / rated.length) * 100
    : 0;
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: rated.filter((t) => t.csat === s).length }));

  const queue = (view === "at-risk" ? awaiting : view === "breached" ? breachedNow : open)
    .slice()
    .sort((a, b) =>
      a.responded === b.responded ? a.remaining - b.remaining : a.responded ? 1 : -1,
    );

  return (
    <section
      aria-label="Support dashboard"
      className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}
    >
      <h2 className="text-base font-semibold">Support operations</h2>
      <KpiGrid
        items={[
          {
            label: "Open tickets",
            value: open.length,
            caption: `${awaiting.length} awaiting reply`,
            icon: <Inbox />,
          },
          {
            label: "SLA breaches",
            value: breachedNow.length,
            caption: `${slaMet.toFixed(0)}% first-reply SLA met`,
            icon: <AlertTriangle />,
          },
          { label: "Median first reply", value: dur(medianFrt), icon: <Clock /> },
          {
            label: "CSAT",
            value: rated.length ? `${csat.toFixed(0)}%` : "—",
            caption: `${rated.length} ratings`,
            icon: <Smile />,
          },
        ]}
      />
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="flex flex-col rounded-crm border border-crm-border bg-crm-card shadow-crm-raised lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-crm-border p-3">
            <h3 className="text-sm font-medium">SLA queue</h3>
            <SegmentedControl
              size="sm"
              label="Queue view"
              value={view}
              onValueChange={setView}
              options={[
                { value: "at-risk", label: "Awaiting", count: awaiting.length },
                { value: "breached", label: "Breached", count: breachedNow.length },
                { value: "all", label: "All open", count: open.length },
              ]}
            />
          </div>
          {queue.length === 0 ? (
            <p className="p-8 text-center text-sm text-crm-soft">Queue is clear. Nice work.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {queue.map((t) => {
                const pctUsed = Math.min(100, (t.elapsed / t.target) * 100);
                const tone = t.breached
                  ? "bg-crm-danger"
                  : pctUsed > 75
                    ? "bg-crm-warning"
                    : "bg-crm-success";
                return (
                  <li key={t.id} className="border-b border-crm-border/60 last:border-0">
                    <button
                      type="button"
                      onClick={() => onTicketClick?.(t.id)}
                      className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left hover:bg-crm-muted/40 focus-visible:bg-crm-muted/60 focus-visible:outline-none"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-[13px]">
                        <Tag size="sm" color={prioColor[t.priority]}>
                          {t.priority}
                        </Tag>
                        <span className="truncate font-medium">{t.subject}</span>
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium tabular-nums",
                          t.responded
                            ? "text-crm-soft"
                            : t.breached
                              ? "text-crm-danger"
                              : "text-crm-fg",
                        )}
                      >
                        {t.responded
                          ? `replied in ${dur(t.elapsed)}`
                          : t.breached
                            ? `breached ${dur(t.remaining)} ago`
                            : `${dur(t.remaining)} left`}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-crm-soft">
                        #{t.id} · {t.customer} · {t.assignee ?? "Unassigned"}
                      </span>
                      <span
                        className="h-1 w-20 overflow-hidden rounded-full bg-crm-muted"
                        role="meter"
                        aria-label="SLA used"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(pctUsed)}
                      >
                        <span
                          className={cn("block h-full", tone)}
                          style={{ width: `${pctUsed}%` }}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <h3 className="text-sm font-medium">Satisfaction</h3>
          <ul className="flex flex-col gap-1.5">
            {dist.map(({ s, n }) => (
              <li key={s} className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-2 text-xs">
                <span className="text-crm-soft">{s} ★</span>
                <span className="h-2 overflow-hidden rounded-full bg-crm-muted">
                  <span
                    className={cn(
                      "block h-full",
                      s >= 4 ? "bg-crm-success" : s === 3 ? "bg-crm-warning" : "bg-crm-danger",
                    )}
                    style={{ width: `${rated.length ? (n / rated.length) * 100 : 0}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
          <h3 className="pt-2 text-sm font-medium">SLA targets</h3>
          <dl className="grid grid-cols-2 gap-1 text-xs">
            {(Object.keys(sla) as TicketPriority[]).map((p) => (
              <div key={p} className="flex justify-between rounded-md bg-crm-muted/50 px-2 py-1">
                <dt className="capitalize text-crm-soft">{p}</dt>
                <dd className="tabular-nums">{dur(sla[p])}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
