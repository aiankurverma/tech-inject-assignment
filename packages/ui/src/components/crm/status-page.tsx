import * as React from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, XCircle, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";

export type ServiceState = "operational" | "degraded" | "partial" | "major" | "maintenance";

export interface DayUptime {
  /** ISO date (yyyy-mm-dd). */
  date: string;
  /** Minutes of downtime that day (0–1440). Omit for "no data". */
  downMinutes?: number;
}

export interface StatusService {
  id: string;
  name: string;
  description?: string;
  state: ServiceState;
  /** Oldest first; usually 90 entries. */
  history: DayUptime[];
  group?: string;
}

export interface IncidentUpdate {
  status: "investigating" | "identified" | "monitoring" | "resolved";
  /** ISO timestamp. */
  at: string;
  message: string;
}

export interface StatusIncident {
  id: string;
  title: string;
  impact: "minor" | "major" | "critical" | "maintenance";
  serviceIds: string[];
  updates: IncidentUpdate[];
}

export interface StatusPageProps {
  services: StatusService[];
  incidents?: StatusIncident[];
  /** ISO timestamp of the last data refresh. */
  updatedAt?: string;
  onSubscribe?: () => void;
  timeZone?: string;
  className?: string;
}

const stateMeta: Record<ServiceState, { label: string; text: string; bg: string; rank: number }> = {
  operational: { label: "Operational", text: "text-crm-success", bg: "bg-crm-success", rank: 0 },
  maintenance: {
    label: "Under maintenance",
    text: "text-crm-primary",
    bg: "bg-crm-primary",
    rank: 1,
  },
  degraded: {
    label: "Degraded performance",
    text: "text-crm-warning",
    bg: "bg-crm-warning",
    rank: 2,
  },
  partial: { label: "Partial outage", text: "text-[#f97316]", bg: "bg-[#f97316]", rank: 3 },
  major: { label: "Major outage", text: "text-crm-danger", bg: "bg-crm-danger", rank: 4 },
};

const impactColor: Record<StatusIncident["impact"], string> = {
  minor: "border-crm-warning/50",
  major: "border-[#f97316]/60",
  critical: "border-crm-danger/60",
  maintenance: "border-crm-primary/50",
};

/** Uptime % across days with data; exported for reuse in SLA reports. */
export function uptimePercent(history: DayUptime[]) {
  const days = history.filter((d) => d.downMinutes !== undefined);
  if (!days.length) return null;
  const down = days.reduce((n, d) => n + (d.downMinutes ?? 0), 0);
  return 100 - (down / (days.length * 1440)) * 100;
}

function barColor(d: DayUptime) {
  if (d.downMinutes === undefined) return "bg-crm-track";
  if (d.downMinutes === 0) return "bg-crm-success";
  if (d.downMinutes < 30) return "bg-crm-warning";
  if (d.downMinutes < 240) return "bg-[#f97316]";
  return "bg-crm-danger";
}

function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

function UptimeBars({ service }: { service: StatusService }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const h = service.history;
  const pct = uptimePercent(h);
  const d = hover !== null ? h[hover] : null;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex h-8 items-stretch gap-[2px]"
        role="img"
        aria-label={`${service.name}: ${pct === null ? "no data" : `${pct.toFixed(2)}% uptime`} over the last ${h.length} days`}
        onMouseLeave={() => setHover(null)}
      >
        {h.map((day, i) => (
          <span
            key={day.date}
            onMouseEnter={() => setHover(i)}
            className={cn(
              "min-w-0 flex-1 rounded-[2px] transition-opacity",
              barColor(day),
              hover !== null && hover !== i && "opacity-60",
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-between crm-caption text-crm-subtle tabular-nums">
        <span>{h.length} days ago</span>
        <span className="text-crm-soft" aria-live="polite">
          {d
            ? `${new Date(d.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} · ${
                d.downMinutes === undefined
                  ? "No data"
                  : d.downMinutes === 0
                    ? "No downtime"
                    : `${fmtDuration(d.downMinutes)} down`
              }`
            : pct === null
              ? "No data"
              : `${pct.toFixed(2)}% uptime`}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}

/** Public status page: overall banner, grouped services with 90-day uptime bars and incident timelines. */
export function StatusPage({
  services,
  incidents = [],
  updatedAt,
  onSubscribe,
  timeZone,
  className,
}: StatusPageProps) {
  const [expanded, setExpanded] = React.useState<string[]>([]);
  const worst = services.reduce<ServiceState>(
    (w, s) => (stateMeta[s.state].rank > stateMeta[w].rank ? s.state : w),
    "operational",
  );
  const affected = services.filter((s) => s.state !== "operational").length;
  const active = incidents.filter((i) => i.updates.at(-1)?.status !== "resolved");
  const past = incidents.filter((i) => i.updates.at(-1)?.status === "resolved");

  const groups = React.useMemo(() => {
    const m = new Map<string, StatusService[]>();
    for (const s of services) {
      const k = s.group ?? "Services";
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [services]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    });

  const Icon =
    worst === "operational"
      ? CheckCircle2
      : worst === "maintenance"
        ? Wrench
        : worst === "major"
          ? XCircle
          : AlertTriangle;

  const renderIncident = (inc: StatusIncident) => {
    const open = expanded.includes(inc.id) || active.includes(inc);
    const updates = [...inc.updates].reverse();
    const first = inc.updates[0];
    const last = inc.updates.at(-1);
    const dur =
      first && last && last.status === "resolved"
        ? Math.round((new Date(last.at).getTime() - new Date(first.at).getTime()) / 60000)
        : null;
    return (
      <li key={inc.id} className={cn("rounded-crm border bg-crm-card", impactColor[inc.impact])}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() =>
            setExpanded((e) =>
              e.includes(inc.id) ? e.filter((x) => x !== inc.id) : [...e, inc.id],
            )
          }
          className="flex w-full items-start justify-between gap-3 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-crm-fg">{inc.title}</span>
            <span className="crm-caption text-crm-subtle">
              Affects{" "}
              {inc.serviceIds.map((id) => services.find((s) => s.id === id)?.name ?? id).join(", ")}
              {dur !== null ? ` · resolved in ${fmtDuration(dur)}` : ""}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={cn("mt-0.5 size-4 shrink-0 text-crm-subtle", open && "rotate-180")}
          />
        </button>
        {open ? (
          <ol className="flex flex-col gap-3 border-t border-crm-border p-4">
            {updates.map((u, i) => (
              <li key={i} className="grid gap-0.5 sm:grid-cols-[110px_1fr] sm:gap-3">
                <span className="text-xs font-semibold text-crm-fg capitalize">{u.status}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm text-crm-soft">{u.message}</span>
                  <time dateTime={u.at} className="crm-caption text-crm-subtle">
                    {fmt(u.at)}
                  </time>
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </li>
    );
  };

  return (
    <section aria-label="System status" className={cn("flex flex-col gap-6 font-crm", className)}>
      <div
        role="status"
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-crm border border-crm-border bg-crm-card p-4",
          stateMeta[worst].text,
        )}
      >
        <span className="flex items-center gap-2 text-base font-semibold [&_svg]:size-5">
          <Icon aria-hidden />
          {worst === "operational"
            ? "All systems operational"
            : `${stateMeta[worst].label} · ${affected} of ${services.length} services affected`}
        </span>
        <span className="flex items-center gap-3">
          {updatedAt ? (
            <span className="crm-caption text-crm-subtle">Updated {fmt(updatedAt)}</span>
          ) : null}
          {onSubscribe ? (
            <Button size="sm" variant="primary" onClick={onSubscribe}>
              Subscribe to updates
            </Button>
          ) : null}
        </span>
      </div>

      {active.length ? (
        <div className="flex flex-col gap-2">
          <h2 className="crm-eyebrow text-crm-soft">Active incidents</h2>
          <ul className="flex flex-col gap-2">{active.map(renderIncident)}</ul>
        </div>
      ) : null}

      {groups.map(([group, list]) => (
        <div key={group} className="flex flex-col gap-2">
          <h2 className="crm-eyebrow text-crm-soft">{group}</h2>
          <ul className="divide-y divide-crm-border rounded-crm border border-crm-border bg-crm-card">
            {list.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-crm-fg">{s.name}</span>
                    {s.description ? (
                      <span className="crm-caption text-crm-subtle">{s.description}</span>
                    ) : null}
                  </span>
                  <span
                    className={cn("flex items-center gap-1.5 text-xs", stateMeta[s.state].text)}
                  >
                    <span
                      aria-hidden
                      className={cn("size-2 rounded-full", stateMeta[s.state].bg)}
                    />
                    {stateMeta[s.state].label}
                  </span>
                </div>
                {s.history.length ? (
                  <UptimeBars service={s} />
                ) : (
                  <span className="crm-caption text-crm-subtle">No uptime history yet.</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="flex flex-col gap-2">
        <h2 className="crm-eyebrow text-crm-soft">Past incidents</h2>
        {past.length ? (
          <ul className="flex flex-col gap-2">{past.map(renderIncident)}</ul>
        ) : (
          <p className="text-sm text-crm-subtle">No incidents reported in this period.</p>
        )}
      </div>
    </section>
  );
}
