import * as React from "react";
import { AlertTriangle, GripVertical, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";

export interface DispatchTech {
  id: string;
  name: string;
  skills: string[];
  /** Shift start/end hour (24h). */
  shiftStart: number;
  shiftEnd: number;
}

export interface DispatchJob {
  id: string;
  title: string;
  customer: string;
  /** Skill required to perform the job. */
  skill: string;
  durationMin: number;
  priority: "emergency" | "high" | "normal";
  /** Assigned technician + start hour (decimal, e.g. 9.5 = 09:30). */
  technicianId?: string;
  start?: number;
}

export interface FsDispatchProps {
  technicians: DispatchTech[];
  jobs: DispatchJob[];
  /** Board hours, inclusive start / exclusive end. */
  dayStart?: number;
  dayEnd?: number;
  /** Snap granularity in minutes. */
  snapMin?: 15 | 30 | 60;
  onChange?: (jobs: DispatchJob[]) => void;
  className?: string;
}

const prioBar: Record<DispatchJob["priority"], string> = {
  emergency: "border-l-crm-danger",
  high: "border-l-crm-warning",
  normal: "border-l-crm-primary",
};

const offShiftBg =
  "repeating-linear-gradient(135deg, transparent 0 6px, var(--color-crm-border) 6px 7px)";

/** Assigns each job a sub-row so overlapping jobs on one technician stack instead of covering each other. */
function jobRows(lane: DispatchJob[], fallback: number) {
  const sorted = [...lane].sort((a, b) => (a.start ?? fallback) - (b.start ?? fallback));
  const ends: number[] = [];
  const row = new Map<string, number>();
  for (const j of sorted) {
    const st = j.start ?? fallback;
    let r = ends.findIndex((e) => e <= st);
    if (r < 0) r = ends.length;
    ends[r] = st + j.durationMin / 60;
    row.set(j.id, r);
  }
  return { row, count: Math.max(1, ends.length) };
}

const fmtHour = (h: number) =>
  `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

/** Returns ids of jobs that overlap another job on the same technician. */
export function findConflicts(jobs: DispatchJob[]) {
  const out = new Set<string>();
  const placed = jobs.filter((j) => j.technicianId && j.start !== undefined);
  for (const a of placed)
    for (const b of placed) {
      if (a.id === b.id || a.technicianId !== b.technicianId) continue;
      const aEnd = (a.start ?? 0) + a.durationMin / 60;
      const bEnd = (b.start ?? 0) + b.durationMin / 60;
      if ((a.start ?? 0) < bEnd && (b.start ?? 0) < aEnd) out.add(a.id);
    }
  return out;
}

/** Drag-and-drop dispatch board: technician lanes on an hourly timeline with conflict + skill checks. */
export function FsDispatch({
  technicians,
  jobs,
  dayStart = 7,
  dayEnd = 19,
  snapMin = 30,
  onChange,
  className,
}: FsDispatchProps) {
  const [items, setItems] = React.useState(jobs);
  React.useEffect(() => setItems(jobs), [jobs]);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [overLane, setOverLane] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<DispatchJob[][]>([]);
  const [announce, setAnnounce] = React.useState("");
  const hours = dayEnd - dayStart;
  const conflicts = React.useMemo(() => findConflicts(items), [items]);
  const queue = items
    .filter((j) => !j.technicianId)
    .sort(
      (a, b) =>
        ["emergency", "high", "normal"].indexOf(a.priority) -
        ["emergency", "high", "normal"].indexOf(b.priority),
    );

  const commit = (nextItems: DispatchJob[], msg: string) => {
    setHistory((h) => [...h.slice(-19), items]);
    setItems(nextItems);
    setAnnounce(msg);
    onChange?.(nextItems);
  };

  const place = (jobId: string, techId: string | null, start?: number) => {
    const job = items.find((j) => j.id === jobId);
    if (!job) return;
    const tech = technicians.find((t) => t.id === techId);
    let s = start;
    if (tech && s === undefined) {
      // Keyboard placement: first free slot inside the tech's shift.
      const lane = items.filter((j) => j.technicianId === tech.id && j.id !== jobId);
      for (let h = tech.shiftStart; h + job.durationMin / 60 <= tech.shiftEnd; h += snapMin / 60) {
        const end = h + job.durationMin / 60;
        if (lane.every((o) => end <= (o.start ?? 0) || h >= (o.start ?? 0) + o.durationMin / 60)) {
          s = h;
          break;
        }
      }
      s ??= tech.shiftStart;
    }
    if (s !== undefined) s = Math.max(dayStart, Math.min(dayEnd - job.durationMin / 60, s));
    commit(
      items.map((j) =>
        j.id === jobId ? { ...j, technicianId: tech?.id, start: tech ? s : undefined } : j,
      ),
      tech ? `${job.id} scheduled for ${tech.name} at ${fmtHour(s ?? 0)}` : `${job.id} unassigned`,
    );
    setPicked(null);
  };

  const onLaneDrop = (e: React.DragEvent<HTMLDivElement>, techId: string) => {
    e.preventDefault();
    setOverLane(null);
    const id = e.dataTransfer.getData("text/plain");
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = dayStart + ((e.clientX - rect.left) / rect.width) * hours;
    const step = snapMin / 60;
    place(id, techId, Math.round(raw / step) * step);
  };

  const drag = (id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
    },
  });

  return (
    <section
      aria-label="Dispatch board"
      className={cn(
        "flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 font-crm shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="crm-eyebrow">Dispatch</span>
          <span className="text-xs text-crm-subtle">
            Drag jobs onto a lane, or select a job and press a technician&apos;s “Place” button.
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {conflicts.size > 0 ? (
            <span className="inline-flex items-center gap-1 text-crm-danger">
              <AlertTriangle className="size-3.5" aria-hidden />
              {conflicts.size} overlapping
            </span>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            disabled={history.length === 0}
            onClick={() => {
              const prev = history[history.length - 1];
              if (!prev) return;
              setHistory((h) => h.slice(0, -1));
              setItems(prev);
              onChange?.(prev);
              setAnnounce("Undone");
            }}
          >
            <Undo2 aria-hidden />
            Undo
          </Button>
        </div>
      </header>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <div className="grid gap-3">
        <div
          className="flex flex-wrap items-start gap-1.5 rounded-crm border border-dashed border-crm-border p-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            place(e.dataTransfer.getData("text/plain"), null);
          }}
          aria-label="Unassigned queue"
          role="group"
        >
          <span className="crm-caption w-full px-1 text-crm-soft">Unassigned · {queue.length}</span>
          {queue.length === 0 ? (
            <p className="px-1 py-4 text-center text-xs text-crm-subtle">All jobs dispatched.</p>
          ) : (
            queue.map((j) => (
              <button
                key={j.id}
                type="button"
                {...drag(j.id)}
                aria-pressed={picked === j.id}
                onClick={() => setPicked(picked === j.id ? null : j.id)}
                className={cn(
                  "flex cursor-grab items-start gap-1.5 rounded-crm border border-l-4 border-crm-border bg-crm-raised px-2 py-1.5 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-primary",
                  prioBar[j.priority],
                  picked === j.id && "ring-2 ring-crm-primary",
                )}
              >
                <GripVertical className="mt-0.5 size-3 shrink-0 text-crm-subtle" aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="line-clamp-2 font-medium break-words text-crm-fg">
                    {j.title}
                  </span>
                  <span className="text-crm-subtle">
                    {j.id} · {j.skill} · {j.durationMin}m
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            <div className="ml-[180px] flex text-[11px] text-crm-subtle" aria-hidden>
              {Array.from({ length: hours }, (_, i) => (
                <span key={i} className="flex-1 border-l border-crm-border pl-1">
                  {fmtHour(dayStart + i)}
                </span>
              ))}
            </div>
            {technicians.map((t) => {
              const lane = items.filter((j) => j.technicianId === t.id);
              const rows = jobRows(lane, t.shiftStart);
              const booked = lane.reduce((s, j) => s + j.durationMin, 0);
              const capacity = (t.shiftEnd - t.shiftStart) * 60;
              const pickedJob = items.find((j) => j.id === picked);
              const skillMiss = pickedJob && !t.skills.includes(pickedJob.skill);
              return (
                <div key={t.id} className="flex items-stretch border-t border-crm-border">
                  <div className="flex w-[180px] shrink-0 items-center gap-2 py-2 pr-2">
                    <Avatar name={t.name} size="md" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-xs text-crm-fg">{t.name}</span>
                      <span
                        className={cn(
                          "text-[11px] tabular-nums",
                          booked > capacity ? "text-crm-danger" : "text-crm-subtle",
                        )}
                      >
                        {Math.round((booked / capacity) * 100)}% booked
                      </span>
                    </div>
                    {picked ? (
                      <Button
                        size="sm"
                        variant={skillMiss ? "ghost" : "secondary"}
                        onClick={() => place(picked, t.id)}
                        aria-label={`Place selected job with ${t.name}${skillMiss ? " (missing skill)" : ""}`}
                      >
                        Place
                      </Button>
                    ) : null}
                  </div>
                  <div
                    role="group"
                    aria-label={`${t.name} schedule`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOverLane(t.id);
                    }}
                    onDragLeave={() => setOverLane(null)}
                    onDrop={(e) => onLaneDrop(e, t.id)}
                    className={cn("relative flex-1", overLane === t.id && "bg-crm-primary/10")}
                    style={{ height: rows.count * 52 + 4 }}
                  >
                    {Math.max(0, t.shiftStart - dayStart) > 0 ? (
                      <span
                        aria-hidden
                        title="Off shift"
                        className="absolute inset-y-0 left-0 flex items-center justify-center overflow-hidden text-[10px] text-crm-subtle"
                        style={{
                          width: `${(Math.max(0, t.shiftStart - dayStart) / hours) * 100}%`,
                          backgroundImage: offShiftBg,
                        }}
                      >
                        {Math.max(0, t.shiftStart - dayStart) >= 1 ? "Off shift" : null}
                      </span>
                    ) : null}
                    {Math.max(0, dayEnd - t.shiftEnd) > 0 ? (
                      <span
                        aria-hidden
                        title="Off shift"
                        className="absolute inset-y-0 right-0 flex items-center justify-center overflow-hidden text-[10px] text-crm-subtle"
                        style={{
                          width: `${(Math.max(0, dayEnd - t.shiftEnd) / hours) * 100}%`,
                          backgroundImage: offShiftBg,
                        }}
                      >
                        {Math.max(0, dayEnd - t.shiftEnd) >= 1 ? "Off shift" : null}
                      </span>
                    ) : null}
                    {lane.map((j) => {
                      const s = j.start ?? t.shiftStart;
                      const bad = conflicts.has(j.id);
                      const noSkill = !t.skills.includes(j.skill);
                      return (
                        <button
                          key={j.id}
                          type="button"
                          {...drag(j.id)}
                          onClick={() => setPicked(picked === j.id ? null : j.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Delete" || e.key === "Backspace") place(j.id, null);
                            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                              e.preventDefault();
                              place(
                                j.id,
                                t.id,
                                s + ((e.key === "ArrowRight" ? 1 : -1) * snapMin) / 60,
                              );
                            }
                          }}
                          title={`${j.title} · ${fmtHour(s)}–${fmtHour(s + j.durationMin / 60)}${noSkill ? " · missing skill " + j.skill : ""}`}
                          aria-label={`${j.id} ${j.title}, ${fmtHour(s)} to ${fmtHour(s + j.durationMin / 60)}${bad ? ", overlaps another job" : ""}${noSkill ? ", technician lacks " + j.skill : ""}. Arrow keys move, Delete unassigns.`}
                          className={cn(
                            "absolute flex h-[46px] cursor-grab flex-col justify-center overflow-hidden rounded-crm border border-l-4 bg-crm-raised px-1.5 text-left text-[11px] leading-tight outline-none focus-visible:ring-2 focus-visible:ring-crm-primary",
                            prioBar[j.priority],
                            bad ? "border-crm-danger" : "border-crm-border",
                            picked === j.id && "ring-2 ring-crm-primary",
                          )}
                          style={{
                            top: 4 + (rows.row.get(j.id) ?? 0) * 52,
                            left: `${((s - dayStart) / hours) * 100}%`,
                            width: `${(j.durationMin / 60 / hours) * 100}%`,
                          }}
                        >
                          <span className="line-clamp-2 font-medium break-words text-crm-fg">
                            {j.title}
                          </span>
                          <span
                            className={cn(
                              "truncate",
                              noSkill ? "text-crm-warning" : "text-crm-subtle",
                            )}
                          >
                            {fmtHour(s)} · {j.customer}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
