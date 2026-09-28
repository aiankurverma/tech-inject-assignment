import * as React from "react";
import { AlertTriangle, CalendarClock, ChevronDown, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarGroup } from "@/components/crm/avatar-group";
import { EmptyState, Skeleton } from "@/components/crm/feedback";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export type ProjectPhase = "discovery" | "design" | "build" | "launch" | "closed";
export type ProjectBilling = "fixed" | "t&m" | "retainer";

export interface ProjectMilestone {
  name: string;
  /** ISO date. */
  due: string;
  done: boolean;
}

export interface AgencyProject {
  id: string;
  name: string;
  client: string;
  phase: ProjectPhase;
  billing: ProjectBilling;
  /** Agreed budget in currency units. */
  budget: number;
  /** Cost of time + expenses logged so far. */
  spent: number;
  /** Delivery progress 0–100 as reported by the PM. */
  progress: number;
  /** ISO date. */
  dueDate: string;
  team: string[];
  milestones?: ProjectMilestone[];
}

export type ProjectHealth = "on-track" | "at-risk" | "over-budget" | "late";

export interface AgencyProjectsProps {
  projects: AgencyProject[];
  currency?: string;
  locale?: string;
  today?: Date;
  loading?: boolean;
  error?: string;
  /** Burn-minus-progress margin (percentage points) before a project is flagged at risk. */
  riskMargin?: number;
  onOpenProject?: (project: AgencyProject) => void;
  className?: string;
}

const phases: ProjectPhase[] = ["discovery", "design", "build", "launch", "closed"];

const healthMeta: Record<ProjectHealth, { label: string; color: TagColor }> = {
  "on-track": { label: "On track", color: "green" },
  "at-risk": { label: "At risk", color: "amber" },
  "over-budget": { label: "Over budget", color: "red" },
  late: { label: "Late", color: "orange" },
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Derives project health from budget burn vs. delivery progress and due date.
 * Over budget wins, then late, then at-risk when burn outpaces progress by `margin` points.
 */
export function projectHealth(p: AgencyProject, today: Date, margin = 15): ProjectHealth {
  const burn = p.budget > 0 ? (p.spent / p.budget) * 100 : 0;
  if (burn > 100) return "over-budget";
  if (p.phase !== "closed" && new Date(`${p.dueDate}T00:00:00`).getTime() < startOfDay(today))
    return "late";
  if (burn - p.progress > margin) return "at-risk";
  return "on-track";
}

/** Agency project portfolio: budget burn vs. progress, derived health, milestones, phase grouping. */
export function AgencyProjects({
  projects,
  currency = "USD",
  locale = "en-US",
  today = new Date(),
  loading,
  error,
  riskMargin = 15,
  onOpenProject,
  className,
}: AgencyProjectsProps) {
  const [client, setClient] = React.useState("all");
  const [health, setHealth] = React.useState<"all" | ProjectHealth>("all");
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const dateFmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });

  const clients = Array.from(new Set(projects.map((p) => p.client))).sort();
  const withHealth = projects.map((p) => ({ p, h: projectHealth(p, today, riskMargin) }));
  const byClient = withHealth.filter(({ p }) => client === "all" || p.client === client);
  const visible = byClient.filter(({ h }) => health === "all" || h === health);
  const count = (h: ProjectHealth) => byClient.filter((x) => x.h === h).length;

  const budget = visible.reduce((s, { p }) => s + p.budget, 0);
  const spent = visible.reduce((s, { p }) => s + p.spent, 0);

  if (error)
    return (
      <EmptyState
        tone="error"
        icon={<AlertTriangle />}
        title="Couldn't load projects"
        description={error}
        className={cn("rounded-crm border border-crm-border bg-crm-card", className)}
      />
    );

  return (
    <section
      aria-label="Agency projects"
      className={cn("flex w-full min-w-0 flex-col gap-3 font-crm", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label="Filter by health"
          size="sm"
          value={health}
          onValueChange={(v) => setHealth(v as "all" | ProjectHealth)}
          options={[
            { value: "all", label: "All", count: byClient.length },
            ...(Object.keys(healthMeta) as ProjectHealth[]).map((h) => ({
              value: h,
              label: healthMeta[h].label,
              count: count(h),
            })),
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-crm-soft">
          Client
          <select
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="h-7 rounded-crm border border-crm-border bg-crm-raised px-2 text-xs text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
          >
            <option value="all">All clients</option>
            {clients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-crm-soft tabular-nums" aria-live="polite">
        {visible.length} projects · {money.format(spent)} of {money.format(budget)} spent (
        {budget ? Math.round((spent / budget) * 100) : 0}%)
      </p>

      {loading ? (
        <div
          className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]"
          aria-busy="true"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<FolderKanban />}
          title="No projects in this view"
          description="Change the client or health filter."
          className="rounded-crm border border-crm-border bg-crm-card"
        />
      ) : (
        phases.map((phase) => {
          const items = visible.filter(({ p }) => p.phase === phase);
          if (!items.length) return null;
          return (
            <div key={phase} className="flex flex-col gap-2">
              <h3 className="crm-eyebrow text-crm-subtle capitalize">
                {phase} · {items.length}
              </h3>
              <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]">
                {items.map(({ p, h }) => {
                  const burn = p.budget ? (p.spent / p.budget) * 100 : 0;
                  const open = expanded === p.id;
                  const ms = p.milestones ?? [];
                  const next = ms.find((m) => !m.done);
                  return (
                    <li
                      key={p.id}
                      className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenProject?.(p)}
                          className="min-w-0 cursor-pointer rounded-sm text-left focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
                        >
                          <span className="block truncate text-sm font-medium text-crm-fg">
                            {p.name}
                          </span>
                          <span className="text-xs text-crm-subtle">
                            {p.client} · {p.billing === "t&m" ? "T&M" : p.billing}
                          </span>
                        </button>
                        <Tag size="sm" color={healthMeta[h].color}>
                          {healthMeta[h].label}
                        </Tag>
                      </div>

                      <div className="flex flex-col gap-1.5" aria-label="Budget burn vs progress">
                        {[
                          { label: "Delivered", v: p.progress, cls: "bg-crm-primary" },
                          {
                            label: "Budget used",
                            v: burn,
                            cls:
                              burn > 100
                                ? "bg-crm-danger"
                                : burn - p.progress > riskMargin
                                  ? "bg-crm-warning"
                                  : "bg-crm-success",
                          },
                        ].map((bar) => (
                          <div key={bar.label} className="flex items-center gap-2 text-xs">
                            <span className="w-20 shrink-0 text-crm-soft">{bar.label}</span>
                            <div
                              className="h-1.5 flex-1 overflow-hidden rounded-full bg-crm-muted"
                              role="meter"
                              aria-label={`${p.name} ${bar.label}`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={Math.round(bar.v)}
                            >
                              <div
                                className={cn("h-full rounded-full", bar.cls)}
                                style={{ width: `${Math.min(100, bar.v)}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-crm-fg tabular-nums">
                              {Math.round(bar.v)}%
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-crm-soft tabular-nums">
                          {money.format(p.spent)} / {money.format(p.budget)}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            h === "late" ? "text-crm-danger" : "text-crm-soft",
                          )}
                        >
                          <CalendarClock className="size-3" aria-hidden />
                          {dateFmt.format(new Date(`${p.dueDate}T00:00:00`))}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <AvatarGroup people={p.team.map((name) => ({ name }))} max={4} size="md" />
                        {ms.length ? (
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-controls={`${p.id}-ms`}
                            onClick={() => setExpanded(open ? null : p.id)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs text-crm-soft hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
                          >
                            {ms.filter((m) => m.done).length}/{ms.length} milestones
                            <ChevronDown
                              className={cn("size-3 transition-transform", open && "rotate-180")}
                              aria-hidden
                            />
                          </button>
                        ) : null}
                      </div>
                      {next && !open ? (
                        <p className="truncate text-xs text-crm-subtle">Next: {next.name}</p>
                      ) : null}
                      {open ? (
                        <ul
                          id={`${p.id}-ms`}
                          className="flex flex-col gap-1 border-t border-crm-border pt-2"
                        >
                          {ms.map((m) => {
                            const overdue =
                              !m.done &&
                              new Date(`${m.due}T00:00:00`).getTime() < startOfDay(today);
                            return (
                              <li
                                key={m.name}
                                className="flex items-center justify-between text-xs"
                              >
                                <span
                                  className={cn(
                                    m.done ? "text-crm-subtle line-through" : "text-crm-fg",
                                  )}
                                >
                                  {m.name}
                                </span>
                                <span
                                  className={cn(
                                    "tabular-nums",
                                    overdue ? "text-crm-danger" : "text-crm-soft",
                                  )}
                                >
                                  {overdue ? "Overdue · " : ""}
                                  {dateFmt.format(new Date(`${m.due}T00:00:00`))}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
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
