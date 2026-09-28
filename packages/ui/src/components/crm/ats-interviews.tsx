import * as React from "react";
import { AlertTriangle, BellRing, CalendarClock, CheckCircle2, Clock, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { Card } from "@/components/crm/card";
import { EmptyState, Skeleton } from "@/components/crm/feedback";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export type InterviewRecommendation = "strong-yes" | "yes" | "no" | "strong-no";

export interface InterviewPanelist {
  name: string;
  /** Focus area this panelist owns, e.g. "System design". */
  focus?: string;
  /** Present once the scorecard is submitted. */
  recommendation?: InterviewRecommendation;
  /** 1..4 overall rating. */
  score?: number;
}

export interface Interview {
  id: string;
  candidate: string;
  role: string;
  stage: "phone" | "technical" | "onsite" | "final";
  /** ISO start time. */
  start: string;
  durationMin: number;
  location?: string;
  panel: InterviewPanelist[];
  canceled?: boolean;
}

export type InterviewFilter = "upcoming" | "feedback" | "completed" | "all";

export interface AtsInterviewsProps {
  interviews: Interview[];
  /** Reference time; defaults to the current time. */
  now?: Date;
  /** Hours after an interview ends before a missing scorecard is overdue. */
  feedbackSlaHours?: number;
  filter?: InterviewFilter;
  defaultFilter?: InterviewFilter;
  onFilterChange?: (filter: InterviewFilter) => void;
  /** Called with the panelists who still owe a scorecard. */
  onNudge?: (interview: Interview, pending: InterviewPanelist[]) => void;
  onOpen?: (interview: Interview) => void;
  loading?: boolean;
  className?: string;
}

const stageMeta: Record<Interview["stage"], { label: string; color: TagColor }> = {
  phone: { label: "Phone screen", color: "blue" },
  technical: { label: "Technical", color: "purple" },
  onsite: { label: "Onsite", color: "amber" },
  final: { label: "Final", color: "green" },
};

const recMeta: Record<InterviewRecommendation, { label: string; weight: number; cls: string }> = {
  "strong-yes": { label: "Strong yes", weight: 2, cls: "text-crm-success" },
  yes: { label: "Yes", weight: 1, cls: "text-crm-success" },
  no: { label: "No", weight: -1, cls: "text-crm-danger" },
  "strong-no": { label: "Strong no", weight: -2, cls: "text-crm-danger" },
};

type Status = "upcoming" | "live" | "feedback" | "overdue" | "completed" | "canceled";

function statusOf(iv: Interview, now: number, slaMs: number): Status {
  if (iv.canceled) return "canceled";
  const start = new Date(iv.start).getTime();
  const end = start + iv.durationMin * 60_000;
  if (now < start) return "upcoming";
  if (now < end) return "live";
  const pending = iv.panel.some((p) => !p.recommendation);
  if (!pending) return "completed";
  return now - end > slaMs ? "overdue" : "feedback";
}

/** Net panel sentiment: sum of recommendation weights over submitted scorecards. */
export function panelConsensus(panel: InterviewPanelist[]) {
  const done = panel.filter((p) => p.recommendation);
  const net = done.reduce((s, p) => s + recMeta[p.recommendation!].weight, 0);
  const scores = done.map((p) => p.score).filter((s): s is number => typeof s === "number");
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const verdict =
    done.length === 0
      ? "Pending"
      : net >= done.length
        ? "Advance"
        : net > 0
          ? "Lean advance"
          : net === 0
            ? "Split"
            : "Decline";
  return { submitted: done.length, total: panel.length, net, avg, verdict };
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const fmtDay = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
const fmtTime = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function hoursAgo(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`;
}

/** Interview loop tracker: day-grouped schedule, live/overdue scorecard states, panel consensus and nudges. */
export function AtsInterviews({
  interviews,
  now: nowProp,
  feedbackSlaHours = 24,
  filter: filterProp,
  defaultFilter = "upcoming",
  onFilterChange,
  onNudge,
  onOpen,
  loading,
  className,
}: AtsInterviewsProps) {
  const [inner, setInner] = React.useState<InterviewFilter>(defaultFilter);
  const filter = filterProp ?? inner;
  const setFilter = (f: InterviewFilter) => {
    if (filterProp === undefined) setInner(f);
    onFilterChange?.(f);
  };
  const [query, setQuery] = React.useState("");
  const [nudged, setNudged] = React.useState<Set<string>>(() => new Set());
  const now = (nowProp ?? new Date()).getTime();
  const slaMs = feedbackSlaHours * 3_600_000;

  const rows = React.useMemo(
    () =>
      interviews
        .map((iv) => ({ iv, status: statusOf(iv, now, slaMs) }))
        .sort((a, b) => a.iv.start.localeCompare(b.iv.start)),
    [interviews, now, slaMs],
  );

  const counts = {
    upcoming: rows.filter((r) => r.status === "upcoming" || r.status === "live").length,
    feedback: rows.filter((r) => r.status === "feedback" || r.status === "overdue").length,
    completed: rows.filter((r) => r.status === "completed").length,
    all: rows.length,
  };

  const q = query.trim().toLowerCase();
  const visible = rows.filter(({ iv, status }) => {
    if (
      q &&
      !`${iv.candidate} ${iv.role} ${iv.panel.map((p) => p.name).join(" ")}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    if (filter === "upcoming") return status === "upcoming" || status === "live";
    if (filter === "feedback") return status === "feedback" || status === "overdue";
    if (filter === "completed") return status === "completed";
    return true;
  });
  if (filter === "completed" || filter === "feedback") visible.reverse();

  const groups = new Map<string, typeof visible>();
  for (const r of visible) {
    const k = dayKey(new Date(r.iv.start));
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  const nudge = (iv: Interview) => {
    const pending = iv.panel.filter((p) => !p.recommendation);
    onNudge?.(iv, pending);
    setNudged((s) => new Set(s).add(iv.id));
  };

  return (
    <Card className={cn("flex flex-col font-crm", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3">
        <SegmentedControl
          label="Interview filter"
          size="sm"
          value={filter}
          onValueChange={(v) => setFilter(v as InterviewFilter)}
          options={[
            { value: "upcoming", label: "Upcoming", count: counts.upcoming },
            { value: "feedback", label: "Awaiting feedback", count: counts.feedback },
            { value: "completed", label: "Completed", count: counts.completed },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
        <SearchInput
          size="sm"
          className="ml-auto w-full sm:w-56"
          placeholder="Candidate, role, panelist"
          value={query}
          onValueChange={setQuery}
          aria-label="Search interviews"
        />
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 p-3" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          className="py-10"
          icon={<CalendarClock />}
          title={q ? "No interviews match your search" : "Nothing here"}
          description={
            filter === "feedback" ? "Every scorecard is in. Nice work." : "Try another filter."
          }
        />
      ) : (
        <div className="flex flex-col">
          {[...groups.entries()].map(([day, items]) => (
            <section key={day} aria-label={fmtDay(day)}>
              <h3 className="crm-eyebrow sticky top-0 bg-crm-card px-3 pt-3 pb-1 text-crm-muted-fg">
                {fmtDay(day)} · {items.length}
              </h3>
              <ul className="flex flex-col">
                {items.map(({ iv, status }) => {
                  const start = new Date(iv.start);
                  const end = new Date(start.getTime() + iv.durationMin * 60_000);
                  const c = panelConsensus(iv.panel);
                  const pending = iv.panel.filter((p) => !p.recommendation);
                  return (
                    <li
                      key={iv.id}
                      className={cn(
                        "grid grid-cols-1 gap-2 border-t border-crm-border px-3 py-2.5 sm:grid-cols-[88px_1fr_auto] sm:items-center",
                        status === "canceled" && "opacity-50",
                      )}
                    >
                      <div className="flex items-center gap-2 text-xs tabular-nums sm:flex-col sm:items-start sm:gap-0">
                        <span className="font-medium text-crm-fg">{fmtTime(start)}</span>
                        <span className="text-crm-muted-fg">{fmtTime(end)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpen?.(iv)}
                        className="flex min-w-0 flex-col gap-1 rounded-crm text-left outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                      >
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-crm-fg">
                            {iv.candidate}
                          </span>
                          <Tag size="sm" color={stageMeta[iv.stage].color}>
                            {stageMeta[iv.stage].label}
                          </Tag>
                          <StatusPill status={status} since={now - end.getTime()} />
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-crm-muted-fg">
                          <span className="truncate">{iv.role}</span>
                          {iv.location ? (
                            <span className="flex items-center gap-1 [&_svg]:size-3">
                              <Video aria-hidden />
                              {iv.location}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex flex-wrap items-center gap-1">
                          {iv.panel.map((p) => (
                            <span
                              key={p.name}
                              title={`${p.name}${p.focus ? ` · ${p.focus}` : ""}: ${p.recommendation ? recMeta[p.recommendation].label : "scorecard pending"}`}
                              className={cn(
                                "flex items-center gap-1 rounded-full border border-crm-border py-0.5 pr-1.5 pl-0.5 text-[11px]",
                                p.recommendation
                                  ? recMeta[p.recommendation].cls
                                  : "text-crm-muted-fg",
                              )}
                            >
                              <Avatar name={p.name} size="xs" />
                              {p.recommendation ? recMeta[p.recommendation].label : "Pending"}
                            </span>
                          ))}
                        </span>
                      </button>
                      <div className="flex items-center gap-2 sm:justify-end">
                        {c.submitted > 0 ? (
                          <div className="text-right text-xs">
                            <div className="font-medium text-crm-fg">{c.verdict}</div>
                            <div className="text-crm-muted-fg tabular-nums">
                              {c.submitted}/{c.total} in
                              {c.avg !== null ? ` · avg ${c.avg.toFixed(1)}/4` : ""}
                            </div>
                          </div>
                        ) : null}
                        {(status === "feedback" || status === "overdue") && pending.length ? (
                          <Button
                            size="sm"
                            variant={status === "overdue" ? "danger" : "secondary"}
                            disabled={nudged.has(iv.id)}
                            onClick={() => nudge(iv)}
                            aria-label={`Remind ${pending.map((p) => p.name).join(", ")}`}
                          >
                            <BellRing />
                            {nudged.has(iv.id) ? "Reminded" : `Nudge ${pending.length}`}
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

function StatusPill({ status, since }: { status: Status; since: number }) {
  const map: Record<Status, { label: string; cls: string; icon?: React.ReactNode }> = {
    upcoming: { label: "Scheduled", cls: "text-crm-muted-fg", icon: <Clock /> },
    live: { label: "In progress", cls: "text-crm-primary", icon: <Video /> },
    feedback: { label: "Awaiting scorecards", cls: "text-crm-warning", icon: <Clock /> },
    overdue: {
      label: `Feedback overdue · ${hoursAgo(since)}`,
      cls: "text-crm-danger",
      icon: <AlertTriangle />,
    },
    completed: { label: "Complete", cls: "text-crm-success", icon: <CheckCircle2 /> },
    canceled: { label: "Canceled", cls: "text-crm-muted-fg" },
  };
  const m = map[status];
  return (
    <span className={cn("flex items-center gap-1 text-[11px] [&_svg]:size-3", m.cls)}>
      {m.icon}
      {m.label}
    </span>
  );
}
