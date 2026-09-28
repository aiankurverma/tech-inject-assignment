import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { SegmentedControl } from "@/components/crm/segmented-control";

export interface GoalCheckIn {
  /** ISO date. */
  date: string;
  value: number;
  note?: string;
}

export interface Goal {
  id: string;
  title: string;
  team: string;
  owner: { name: string; avatar?: string };
  unit: "currency" | "number" | "percent";
  /** Starting value (baseline). */
  start?: number;
  target: number;
  /** ISO dates of the goal window. */
  startDate: string;
  endDate: string;
  /** For lower-is-better goals (churn, response time) set target below start; pace maths handles it. */
  checkIns: GoalCheckIn[];
}

export type GoalStatus = "achieved" | "on-track" | "behind" | "at-risk" | "not-started";

export interface GoalTrackerProps {
  goals: Goal[];
  currency?: string;
  /** "Today" used for pace; defaults to now. */
  asOf?: string;
  onCheckIn?: (goalId: string, value: number) => void;
  className?: string;
}

const statusMeta: Record<GoalStatus, { label: string; cls: string; bar: string }> = {
  achieved: {
    label: "Achieved",
    cls: "border-tag-green-border bg-tag-green-bg text-tag-green-text",
    bar: "bg-crm-success",
  },
  "on-track": {
    label: "On track",
    cls: "border-tag-blue-border bg-tag-blue-bg text-tag-blue-text",
    bar: "bg-crm-primary",
  },
  behind: {
    label: "Behind",
    cls: "border-tag-amber-border bg-tag-amber-bg text-tag-amber-text",
    bar: "bg-crm-warning",
  },
  "at-risk": {
    label: "At risk",
    cls: "border-tag-red-border bg-tag-red-bg text-tag-red-text",
    bar: "bg-crm-danger",
  },
  "not-started": {
    label: "Not started",
    cls: "border-tag-neutral-border bg-tag-neutral-bg text-tag-neutral-text",
    bar: "bg-crm-faint",
  },
};

/** Progress, expected pace (linear over the window), projection and status for one goal. */
export function goalPace(g: Goal, now: number) {
  const sorted = [...g.checkIns].sort((a, b) => a.date.localeCompare(b.date));
  const base = g.start ?? 0;
  const current = sorted[sorted.length - 1]?.value ?? base;
  const span = g.target - base;
  const progress = span ? (current - base) / span : 0;
  const t0 = Date.parse(g.startDate);
  const t1 = Date.parse(g.endDate);
  const elapsed = Math.min(1, Math.max(0, (now - t0) / Math.max(1, t1 - t0)));
  const projected = elapsed > 0 ? base + (current - base) / elapsed : current;
  const daysLeft = Math.ceil((t1 - now) / 86_400_000);
  let status: GoalStatus;
  if (progress >= 1) status = "achieved";
  else if (now < t0 || (!sorted.length && elapsed < 0.1)) status = "not-started";
  else if (progress >= elapsed - 0.05) status = "on-track";
  else if (progress >= elapsed * 0.7) status = "behind";
  else status = "at-risk";
  return { current, progress, elapsed, projected, daysLeft, status, sorted };
}

/**
 * Team goal tracker (OKR-style): progress vs. time-elapsed pace marker, run-rate projection,
 * status roll-up per team, status filter and inline check-in logging with history.
 */
export function GoalTracker({
  goals,
  currency = "USD",
  asOf,
  onCheckIn,
  className,
}: GoalTrackerProps) {
  const now = asOf ? Date.parse(asOf) : Date.now();
  const [filter, setFilter] = React.useState<"all" | GoalStatus>("all");
  const [open, setOpen] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const fmt = (g: Goal, v: number) =>
    g.unit === "currency"
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(v)
      : g.unit === "percent"
        ? `${v.toFixed(1)}%`
        : Math.round(v).toLocaleString("en-US");

  const computed = goals.map((g) => ({ g, p: goalPace(g, now) }));
  const counts = computed.reduce<Record<string, number>>((acc, { p }) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const teams = Array.from(new Set(goals.map((g) => g.team)));
  const visible = computed.filter(({ p }) => filter === "all" || p.status === filter);

  const submit = (g: Goal) => {
    const n = Number(draft.replace(/[^0-9.-]/g, ""));
    if (!draft.trim() || !Number.isFinite(n)) {
      setError("Enter a number");
      return;
    }
    onCheckIn?.(g.id, n);
    setDraft("");
    setError(null);
  };

  return (
    <section
      aria-label="Goal tracker"
      className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Goals</p>
          <h2 className="text-lg font-semibold tracking-tight">
            {counts["achieved"] ?? 0}/{goals.length} achieved ·{" "}
            {(counts["on-track"] ?? 0) + (counts["achieved"] ?? 0)} on pace
          </h2>
        </div>
        <SegmentedControl
          label="Filter by status"
          size="sm"
          value={filter}
          onValueChange={(v) => setFilter(v as typeof filter)}
          options={[
            { value: "all", label: "All", count: goals.length },
            ...(["at-risk", "behind", "on-track", "achieved"] as GoalStatus[]).map((s) => ({
              value: s,
              label: statusMeta[s].label,
              count: counts[s] ?? 0,
            })),
          ]}
        />
      </header>

      {goals.length === 0 ? (
        <p className="rounded-crm border border-dashed border-crm-border p-10 text-center text-sm text-crm-subtle">
          No goals this period. Set a measurable target to start tracking.
        </p>
      ) : (
        teams.map((team) => {
          const items = visible.filter(({ g }) => g.team === team);
          if (!items.length) return null;
          const avg =
            items.reduce((s, { p }) => s + Math.min(1, Math.max(0, p.progress)), 0) / items.length;
          return (
            <div
              key={team}
              className="rounded-crm border border-crm-border bg-crm-card shadow-crm-raised"
            >
              <div className="flex items-center justify-between border-b border-crm-border px-4 py-2.5">
                <h3 className="text-sm font-medium">{team}</h3>
                <span className="text-xs text-crm-subtle tabular-nums">
                  avg {Math.round(avg * 100)}% complete
                </span>
              </div>
              <ul className="divide-y divide-crm-border">
                {items.map(({ g, p }) => {
                  const meta = statusMeta[p.status];
                  const isOpen = open === g.id;
                  const pct = Math.min(100, Math.max(0, p.progress * 100));
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`goal-${g.id}`}
                        onClick={() => {
                          setOpen(isOpen ? null : g.id);
                          setDraft("");
                          setError(null);
                        }}
                        className="grid w-full grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-4 py-3 text-left hover:bg-crm-muted/40 focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none focus-visible:ring-inset sm:grid-cols-[16px_minmax(0,1fr)_220px_84px]"
                      >
                        <ChevronRight
                          className={cn(
                            "size-4 text-crm-subtle transition-transform",
                            isOpen && "rotate-90",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{g.title}</span>
                          <span className="flex items-center gap-1.5 text-xs text-crm-subtle">
                            <Avatar name={g.owner.name} src={g.owner.avatar} size="xs" />
                            {g.owner.name} · {p.daysLeft > 0 ? `${p.daysLeft}d left` : "Ended"}
                          </span>
                        </span>
                        <span className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                          <span
                            className="relative h-2 rounded-full bg-crm-muted"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(pct)}
                            aria-label={`${g.title} progress; ${Math.round(p.elapsed * 100)}% of time elapsed`}
                          >
                            <span
                              className={cn("absolute inset-y-0 left-0 rounded-full", meta.bar)}
                              style={{ width: `${pct}%` }}
                            />
                            <span
                              className="absolute -inset-y-1 w-0.5 rounded bg-crm-fg"
                              style={{ left: `${p.elapsed * 100}%` }}
                              title="Expected pace"
                              aria-hidden
                            />
                          </span>
                          <span className="flex justify-between text-[11px] text-crm-subtle tabular-nums">
                            <span>
                              {fmt(g, p.current)} / {fmt(g, g.target)}
                            </span>
                            <span>proj. {fmt(g, p.projected)}</span>
                          </span>
                        </span>
                        <span
                          className={cn(
                            "hidden justify-self-end rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap sm:inline",
                            meta.cls,
                          )}
                        >
                          {meta.label}
                        </span>
                      </button>
                      {isOpen ? (
                        <div
                          id={`goal-${g.id}`}
                          className="grid gap-3 px-4 pb-4 pl-11 sm:grid-cols-[1fr_240px]"
                        >
                          <ol
                            className="flex flex-col gap-1.5 text-xs"
                            aria-label="Check-in history"
                          >
                            {p.sorted.length === 0 ? (
                              <li className="text-crm-subtle">No check-ins yet.</li>
                            ) : null}
                            {[...p.sorted].reverse().map((c) => (
                              <li key={c.date} className="flex gap-2">
                                <time
                                  dateTime={c.date}
                                  className="w-20 shrink-0 text-crm-subtle tabular-nums"
                                >
                                  {new Date(c.date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    timeZone: "UTC",
                                  })}
                                </time>
                                <span className="w-16 shrink-0 font-medium tabular-nums">
                                  {fmt(g, c.value)}
                                </span>
                                <span className="text-crm-soft">{c.note}</span>
                              </li>
                            ))}
                          </ol>
                          {onCheckIn ? (
                            <form
                              className="flex flex-col gap-1"
                              onSubmit={(e) => {
                                e.preventDefault();
                                submit(g);
                              }}
                            >
                              <label htmlFor={`ci-${g.id}`} className="text-xs text-crm-subtle">
                                New check-in value
                              </label>
                              <span className="flex gap-1.5">
                                <input
                                  id={`ci-${g.id}`}
                                  inputMode="decimal"
                                  value={draft}
                                  aria-invalid={!!error}
                                  aria-describedby={error ? `ci-err-${g.id}` : undefined}
                                  onChange={(e) => setDraft(e.target.value)}
                                  placeholder={String(p.current)}
                                  className="h-8 min-w-0 flex-1 rounded-crm border border-crm-border bg-crm-input px-2 text-sm tabular-nums aria-[invalid=true]:border-crm-danger focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                                />
                                <button
                                  type="submit"
                                  className="h-8 rounded-crm bg-crm-primary px-3 text-xs font-medium text-crm-primary-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                                >
                                  Log
                                </button>
                              </span>
                              {error ? (
                                <span id={`ci-err-${g.id}`} className="text-xs text-crm-danger">
                                  {error}
                                </span>
                              ) : null}
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}
