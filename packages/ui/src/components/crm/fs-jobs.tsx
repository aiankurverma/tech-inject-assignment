import * as React from "react";
import { AlarmClock, MapPin, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export type JobStatus = "new" | "scheduled" | "en_route" | "on_site" | "completed" | "on_hold";
export type JobPriority = "emergency" | "high" | "normal" | "low";

export interface FieldJob {
  id: string;
  title: string;
  customer: string;
  address: string;
  type: string;
  priority: JobPriority;
  status: JobStatus;
  /** ISO timestamp the job was logged. */
  createdAt: string;
  /** Technician id, if assigned. */
  technicianId?: string;
  /** Estimated duration in minutes. */
  estimateMin: number;
}

export interface FieldTechOption {
  id: string;
  name: string;
}

export interface FsJobsProps {
  jobs: FieldJob[];
  technicians: FieldTechOption[];
  /** SLA response targets in hours per priority. */
  slaHours?: Partial<Record<JobPriority, number>>;
  now?: Date;
  onAssign?: (jobIds: string[], technicianId: string) => void;
  onStatusChange?: (jobId: string, status: JobStatus) => void;
  loading?: boolean;
  className?: string;
}

const statusMeta: Record<JobStatus, { label: string; color: TagColor }> = {
  new: { label: "New", color: "neutral" },
  scheduled: { label: "Scheduled", color: "blue" },
  en_route: { label: "En route", color: "purple" },
  on_site: { label: "On site", color: "teal" },
  completed: { label: "Completed", color: "green" },
  on_hold: { label: "On hold", color: "amber" },
};
const priorityMeta: Record<JobPriority, { label: string; color: TagColor; rank: number }> = {
  emergency: { label: "Emergency", color: "red", rank: 0 },
  high: { label: "High", color: "orange", rank: 1 },
  normal: { label: "Normal", color: "neutral", rank: 2 },
  low: { label: "Low", color: "moss", rank: 3 },
};
const flow: JobStatus[] = ["new", "scheduled", "en_route", "on_site", "completed"];
const DEFAULT_SLA: Record<JobPriority, number> = { emergency: 4, high: 24, normal: 72, low: 168 };

/** Remaining SLA time in minutes (negative when breached). */
export function slaRemaining(job: FieldJob, now: number, sla: Record<JobPriority, number>) {
  const due = new Date(job.createdAt).getTime() + sla[job.priority] * 3_600_000;
  return Math.round((due - now) / 60_000);
}

function fmtDuration(min: number) {
  const a = Math.abs(min);
  if (a < 60) return `${a}m`;
  if (a < 60 * 48) return `${Math.floor(a / 60)}h ${a % 60}m`;
  return `${Math.floor(a / 1440)}d ${Math.floor((a % 1440) / 60)}h`;
}

/** Field-service work-order queue with SLA countdowns, filters and bulk technician assignment. */
export function FsJobs({
  jobs,
  technicians,
  slaHours,
  now,
  onAssign,
  onStatusChange,
  loading,
  className,
}: FsJobsProps) {
  const sla = { ...DEFAULT_SLA, ...slaHours };
  const [rows, setRows] = React.useState(jobs);
  React.useEffect(() => setRows(jobs), [jobs]);
  const [view, setView] = React.useState<"open" | "unassigned" | "breaching" | "completed">("open");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [assignee, setAssignee] = React.useState("");
  const [tick, setTick] = React.useState(() => (now ?? new Date()).getTime());
  React.useEffect(() => {
    if (now) {
      setTick(now.getTime());
      return;
    }
    const t = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [now]);

  const techName = (id?: string) => technicians.find((t) => t.id === id)?.name;
  const open = (j: FieldJob) => j.status !== "completed";
  const atRisk = (j: FieldJob) => open(j) && slaRemaining(j, tick, sla) < 120;

  const counts = {
    open: rows.filter(open).length,
    unassigned: rows.filter((j) => open(j) && !j.technicianId).length,
    breaching: rows.filter(atRisk).length,
    completed: rows.filter((j) => !open(j)).length,
  };

  const visible = rows
    .filter((j) =>
      view === "open"
        ? open(j)
        : view === "unassigned"
          ? open(j) && !j.technicianId
          : view === "breaching"
            ? atRisk(j)
            : !open(j),
    )
    .filter((j) => {
      const q = query.trim().toLowerCase();
      return (
        !q ||
        [j.id, j.title, j.customer, j.address, j.type, techName(j.technicianId) ?? ""].some((v) =>
          v.toLowerCase().includes(q),
        )
      );
    })
    .sort(
      (a, b) =>
        priorityMeta[a.priority].rank - priorityMeta[b.priority].rank ||
        slaRemaining(a, tick, sla) - slaRemaining(b, tick, sla),
    );

  const allChecked = visible.length > 0 && visible.every((j) => selected.has(j.id));
  const someChecked = visible.some((j) => selected.has(j.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const assign = () => {
    if (!assignee || selected.size === 0) return;
    const ids = [...selected];
    setRows((prev) =>
      prev.map((j) =>
        selected.has(j.id)
          ? { ...j, technicianId: assignee, status: j.status === "new" ? "scheduled" : j.status }
          : j,
      ),
    );
    onAssign?.(ids, assignee);
    setSelected(new Set());
  };

  const advance = (j: FieldJob) => {
    const i = flow.indexOf(j.status);
    const to = j.status === "on_hold" ? "scheduled" : flow[i + 1];
    if (!to) return;
    setRows((prev) => prev.map((x) => (x.id === j.id ? { ...x, status: to } : x)));
    onStatusChange?.(j.id, to);
  };

  return (
    <section
      aria-label="Work orders"
      className={cn(
        "flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 font-crm shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="crm-eyebrow">Work orders</span>
        <SearchInput
          size="sm"
          className="w-full sm:w-64"
          placeholder="Job, customer, address, tech"
          aria-label="Search jobs"
          value={query}
          onValueChange={setQuery}
        />
      </header>
      <div className="overflow-x-auto">
        <SegmentedControl
          size="sm"
          label="Job view"
          value={view}
          onValueChange={(v) => {
            setView(v as typeof view);
            setSelected(new Set());
          }}
          options={[
            { value: "open", label: "Open", count: counts.open },
            { value: "unassigned", label: "Unassigned", count: counts.unassigned },
            { value: "breaching", label: "SLA at risk", count: counts.breaching },
            { value: "completed", label: "Completed", count: counts.completed },
          ]}
        />
      </div>

      {selected.size > 0 ? (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 rounded-crm border border-crm-primary/40 bg-crm-raised px-3 py-2 text-xs"
        >
          <span className="text-crm-fg">{selected.size} selected</span>
          <select
            aria-label="Technician"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="h-7 rounded-crm border border-crm-border bg-crm-card px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-primary"
          >
            <option value="">Choose technician…</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="primary" disabled={!assignee} onClick={assign}>
            Assign
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading jobs">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-crm bg-crm-muted" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-crm border border-dashed border-crm-border py-10 text-center">
          <Wrench className="size-5 text-crm-subtle" aria-hidden />
          <p className="text-sm text-crm-fg">Nothing here</p>
          <p className="text-xs text-crm-subtle">No jobs match this view.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="text-left text-crm-subtle">
                <th scope="col" className="w-8 py-1.5">
                  <Checkbox
                    aria-label="Select all visible jobs"
                    checked={allChecked ? true : someChecked ? "indeterminate" : false}
                    onCheckedChange={() =>
                      setSelected(allChecked ? new Set() : new Set(visible.map((j) => j.id)))
                    }
                  />
                </th>
                <th scope="col" className="py-1.5 font-normal">
                  Job
                </th>
                <th scope="col" className="py-1.5 font-normal">
                  Priority
                </th>
                <th scope="col" className="py-1.5 font-normal">
                  Status
                </th>
                <th scope="col" className="py-1.5 font-normal">
                  Technician
                </th>
                <th scope="col" className="py-1.5 text-right font-normal">
                  SLA
                </th>
                <th scope="col" className="py-1.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((j) => {
                const rem = slaRemaining(j, tick, sla);
                const nextStatus =
                  j.status === "on_hold" ? "scheduled" : flow[flow.indexOf(j.status) + 1];
                return (
                  <tr
                    key={j.id}
                    className={cn(
                      "border-t border-crm-border align-middle",
                      selected.has(j.id) && "bg-crm-raised",
                    )}
                  >
                    <td className="py-2">
                      <Checkbox
                        aria-label={`Select ${j.id}`}
                        checked={selected.has(j.id)}
                        onCheckedChange={() => toggle(j.id)}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <div className="text-sm text-crm-fg">
                        <span className="text-crm-subtle">{j.id}</span> {j.title}
                      </div>
                      <div className="flex items-center gap-1 text-crm-subtle">
                        <MapPin className="size-3" aria-hidden />
                        <span className="truncate">
                          {j.customer} · {j.address} · ~{fmtDuration(j.estimateMin)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2">
                      <Tag size="sm" color={priorityMeta[j.priority].color}>
                        {priorityMeta[j.priority].label}
                      </Tag>
                    </td>
                    <td className="py-2">
                      <Tag size="sm" color={statusMeta[j.status].color}>
                        {statusMeta[j.status].label}
                      </Tag>
                    </td>
                    <td className="py-2 text-crm-soft">
                      {techName(j.technicianId) ?? (
                        <span className="text-crm-warning">Unassigned</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {j.status === "completed" ? (
                        <span className="text-crm-subtle">—</span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            rem < 0
                              ? "text-crm-danger"
                              : rem < 120
                                ? "text-crm-warning"
                                : "text-crm-soft",
                          )}
                        >
                          <AlarmClock className="size-3" aria-hidden />
                          {rem < 0 ? `${fmtDuration(rem)} over` : `${fmtDuration(rem)} left`}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {nextStatus ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!j.technicianId && nextStatus !== "scheduled"}
                          onClick={() => advance(j)}
                        >
                          {statusMeta[nextStatus].label}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
