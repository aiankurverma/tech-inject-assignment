import * as React from "react";
import { AlertTriangle, CalendarDays, Clock, UserMinus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { Progress } from "@/components/crm/progress";
import { SearchInput } from "@/components/crm/search-input";
import { Tag } from "@/components/crm/tag";

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface Volunteer {
  id: string;
  name: string;
  skills: string[];
  availability: Weekday[];
  hoursYtd: number;
  /** ISO expiry of the background check; missing = never done. */
  backgroundCheckExpires?: string;
}

export interface VolunteerShift {
  id: string;
  role: string;
  location: string;
  /** ISO date. */
  date: string;
  startHour: number;
  hours: number;
  capacity: number;
  requiredSkill?: string;
  /** Requires a valid background check (e.g. youth programs). */
  requiresCheck?: boolean;
  volunteerIds: string[];
}

export interface NpVolunteersProps {
  volunteers: Volunteer[];
  shifts: VolunteerShift[];
  now?: Date;
  onShiftsChange?: (shifts: VolunteerShift[]) => void;
  className?: string;
}

const weekdayOf = (iso: string): Weekday =>
  (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const)[
    new Date(`${iso}T12:00:00`).getDay()
  ] ?? "Mon";

/** Returns the reasons a volunteer cannot (or should not) take a shift. Empty = eligible. */
export function eligibility(v: Volunteer, s: VolunteerShift, all: VolunteerShift[], now: Date) {
  const issues: { level: "block" | "warn"; text: string }[] = [];
  if (s.requiresCheck) {
    if (!v.backgroundCheckExpires) issues.push({ level: "block", text: "No background check" });
    else if (new Date(v.backgroundCheckExpires) < new Date(s.date))
      issues.push({ level: "block", text: "Background check expires before shift" });
  }
  if (s.requiredSkill && !v.skills.includes(s.requiredSkill))
    issues.push({ level: "warn", text: `Missing ${s.requiredSkill}` });
  if (!v.availability.includes(weekdayOf(s.date)))
    issues.push({ level: "warn", text: `Not usually free on ${weekdayOf(s.date)}` });
  const clash = all.find(
    (o) =>
      o.id !== s.id &&
      o.date === s.date &&
      o.volunteerIds.includes(v.id) &&
      o.startHour < s.startHour + s.hours &&
      s.startHour < o.startHour + o.hours,
  );
  if (clash) issues.push({ level: "block", text: `Double-booked with ${clash.role}` });
  if (new Date(`${s.date}T23:59:59`) < now)
    issues.push({ level: "block", text: "Shift is in the past" });
  return issues;
}

const hh = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;

/** Volunteer scheduling: shift fill rates, eligibility checks (background, skills, clashes) and roster hours. */
export function NpVolunteers({
  volunteers,
  shifts,
  now,
  onShiftsChange,
  className,
}: NpVolunteersProps) {
  const ref = React.useMemo(() => now ?? new Date(), [now]);
  const [items, setItems] = React.useState(shifts);
  React.useEffect(() => setItems(shifts), [shifts]);
  const [shiftId, setShiftId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("");

  const sorted = [...items].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour,
  );
  const shift = items.find((s) => s.id === shiftId) ?? sorted[0] ?? null;
  const byId = new Map(volunteers.map((v) => [v.id, v]));

  const update = (next: VolunteerShift[], msg: string) => {
    setItems(next);
    setStatus(msg);
    onShiftsChange?.(next);
  };
  const add = (v: Volunteer) => {
    if (!shift) return;
    update(
      items.map((s) => (s.id === shift.id ? { ...s, volunteerIds: [...s.volunteerIds, v.id] } : s)),
      `${v.name} added to ${shift.role}`,
    );
  };
  const remove = (v: Volunteer) => {
    if (!shift) return;
    update(
      items.map((s) =>
        s.id === shift.id ? { ...s, volunteerIds: s.volunteerIds.filter((x) => x !== v.id) } : s,
      ),
      `${v.name} removed from ${shift.role}`,
    );
  };

  const scheduledHours = (v: Volunteer) =>
    items.filter((s) => s.volunteerIds.includes(v.id)).reduce((t, s) => t + s.hours, 0);

  const candidates = shift
    ? volunteers
        .filter((v) => !shift.volunteerIds.includes(v.id))
        .filter((v) => {
          const q = query.trim().toLowerCase();
          return (
            !q ||
            v.name.toLowerCase().includes(q) ||
            v.skills.some((s) => s.toLowerCase().includes(q))
          );
        })
        .map((v) => ({ v, issues: eligibility(v, shift, items, ref) }))
        .sort(
          (a, b) =>
            a.issues.filter((i) => i.level === "block").length -
              b.issues.filter((i) => i.level === "block").length ||
            a.issues.length - b.issues.length ||
            scheduledHours(a.v) - scheduledHours(b.v),
        )
    : [];

  const open = items.reduce((n, s) => n + Math.max(0, s.capacity - s.volunteerIds.length), 0);

  return (
    <section
      aria-label="Volunteer scheduling"
      className={cn(
        "flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 font-crm shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-col">
        <span className="crm-eyebrow">Volunteers</span>
        <span className="text-xs text-crm-subtle">
          {items.length} shifts · {open} open spots · {volunteers.length} volunteers
        </span>
      </header>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-crm border border-dashed border-crm-border py-10 text-center">
          <CalendarDays className="size-5 text-crm-subtle" aria-hidden />
          <p className="text-xs text-crm-subtle">No shifts scheduled yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <ul className="flex flex-col gap-1.5" aria-label="Shifts">
            {sorted.map((s) => {
              const filled = s.volunteerIds.length;
              const active = shift?.id === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setShiftId(s.id)}
                    className={cn(
                      "flex w-full flex-col gap-1.5 rounded-crm border px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-crm-primary",
                      active
                        ? "border-crm-primary/60 bg-crm-raised"
                        : "border-crm-border hover:bg-crm-raised",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm text-crm-fg">{s.role}</span>
                      {s.requiresCheck ? (
                        <Tag size="sm" color="purple">
                          Check req.
                        </Tag>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-crm-subtle">
                      <Clock className="size-3" aria-hidden />
                      {weekdayOf(s.date)} {s.date} · {hh(s.startHour)}–{hh(s.startHour + s.hours)} ·{" "}
                      {s.location}
                    </span>
                    <Progress
                      value={filled}
                      max={s.capacity}
                      size="sm"
                      tone={
                        filled >= s.capacity
                          ? "success"
                          : filled / s.capacity < 0.5
                            ? "danger"
                            : "warning"
                      }
                      label={`${filled}/${s.capacity} filled`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>

          {shift ? (
            <div className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-raised p-3">
              <div className="flex flex-col gap-1.5">
                <span className="crm-caption text-crm-soft">
                  Signed up for {shift.role} ({shift.volunteerIds.length}/{shift.capacity})
                </span>
                {shift.volunteerIds.length === 0 ? (
                  <p className="text-xs text-crm-subtle">Nobody yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {shift.volunteerIds.map((id) => {
                      const v = byId.get(id);
                      if (!v) return null;
                      return (
                        <li key={id} className="flex items-center gap-2 text-xs">
                          <Avatar name={v.name} size="sm" />
                          <span className="flex-1 text-crm-fg">{v.name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => remove(v)}
                            aria-label={`Remove ${v.name}`}
                          >
                            <UserMinus aria-hidden />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="flex flex-col gap-2 border-t border-crm-border pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="crm-caption text-crm-soft">Suggested volunteers</span>
                  <SearchInput
                    size="sm"
                    className="w-full sm:w-48"
                    placeholder="Name or skill"
                    aria-label="Search volunteers"
                    value={query}
                    onValueChange={setQuery}
                  />
                </div>
                <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                  {candidates.map(({ v, issues }) => {
                    const blocked = issues.some((i) => i.level === "block");
                    const full = shift.volunteerIds.length >= shift.capacity;
                    return (
                      <li
                        key={v.id}
                        className="flex items-center gap-2 rounded-crm px-1 py-1 text-xs"
                      >
                        <Avatar name={v.name} size="md" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-crm-fg">
                            {v.name}{" "}
                            <span className="text-crm-subtle tabular-nums">
                              · {v.hoursYtd + scheduledHours(v)}h YTD
                            </span>
                          </span>
                          {issues.length ? (
                            <span
                              className={cn(
                                "flex items-center gap-1 truncate",
                                blocked ? "text-crm-danger" : "text-crm-warning",
                              )}
                            >
                              <AlertTriangle className="size-3 shrink-0" aria-hidden />
                              {issues.map((i) => i.text).join(" · ")}
                            </span>
                          ) : (
                            <span className="truncate text-crm-success">
                              Good match · {v.skills.join(", ")}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={blocked || full}
                          onClick={() => add(v)}
                          aria-label={`Add ${v.name} to shift`}
                          title={full ? "Shift is full" : undefined}
                        >
                          <UserPlus aria-hidden />
                          Add
                        </Button>
                      </li>
                    );
                  })}
                  {candidates.length === 0 ? (
                    <li className="py-4 text-center text-xs text-crm-subtle">
                      No matching volunteers.
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
