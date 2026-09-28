import * as React from "react";
import { Activity, CalendarCheck, Clock, DollarSign, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Card, CardBody, CardHeader } from "@/components/crm/card";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { Progress } from "@/components/crm/progress";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag } from "@/components/crm/tag";

export interface ClinicVisit {
  id: string;
  providerId: string;
  /** ISO scheduled start. */
  start: string;
  durationMin: number;
  status: "completed" | "no-show" | "canceled" | "scheduled" | "checked-in" | "in-room";
  /** Minutes between check-in and rooming, when known. */
  waitMin?: number;
  /** Amount billed in cents. */
  chargesCents?: number;
  /** Amount collected in cents. */
  collectedCents?: number;
}

export interface ClinicDashboardProvider {
  id: string;
  name: string;
  specialty?: string;
  /** Bookable clinic minutes per day. */
  capacityMinPerDay: number;
}

export interface ClinicTask {
  id: string;
  label: string;
  kind: "lab" | "refill" | "callback" | "prior-auth";
  /** ISO due time. */
  due: string;
}

export type ClinicRange = "today" | "7d" | "30d";

export interface ClinicDashboardProps {
  visits: ClinicVisit[];
  providers: ClinicDashboardProvider[];
  tasks?: ClinicTask[];
  now?: Date;
  currency?: string;
  range?: ClinicRange;
  defaultRange?: ClinicRange;
  onRangeChange?: (r: ClinicRange) => void;
  className?: string;
}

const rangeDays: Record<ClinicRange, number> = { today: 1, "7d": 7, "30d": 30 };
const kindTag = {
  lab: { label: "Lab result", color: "purple" },
  refill: { label: "Refill", color: "blue" },
  callback: { label: "Callback", color: "teal" },
  "prior-auth": { label: "Prior auth", color: "amber" },
} as const;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Summarises visits over a window vs. the equal window before it. */
export function clinicMetrics(visits: ClinicVisit[], from: number, to: number) {
  const inWin = visits.filter((v) => {
    const t = new Date(v.start).getTime();
    return t >= from && t < to;
  });
  const done = inWin.filter((v) => v.status === "completed");
  const noShow = inWin.filter((v) => v.status === "no-show").length;
  const kept = done.length + noShow;
  const waits = done.map((v) => v.waitMin).filter((w): w is number => typeof w === "number");
  const charges = done.reduce((s, v) => s + (v.chargesCents ?? 0), 0);
  const collected = done.reduce((s, v) => s + (v.collectedCents ?? 0), 0);
  return {
    visits: inWin,
    completed: done.length,
    noShowRate: kept ? (noShow / kept) * 100 : 0,
    avgWait: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0,
    charges,
    collected,
  };
}

const delta = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : undefined);

/** Clinic operations dashboard: visit, no-show, wait and collection KPIs, provider utilisation, hourly load and due tasks. */
export function ClinicDashboard({
  visits,
  providers,
  tasks = [],
  now: nowProp,
  currency = "USD",
  range: rangeProp,
  defaultRange = "7d",
  onRangeChange,
  className,
}: ClinicDashboardProps) {
  const [inner, setInner] = React.useState<ClinicRange>(defaultRange);
  const range = rangeProp ?? inner;
  const now = nowProp ?? new Date();
  const money = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  const end = startOfDay(now).getTime() + 86_400_000;
  const span = rangeDays[range] * 86_400_000;
  const cur = clinicMetrics(visits, end - span, end);
  const prev = clinicMetrics(visits, end - 2 * span, end - span);

  const utilisation = providers
    .map((p) => {
      const booked = cur.visits
        .filter((v) => v.providerId === p.id && v.status !== "canceled")
        .reduce((s, v) => s + v.durationMin, 0);
      const cap = p.capacityMinPerDay * rangeDays[range];
      return { p, booked, pct: cap ? (booked / cap) * 100 : 0 };
    })
    .sort((a, b) => b.pct - a.pct);

  const hours = Array.from({ length: 11 }, (_, i) => 8 + i);
  const byHour = hours.map(
    (h) =>
      cur.visits.filter((v) => v.status !== "canceled" && new Date(v.start).getHours() === h)
        .length,
  );
  const maxHour = Math.max(1, ...byHour);

  const dueTasks = [...tasks].sort((a, b) => a.due.localeCompare(b.due));

  return (
    <div className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-medium">Clinic operations</h2>
          <p className="text-xs text-crm-muted-fg">
            Compared with the previous {range === "today" ? "day" : range}
          </p>
        </div>
        <SegmentedControl
          label="Date range"
          size="sm"
          value={range}
          onValueChange={(r) => {
            if (rangeProp === undefined) setInner(r as ClinicRange);
            onRangeChange?.(r as ClinicRange);
          }}
          options={[
            { value: "today", label: "Today" },
            { value: "7d", label: "7 days" },
            { value: "30d", label: "30 days" },
          ]}
        />
      </div>

      <KpiGrid
        items={[
          {
            label: "Completed visits",
            value: cur.completed,
            delta: delta(cur.completed, prev.completed),
            icon: <CalendarCheck />,
          },
          {
            label: "No-show rate",
            value: `${cur.noShowRate.toFixed(1)}%`,
            delta: delta(cur.noShowRate, prev.noShowRate),
            invert: true,
            icon: <UserX />,
          },
          {
            label: "Avg. wait to room",
            value: `${Math.round(cur.avgWait)} min`,
            delta: delta(cur.avgWait, prev.avgWait),
            invert: true,
            icon: <Clock />,
          },
          {
            label: "Collected",
            value: money.format(cur.collected / 100),
            delta: delta(cur.collected, prev.collected),
            caption: cur.charges
              ? `${Math.round((cur.collected / cur.charges) * 100)}% of charges`
              : undefined,
            icon: <DollarSign />,
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader title="Provider utilisation" description="Booked minutes vs. capacity" />
          <CardBody className="flex flex-col gap-3">
            {utilisation.length === 0 ? (
              <p className="text-xs text-crm-muted-fg">No providers on the roster.</p>
            ) : null}
            {utilisation.map(({ p, booked, pct }) => (
              <div key={p.id} className="flex items-center gap-2">
                <Avatar name={p.name} size="sm" />
                <Progress
                  className="flex-1"
                  size="sm"
                  value={Math.min(pct, 100)}
                  tone={pct > 95 ? "danger" : pct < 60 ? "warning" : "success"}
                  label={`${p.name} · ${Math.round(booked / 60)}h`}
                  showValue
                />
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Arrivals by hour" description="Peak front-desk load" />
          <CardBody>
            <div
              className="flex h-40 items-stretch gap-1 pt-4"
              role="img"
              aria-label={`Arrivals by hour: ${byHour
                .map((n, i) => `${hours[i]! % 12 || 12}${hours[i]! < 12 ? "am" : "pm"} ${n}`)
                .join(", ")}`}
            >
              {byHour.map((n, i) => (
                <div key={hours[i]} className="flex h-full flex-1 flex-col items-center gap-1">
                  <div className="relative w-full flex-1">
                    <div
                      className={cn(
                        "absolute inset-x-0 bottom-0 flex justify-center rounded-t-[3px]",
                        n === maxHour ? "bg-crm-primary" : "bg-crm-primary/40",
                      )}
                      style={{ height: `${(n / maxHour) * 100}%`, minHeight: n ? 4 : 0 }}
                      title={`${n} visits`}
                    >
                      {n ? (
                        <span className="-mt-4 text-[10px] text-crm-soft tabular-nums">{n}</span>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-[10px] text-crm-muted-fg tabular-nums">
                    {hours[i]! % 12 || 12}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Clinical inbox" description={`${dueTasks.length} open`} />
          <CardBody>
            {dueTasks.length === 0 ? (
              <p className="flex items-center gap-2 text-xs text-crm-muted-fg">
                <Activity className="size-3.5" aria-hidden /> Inbox zero.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-xs">
                {dueTasks.slice(0, 6).map((t) => {
                  const overdue = new Date(t.due) < now;
                  return (
                    <li key={t.id} className="flex items-center gap-2">
                      <Tag size="sm" color={kindTag[t.kind].color}>
                        {kindTag[t.kind].label}
                      </Tag>
                      <span className="min-w-0 flex-1 truncate">{t.label}</span>
                      <span
                        className={cn(
                          "shrink-0 tabular-nums",
                          overdue ? "text-crm-danger" : "text-crm-muted-fg",
                        )}
                      >
                        {overdue
                          ? "Overdue"
                          : new Date(t.due).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                      </span>
                    </li>
                  );
                })}
                {dueTasks.length > 6 ? (
                  <li className="text-crm-muted-fg">+{dueTasks.length - 6} more</li>
                ) : null}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
