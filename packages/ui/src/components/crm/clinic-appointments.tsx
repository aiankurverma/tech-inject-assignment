import * as React from "react";
import { AlertTriangle, CalendarX2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { Card } from "@/components/crm/card";
import { EmptyState } from "@/components/crm/feedback";
import { Tag, type TagColor } from "@/components/crm/tag";

export type AppointmentStatus =
  "scheduled" | "checked-in" | "in-room" | "completed" | "no-show" | "canceled";

export interface ClinicProvider {
  id: string;
  name: string;
  specialty?: string;
}

export interface ClinicAppointment {
  id: string;
  providerId: string;
  patient: string;
  reason: string;
  /** ISO start time. */
  start: string;
  durationMin: number;
  status: AppointmentStatus;
  /** ISO time the patient checked in; drives the wait timer. */
  checkedInAt?: string;
  newPatient?: boolean;
}

export interface ClinicAppointmentsProps {
  providers: ClinicProvider[];
  appointments?: ClinicAppointment[];
  defaultAppointments?: ClinicAppointment[];
  onAppointmentsChange?: (next: ClinicAppointment[]) => void;
  /** Reference time for the now-line, lateness and wait timers. */
  now?: Date;
  /** Day hours shown, 24h. */
  startHour?: number;
  endHour?: number;
  /** Minutes waiting after check-in before the wait is flagged. */
  waitAlertMin?: number;
  className?: string;
}

const statusMeta: Record<AppointmentStatus, { label: string; color: TagColor; block: string }> = {
  scheduled: { label: "Scheduled", color: "neutral", block: "border-crm-border bg-crm-muted/60" },
  "checked-in": {
    label: "Checked in",
    color: "amber",
    block: "border-tag-amber-border bg-tag-amber-bg",
  },
  "in-room": { label: "In room", color: "blue", block: "border-tag-blue-border bg-tag-blue-bg" },
  completed: {
    label: "Completed",
    color: "green",
    block: "border-tag-green-border bg-tag-green-bg",
  },
  "no-show": {
    label: "No-show",
    color: "red",
    block: "border-tag-red-border bg-tag-red-bg opacity-70",
  },
  canceled: {
    label: "Canceled",
    color: "neutral",
    block: "border-crm-border bg-transparent opacity-50 line-through",
  },
};

/** Allowed next status for the front-desk workflow. */
const nextStep: Partial<Record<AppointmentStatus, { to: AppointmentStatus; label: string }>> = {
  scheduled: { to: "checked-in", label: "Check in" },
  "checked-in": { to: "in-room", label: "Room patient" },
  "in-room": { to: "completed", label: "Complete visit" },
};

const HOUR_PX = 96;

/** Assigns side-by-side lanes to overlapping appointments so blocks never cover each other. */
function layoutLanes(appts: ClinicAppointment[]) {
  const sorted = [...appts].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
  const out = new Map<string, { lane: number; lanes: number }>();
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const c of cluster) out.set(c.id, { lane: c.lane, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };
  for (const a of sorted) {
    const st = new Date(a.start).getTime();
    const en = st + a.durationMin * 60_000;
    if (st >= clusterEnd) {
      flush();
      clusterEnd = en;
    } else clusterEnd = Math.max(clusterEnd, en);
    let lane = laneEnds.findIndex((e) => e <= st);
    if (lane === -1) lane = laneEnds.push(en) - 1;
    else laneEnds[lane] = en;
    cluster.push({ id: a.id, lane });
  }
  flush();
  return out;
}
const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
const fmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** Returns ids of appointments that overlap another active one for the same provider. */
export function findDoubleBookings(appts: ClinicAppointment[]) {
  const out = new Set<string>();
  const active = appts.filter((a) => a.status !== "canceled" && a.status !== "no-show");
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      if (a.providerId !== b.providerId) continue;
      const as = new Date(a.start).getTime();
      const bs = new Date(b.start).getTime();
      if (as < bs + b.durationMin * 60_000 && bs < as + a.durationMin * 60_000) {
        out.add(a.id);
        out.add(b.id);
      }
    }
  return out;
}

/** Front-desk day view: provider columns on a time grid with check-in → room → complete flow, wait timers and double-booking flags. */
export function ClinicAppointments({
  providers,
  appointments: apptsProp,
  defaultAppointments = [],
  onAppointmentsChange,
  now: nowProp,
  startHour = 8,
  endHour = 18,
  waitAlertMin = 20,
  className,
}: ClinicAppointmentsProps) {
  const [inner, setInner] = React.useState(defaultAppointments);
  const appts = apptsProp ?? inner;
  const now = nowProp ?? new Date();
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = React.useState<string | null>(null);

  const update = (id: string, patch: Partial<ClinicAppointment>) => {
    const next = appts.map((a) => (a.id === id ? { ...a, ...patch } : a));
    if (apptsProp === undefined) setInner(next);
    onAppointmentsChange?.(next);
  };

  const conflicts = React.useMemo(() => findDoubleBookings(appts), [appts]);
  const cols = providers.filter((p) => !hidden.has(p.id));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const nowMin = minutesOfDay(now) - startHour * 60;
  const showNow = nowMin >= 0 && nowMin <= (endHour - startHour) * 60;

  const waiting = appts.filter((a) => a.status === "checked-in");
  const summary = {
    booked: appts.filter((a) => a.status !== "canceled").length,
    waiting: waiting.length,
    done: appts.filter((a) => a.status === "completed").length,
    noShow: appts.filter((a) => a.status === "no-show").length,
  };
  const open = appts.find((a) => a.id === openId) ?? null;

  return (
    <Card className={cn("flex flex-col font-crm text-crm-fg", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3 text-xs">
        <span className="text-crm-muted-fg">
          {summary.booked} booked · {summary.waiting} waiting · {summary.done} done ·{" "}
          {summary.noShow} no-show
        </span>
        <div className="ml-auto flex flex-wrap gap-1" role="group" aria-label="Show providers">
          {providers.map((p) => {
            const on = !hidden.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setHidden((s) => {
                    const n = new Set(s);
                    if (n.has(p.id)) n.delete(p.id);
                    else n.add(p.id);
                    return n;
                  })
                }
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                  on ? "border-crm-primary/60 text-crm-fg" : "border-crm-border text-crm-muted-fg",
                )}
              >
                <Avatar name={p.name} size="xs" />
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {cols.length === 0 ? (
        <EmptyState icon={<CalendarX2 />} title="No providers selected" />
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid"
            style={{ gridTemplateColumns: `52px repeat(${cols.length}, minmax(200px, 1fr))` }}
          >
            <div className="sticky left-0 z-10 border-b border-crm-border bg-crm-card" />
            {cols.map((p) => (
              <div key={p.id} className="border-b border-l border-crm-border px-2 py-2 text-xs">
                <div className="font-medium">{p.name}</div>
                {p.specialty ? <div className="text-crm-muted-fg">{p.specialty}</div> : null}
              </div>
            ))}
            <div className="sticky left-0 z-10 bg-crm-card">
              {hours.map((h) => (
                <div
                  key={h}
                  className="pr-1 text-right text-[11px] text-crm-muted-fg tabular-nums"
                  style={{ height: HOUR_PX }}
                >
                  {new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" })}
                </div>
              ))}
            </div>
            {cols.map((p) => (
              <div
                key={p.id}
                role="group"
                aria-label={`${p.name} schedule`}
                className="relative border-l border-crm-border"
                style={{
                  height: hours.length * HOUR_PX,
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR_PX - 1}px, var(--color-crm-border) ${HOUR_PX - 1}px ${HOUR_PX}px)`,
                }}
              >
                {showNow ? (
                  <div
                    aria-hidden
                    className="absolute inset-x-0 z-10 h-px bg-crm-danger"
                    style={{ top: (nowMin / 60) * HOUR_PX }}
                  />
                ) : null}
                {(() => {
                  const mine = appts.filter((a) => a.providerId === p.id);
                  const lanes = layoutLanes(mine);
                  return mine.map((a) => {
                    const ln = lanes.get(a.id) ?? { lane: 0, lanes: 1 };
                    const s = new Date(a.start);
                    const top = ((minutesOfDay(s) - startHour * 60) / 60) * HOUR_PX;
                    const h = Math.max(44, (a.durationMin / 60) * HOUR_PX - 2);
                    const waitMin = a.checkedInAt
                      ? Math.floor((now.getTime() - new Date(a.checkedInAt).getTime()) / 60_000)
                      : 0;
                    const late =
                      a.status === "scheduled" && now.getTime() - s.getTime() > 10 * 60_000;
                    const longWait = a.status === "checked-in" && waitMin >= waitAlertMin;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setOpenId(a.id)}
                        aria-label={[
                          `${fmt(s)} ${a.patient}, ${a.reason}, ${statusMeta[a.status].label}`,
                          conflicts.has(a.id) ? "double-booked" : "",
                          late ? "late arrival" : "",
                          a.status === "checked-in" ? `waiting ${waitMin} minutes` : "",
                        ]
                          .filter(Boolean)
                          .join(", ")}
                        className={cn(
                          "absolute overflow-hidden rounded-[6px] border px-1.5 py-1 text-left text-[11px] leading-tight outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                          statusMeta[a.status].block,
                          conflicts.has(a.id) && "ring-1 ring-crm-danger",
                          openId === a.id && "ring-2 ring-crm-primary",
                        )}
                        style={{
                          top,
                          height: h,
                          left: `calc(${(ln.lane / ln.lanes) * 100}% + 4px)`,
                          width: `calc(${100 / ln.lanes}% - 8px)`,
                        }}
                      >
                        <span className="flex items-center gap-1 font-medium text-crm-fg">
                          <span className="truncate">{a.patient}</span>
                          {a.newPatient ? <span className="text-crm-primary">NEW</span> : null}
                          {conflicts.has(a.id) || late || longWait ? (
                            <AlertTriangle
                              className="ml-auto size-3 shrink-0 text-crm-danger"
                              aria-hidden
                            />
                          ) : null}
                        </span>
                        <span className="block truncate text-crm-muted-fg">
                          {fmt(s)} · {a.reason}
                        </span>
                        {a.status === "checked-in" ? (
                          <span
                            className={cn(
                              "block tabular-nums",
                              longWait ? "text-crm-danger" : "text-crm-warning",
                            )}
                          >
                            Waiting {waitMin}m
                          </span>
                        ) : late ? (
                          <span className="block text-crm-danger">Late arrival</span>
                        ) : null}
                      </button>
                    );
                  });
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {open ? (
        <div
          className="flex flex-wrap items-center gap-2 border-t border-crm-border p-3 text-xs"
          aria-live="polite"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{open.patient}</span>
              <Tag size="sm" color={statusMeta[open.status].color}>
                {statusMeta[open.status].label}
              </Tag>
            </div>
            <div className="text-crm-muted-fg">
              {fmt(new Date(open.start))} · {open.durationMin} min · {open.reason} ·{" "}
              {providers.find((p) => p.id === open.providerId)?.name}
              {conflicts.has(open.id) ? " · Double-booked" : ""}
            </div>
          </div>
          {nextStep[open.status] ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const step = nextStep[open.status]!;
                update(open.id, {
                  status: step.to,
                  ...(step.to === "checked-in" ? { checkedInAt: now.toISOString() } : {}),
                });
              }}
            >
              {nextStep[open.status]!.label}
            </Button>
          ) : null}
          {open.status === "scheduled" ? (
            <>
              <Button
                size="sm"
                variant="danger"
                onClick={() => update(open.id, { status: "no-show" })}
              >
                No-show
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => update(open.id, { status: "canceled" })}
              >
                Cancel
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>
            Close
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
