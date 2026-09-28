import * as React from "react";
import { AlertTriangle, BookOpen, Lock, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Card } from "@/components/crm/card";
import { Checkbox } from "@/components/crm/checkbox";
import { EmptyState } from "@/components/crm/feedback";
import { Progress } from "@/components/crm/progress";
import { SearchInput } from "@/components/crm/search-input";
import { Tag } from "@/components/crm/tag";

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
export const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export interface CourseSection {
  id: string;
  code: string;
  title: string;
  credits: number;
  instructor: string;
  days: Weekday[];
  /** "HH:MM" 24h. */
  start: string;
  end: string;
  room?: string;
  capacity: number;
  enrolled: number;
  waitlist?: number;
  /** Course codes that must already be completed. */
  prerequisites?: string[];
  department?: string;
}

export interface EduCoursesProps {
  sections: CourseSection[];
  /** Course codes the student has completed. */
  completed?: string[];
  /** Controlled list of section ids in the cart. */
  cart?: string[];
  defaultCart?: string[];
  onCartChange?: (ids: string[]) => void;
  minCredits?: number;
  maxCredits?: number;
  onRegister?: (sections: CourseSection[]) => void;
  className?: string;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const fmt = (t: string) => {
  const m = toMin(t);
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")}${h < 12 ? "a" : "p"}`;
};

/** Pairs of sections in the list whose meeting times overlap on a shared day. */
export function scheduleConflicts(list: CourseSection[]) {
  const pairs: [CourseSection, CourseSection][] = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      if (!a.days.some((d) => b.days.includes(d))) continue;
      if (toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end)) pairs.push([a, b]);
    }
  return pairs;
}

const GRID_START = 8 * 60;
const GRID_END = 20 * 60;
const PX_PER_MIN = 0.6;

/** Course registration: searchable catalog with seats/waitlist and prerequisite locks, plus a weekly schedule builder with conflict and credit-load checks. */
/** Assigns overlapping sections to side-by-side lanes within one day column. */
function layoutDay(list: CourseSection[]) {
  const sorted = [...list].sort((a, b) => toMin(a.start) - toMin(b.start));
  const out: { s: CourseSection; lane: number; lanes: number }[] = [];
  let group: { s: CourseSection; lane: number; lanes: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const flush = () => {
    group.forEach((g) => (g.lanes = laneEnds.length));
    out.push(...group);
    group = [];
    laneEnds = [];
  };
  for (const s of sorted) {
    const start = toMin(s.start);
    if (start >= groupEnd && group.length) flush();
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = toMin(s.end);
    groupEnd = Math.max(start >= groupEnd ? 0 : groupEnd, toMin(s.end));
    group.push({ s, lane, lanes: 1 });
  }
  flush();
  return out;
}

export function EduCourses({
  sections,
  completed = [],
  cart: cartProp,
  defaultCart = [],
  onCartChange,
  minCredits = 12,
  maxCredits = 18,
  onRegister,
  className,
}: EduCoursesProps) {
  const [inner, setInner] = React.useState(defaultCart);
  const cart = cartProp ?? inner;
  const setCart = (ids: string[]) => {
    if (cartProp === undefined) setInner(ids);
    onCartChange?.(ids);
  };
  const [query, setQuery] = React.useState("");
  const [openOnly, setOpenOnly] = React.useState(false);
  const done = new Set(completed.map((c) => c.toUpperCase()));

  const inCart = sections.filter((s) => cart.includes(s.id));
  const credits = inCart.reduce((s, c) => s + c.credits, 0);
  const conflicts = scheduleConflicts(inCart);
  const conflictIds = new Set(conflicts.flatMap(([a, b]) => [a.id, b.id]));
  const dupCodes = inCart.filter((s, i) => inCart.findIndex((x) => x.code === s.code) !== i);

  const q = query.trim().toLowerCase();
  const catalog = sections.filter((s) => {
    if (openOnly && s.enrolled >= s.capacity) return false;
    return !q || `${s.code} ${s.title} ${s.instructor}`.toLowerCase().includes(q);
  });

  const missingPrereq = (s: CourseSection) =>
    (s.prerequisites ?? []).filter((p) => !done.has(p.toUpperCase()));

  const toggle = (s: CourseSection) =>
    setCart(cart.includes(s.id) ? cart.filter((id) => id !== s.id) : [...cart, s.id]);

  const blockers = [
    conflicts.length ? `${conflicts.length} time conflict${conflicts.length > 1 ? "s" : ""}` : null,
    credits > maxCredits ? `Over ${maxCredits}-credit limit` : null,
    credits < minCredits ? `Below ${minCredits} credits for full-time` : null,
    dupCodes.length ? `Duplicate course ${dupCodes[0]!.code}` : null,
  ].filter(Boolean) as string[];
  const hardBlock =
    conflicts.length > 0 || credits > maxCredits || dupCodes.length > 0 || inCart.length === 0;

  return (
    <div
      className={cn(
        "grid gap-3 font-crm text-crm-fg xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]",
        className,
      )}
    >
      <Card className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3">
          <h2 className="text-sm font-medium">Catalog</h2>
          <label className="flex items-center gap-1.5 text-xs text-crm-muted-fg">
            <Checkbox checked={openOnly} onCheckedChange={(c) => setOpenOnly(c === true)} />
            Open seats only
          </label>
          <SearchInput
            size="sm"
            className="ml-auto w-full sm:w-52"
            placeholder="Code, title, instructor"
            value={query}
            onValueChange={setQuery}
            aria-label="Search courses"
          />
        </div>
        {catalog.length === 0 ? (
          <EmptyState icon={<BookOpen />} title="No sections match" />
        ) : (
          <ul className="flex flex-col pb-1">
            {catalog.map((s) => {
              const full = s.enrolled >= s.capacity;
              const missing = missingPrereq(s);
              const added = cart.includes(s.id);
              const locked = missing.length > 0 && !added;
              return (
                <li
                  key={s.id}
                  className="flex items-start gap-3 border-t border-crm-border px-3 py-2.5 first:border-t-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium tabular-nums">{s.code}</span>
                      <span className="truncate text-sm">{s.title}</span>
                      <Tag size="sm">{s.credits} cr</Tag>
                    </div>
                    <div className="mt-0.5 text-xs text-crm-muted-fg">
                      {s.days.join("/")} {fmt(s.start)}–{fmt(s.end)} · {s.instructor}
                      {s.room ? ` · ${s.room}` : ""}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <Progress
                        className="w-24"
                        size="sm"
                        value={Math.min(100, (s.enrolled / s.capacity) * 100)}
                        tone={
                          full ? "danger" : s.enrolled / s.capacity > 0.85 ? "warning" : "success"
                        }
                      />
                      <span
                        className={cn(
                          "tabular-nums",
                          full ? "text-crm-danger" : "text-crm-muted-fg",
                        )}
                      >
                        {full
                          ? `Full · ${s.waitlist ?? 0} waitlisted`
                          : `${s.capacity - s.enrolled} of ${s.capacity} seats`}
                      </span>
                      {missing.length ? (
                        <span className="flex items-center gap-1 text-crm-warning">
                          <Lock className="size-3" aria-hidden /> Needs {missing.join(", ")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={added ? "muted" : "secondary"}
                    disabled={locked}
                    aria-pressed={added}
                    aria-label={`${added ? "Remove" : full ? "Join waitlist for" : "Add"} ${s.code}`}
                    onClick={() => toggle(s)}
                  >
                    {added ? <Minus /> : <Plus />}
                    {added ? "Remove" : full ? "Waitlist" : "Add"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3">
          <h2 className="text-sm font-medium">My schedule</h2>
          <span
            className={cn(
              "text-xs tabular-nums",
              credits > maxCredits
                ? "text-crm-danger"
                : credits < minCredits
                  ? "text-crm-warning"
                  : "text-crm-success",
            )}
          >
            {credits} credits ({minCredits}–{maxCredits})
          </span>
          <Button
            size="sm"
            variant="primary"
            className="ml-auto"
            disabled={hardBlock}
            onClick={() => onRegister?.(inCart)}
          >
            Register {inCart.length || ""}
          </Button>
        </div>
        {blockers.length ? (
          <ul
            role="alert"
            className="flex flex-col gap-1 border-b border-crm-border px-3 py-2 text-xs"
          >
            {blockers.map((b) => (
              <li key={b} className="flex items-center gap-1.5 text-crm-warning">
                <AlertTriangle className="size-3" aria-hidden /> {b}
              </li>
            ))}
            {conflicts.map(([a, b]) => (
              <li key={a.id + b.id} className="pl-4 text-crm-danger">
                {a.code} overlaps {b.code}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="overflow-x-auto p-3">
          <div
            className="grid min-w-[480px] grid-cols-[40px_repeat(5,1fr)]"
            aria-label="Weekly schedule"
          >
            <div />
            {WEEKDAYS.map((d) => (
              <div key={d} className="pb-1 text-center text-xs text-crm-muted-fg">
                {d}
              </div>
            ))}
            <div className="relative" style={{ height: (GRID_END - GRID_START) * PX_PER_MIN }}>
              {Array.from({ length: (GRID_END - GRID_START) / 120 + 1 }, (_, i) => {
                const h = 8 + i * 2;
                return (
                  <span
                    key={h}
                    className="absolute right-1 -translate-y-1/2 text-[10px] text-crm-muted-fg tabular-nums"
                    style={{ top: i * 120 * PX_PER_MIN }}
                  >
                    {h % 12 || 12}
                    {h < 12 ? "a" : "p"}
                  </span>
                );
              })}
            </div>
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="relative border-l border-crm-border"
                style={{ height: (GRID_END - GRID_START) * PX_PER_MIN }}
              >
                {layoutDay(inCart.filter((s) => s.days.includes(d))).map(({ s, lane, lanes }) => (
                  <div
                    key={s.id}
                    className={cn(
                      cn(
                        "absolute overflow-hidden rounded-[4px] border py-0.5 text-[10px] leading-tight",
                        lanes > 2 ? "px-0.5" : "px-1",
                      ),
                      conflictIds.has(s.id)
                        ? "border-crm-danger bg-crm-danger/20 text-crm-danger"
                        : "border-tag-purple-border bg-tag-purple-bg text-tag-purple-text",
                    )}
                    style={{
                      top: (toMin(s.start) - GRID_START) * PX_PER_MIN,
                      height: (toMin(s.end) - toMin(s.start)) * PX_PER_MIN,
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                    }}
                    title={`${s.code} ${s.title} ${fmt(s.start)}–${fmt(s.end)}`}
                  >
                    <span
                      className={cn(
                        "block font-medium",
                        lanes > 2 ? "text-[9px] break-words" : "truncate",
                      )}
                    >
                      {s.code}
                    </span>
                    {lanes < 3 ? <span className="block truncate">{fmt(s.start)}</span> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {inCart.length === 0 ? (
            <p className="mt-2 text-center text-xs text-crm-muted-fg">
              Add sections from the catalog to build your week.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
