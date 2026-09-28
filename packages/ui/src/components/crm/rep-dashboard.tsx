import * as React from "react";
import { AlertCircle, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/crm/progress";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag } from "@/components/crm/tag";

export interface RepDeal {
  id: string;
  name: string;
  account: string;
  amount: number;
  stage: string;
  /** 0–100 win probability. */
  probability: number;
  closeDate: string;
  status: "open" | "won" | "lost";
  /** ISO date of last activity; used to flag stale deals. */
  lastActivity: string;
}

export interface RepTask {
  id: string;
  title: string;
  due: string;
  done?: boolean;
  dealId?: string;
}

export interface RepDashboardProps {
  repName: string;
  quota: number;
  deals: RepDeal[];
  tasks: RepTask[];
  onTaskToggle?: (id: string, done: boolean) => void;
  /** Days without activity before an open deal is flagged stale. */
  staleAfterDays?: number;
  currency?: string;
  now?: Date;
  className?: string;
}

const day = 86_400_000;

/** A rep's home: quota ring with forecast, gap to plan, prioritized deals and today's tasks. */
export function RepDashboard({
  repName,
  quota,
  deals,
  tasks,
  onTaskToggle,
  staleAfterDays = 14,
  currency = "USD",
  now = new Date(),
  className,
}: RepDashboardProps) {
  const [dealView, setDealView] = React.useState("closing");
  const [localDone, setLocalDone] = React.useState<Record<string, boolean>>({});
  const money = React.useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [currency],
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const won = deals.filter((d) => d.status === "won").reduce((s, d) => s + d.amount, 0);
  const open = deals.filter((d) => d.status === "open");
  const weighted = open.reduce((s, d) => s + (d.amount * d.probability) / 100, 0);
  const gap = Math.max(0, quota - won);
  const coverage = gap ? open.reduce((s, d) => s + d.amount, 0) / gap : Infinity;
  const attainment = quota ? (won / quota) * 100 : 0;
  const forecastPct = quota ? ((won + weighted) / quota) * 100 : 0;

  const isStale = (d: RepDeal) =>
    (now.getTime() - new Date(d.lastActivity).getTime()) / day > staleAfterDays;
  const isPastClose = (d: RepDeal) => new Date(d.closeDate).getTime() < today;
  const shown = open
    .filter((d) =>
      dealView === "closing"
        ? new Date(d.closeDate).getTime() - today <= 30 * day
        : dealView === "risk"
          ? isStale(d) || isPastClose(d)
          : true,
    )
    .sort((a, b) => a.closeDate.localeCompare(b.closeDate) || b.amount - a.amount);
  const riskCount = open.filter((d) => isStale(d) || isPastClose(d)).length;

  const doneOf = (t: RepTask) => localDone[t.id] ?? !!t.done;
  const sortedTasks = tasks
    .slice()
    .sort((a, b) => Number(doneOf(a)) - Number(doneOf(b)) || a.due.localeCompare(b.due));
  const overdue = tasks.filter((t) => !doneOf(t) && new Date(t.due).getTime() < today).length;
  const dueLabel = (iso: string) => {
    const diff = Math.round((new Date(iso).getTime() - today) / day);
    if (diff < 0) return { text: `${-diff}d overdue`, tone: "text-crm-danger" };
    if (diff === 0) return { text: "Today", tone: "text-crm-warning" };
    if (diff === 1) return { text: "Tomorrow", tone: "text-crm-soft" };
    return {
      text: new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      tone: "text-crm-soft",
    };
  };

  return (
    <section
      aria-label={`${repName} dashboard`}
      className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}
    >
      <div className="grid gap-3 md:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-4 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <ProgressRing
            value={Math.min(attainment, 100)}
            size={88}
            stroke={8}
            tone={attainment >= 100 ? "success" : "primary"}
            label={`Quota attainment ${attainment.toFixed(0)}%`}
          />
          <dl className="flex flex-col gap-1 text-xs tabular-nums">
            <div>
              <dt className="crm-eyebrow">Closed</dt>
              <dd className="text-lg font-semibold">
                {money.format(won)}{" "}
                <span className="text-xs font-normal text-crm-soft">of {money.format(quota)}</span>
              </dd>
            </div>
            <div className="flex gap-4">
              <div>
                <dt className="text-crm-soft">Forecast</dt>
                <dd className="font-medium">{forecastPct.toFixed(0)}%</dd>
              </div>
              <div>
                <dt className="text-crm-soft">Gap</dt>
                <dd className="font-medium">{money.format(gap)}</dd>
              </div>
              <div>
                <dt className="text-crm-soft">Coverage</dt>
                <dd className={cn("font-medium", coverage < 3 && "text-crm-warning")}>
                  {Number.isFinite(coverage) ? `${coverage.toFixed(1)}×` : "Met"}
                </dd>
              </div>
            </div>
          </dl>
        </div>
        <div className="flex flex-col justify-center gap-1 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
          <p className="crm-eyebrow">Focus today</p>
          <p className="text-sm">
            {overdue ? (
              <span className="text-crm-danger">
                {overdue} overdue task{overdue > 1 ? "s" : ""}.{" "}
              </span>
            ) : null}
            {riskCount ? `${riskCount} deal${riskCount > 1 ? "s" : ""} at risk. ` : ""}
            {gap
              ? `Close ${money.format(gap)} more to hit plan; weighted pipeline covers ${money.format(weighted)}.`
              : "Quota achieved — everything else is upside."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="flex flex-col rounded-crm border border-crm-border bg-crm-card shadow-crm-raised lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-crm-border p-3">
            <h3 className="text-sm font-medium">My deals</h3>
            <SegmentedControl
              size="sm"
              label="Deal view"
              value={dealView}
              onValueChange={setDealView}
              options={[
                { value: "closing", label: "Next 30 days" },
                { value: "risk", label: "At risk", count: riskCount },
                { value: "all", label: "All", count: open.length },
              ]}
            />
          </div>
          {shown.length === 0 ? (
            <p className="p-8 text-center text-sm text-crm-soft">No deals in this view.</p>
          ) : (
            <ul>
              {shown.map((d) => (
                <li
                  key={d.id}
                  className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-b border-crm-border/60 px-3 py-2.5 last:border-0"
                >
                  <span className="truncate text-[13px] font-medium">{d.name}</span>
                  <span className="text-right text-[13px] font-medium tabular-nums">
                    {money.format(d.amount)}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-crm-soft">
                    {d.account} · {d.stage}
                    {isPastClose(d) ? (
                      <Tag size="sm" color="red">
                        past close date
                      </Tag>
                    ) : null}
                    {isStale(d) ? (
                      <Tag size="sm" color="amber">
                        no activity{" "}
                        {Math.floor((now.getTime() - new Date(d.lastActivity).getTime()) / day)}d
                      </Tag>
                    ) : null}
                  </span>
                  <span className="text-right text-xs text-crm-soft tabular-nums">
                    {d.probability}% ·{" "}
                    {new Date(d.closeDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col rounded-crm border border-crm-border bg-crm-card shadow-crm-raised lg:col-span-2">
          <div className="flex items-center justify-between border-b border-crm-border p-3">
            <h3 className="text-sm font-medium">Tasks</h3>
            <span className="text-xs text-crm-soft tabular-nums">
              {tasks.filter(doneOf).length}/{tasks.length} done
            </span>
          </div>
          {tasks.length === 0 ? (
            <p className="p-8 text-center text-sm text-crm-soft">No tasks. Plan your next touch.</p>
          ) : (
            <ul>
              {sortedTasks.map((t) => {
                const done = doneOf(t);
                const due = dueLabel(t.due);
                return (
                  <li key={t.id} className="border-b border-crm-border/60 last:border-0">
                    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-crm-muted/40">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={(e) => {
                          setLocalDone((s) => ({ ...s, [t.id]: e.target.checked }));
                          onTaskToggle?.(t.id, e.target.checked);
                        }}
                        className="size-3.5 accent-crm-primary"
                      />
                      <span
                        className={cn(
                          "flex-1 truncate text-[13px]",
                          done && "text-crm-subtle line-through",
                        )}
                      >
                        {t.title}
                      </span>
                      {!done ? (
                        <span className={cn("flex items-center gap-1 text-[11px]", due.tone)}>
                          {due.tone === "text-crm-danger" ? (
                            <AlertCircle className="size-3" aria-hidden />
                          ) : (
                            <CalendarClock className="size-3" aria-hidden />
                          )}
                          {due.text}
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
