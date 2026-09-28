import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/crm/button";

export type CalendarEventTone = "primary" | "success" | "warning" | "danger" | "neutral";

export interface CalendarEvent {
  id: string;
  title: string;
  /** ISO date-time, local. */
  start: string;
  /** ISO date-time, local. Ignored for all-day events. */
  end: string;
  allDay?: boolean;
  location?: string;
  tone?: CalendarEventTone;
}

export interface CalendarWeekProps {
  events: CalendarEvent[];
  /** Any date inside the week to show (controlled). */
  week?: Date;
  defaultWeek?: Date;
  onWeekChange?: (weekStart: Date) => void;
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn?: 0 | 1;
  /** First and last visible hour (0-24). */
  startHour?: number;
  endHour?: number;
  /** Pixel height of one hour row. */
  hourHeight?: number;
  /** Click an empty slot; receives the slot start snapped to 30 minutes. */
  onSlotClick?: (start: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  /** Override "now" (for the red time line); defaults to the real clock. */
  now?: Date;
  loading?: boolean;
  className?: string;
}

const tones: Record<CalendarEventTone, string> = {
  primary: "border-l-crm-primary bg-crm-primary/20 text-crm-fg",
  success: "border-l-crm-success bg-crm-success/15 text-crm-fg",
  warning: "border-l-crm-warning bg-crm-warning/15 text-crm-fg",
  danger: "border-l-crm-danger bg-crm-danger/15 text-crm-fg",
  neutral: "border-l-crm-subtle bg-crm-muted text-crm-fg",
};

const DAY = 86_400_000;

export function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 1) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() - weekStartsOn + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const fmtTime = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

interface Placed {
  event: CalendarEvent;
  start: Date;
  end: Date;
  col: number;
  cols: number;
}

/** Greedy column packing: overlapping events share the day width side by side. */
export function layoutDay(events: CalendarEvent[]): Placed[] {
  const items = events
    .map((event) => ({ event, start: new Date(event.start), end: new Date(event.end) }))
    .filter((e) => e.end > e.start)
    .sort((a, b) => +a.start - +b.start || +b.end - +a.end);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1));
    cluster.forEach((p) => (p.cols = cols));
    out.push(...cluster);
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && +it.start >= clusterEnd) flush();
    const used = new Set(cluster.filter((p) => p.end > it.start).map((p) => p.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ ...it, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, +it.end);
  }
  if (cluster.length) flush();
  return out;
}

/** Week calendar: 7 day columns, hour grid, all-day row, overlap layout, now line, slot click and week navigation. */
export function CalendarWeek({
  events,
  week,
  defaultWeek,
  onWeekChange,
  weekStartsOn = 1,
  startHour = 7,
  endHour = 20,
  hourHeight = 48,
  onSlotClick,
  onEventClick,
  now: nowProp,
  loading,
  className,
}: CalendarWeekProps) {
  const [inner, setInner] = React.useState(() => defaultWeek ?? nowProp ?? new Date());
  const anchor = startOfWeek(week ?? inner, weekStartsOn);
  const [clock, setClock] = React.useState(() => new Date());
  React.useEffect(() => {
    if (nowProp) return;
    const t = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, [nowProp]);
  const now = nowProp ?? clock;

  const go = (d: Date) => {
    if (week === undefined) setInner(d);
    onWeekChange?.(startOfWeek(d, weekStartsOn));
  };
  const days = Array.from({ length: 7 }, (_, i) => new Date(+anchor + i * DAY + 3_600_000 * 2)).map(
    (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()),
  );
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  // Days with overlapping events get proportionally wider columns so side-by-side lanes stay readable.
  const laneCounts = days.map((d) =>
    Math.max(
      1,
      ...layoutDay(events.filter((e) => !e.allDay && sameDay(new Date(e.start), d))).map(
        (p) => p.cols,
      ),
    ),
  );
  const gridCols = `52px ${laneCounts.map((c) => `minmax(${c * 96}px, ${c}fr)`).join(" ")}`;
  const gridHeight = hours.length * hourHeight;
  const lastDay = days[6] ?? anchor;
  const range = `${days[0]?.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${lastDay.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const allDay = (d: Date) =>
    events.filter((e) => {
      if (!e.allDay) return false;
      const s = new Date(e.start);
      const en = new Date(e.end);
      return sameDay(s, d) || (s <= d && en >= d);
    });

  const slotFromClick = (e: React.MouseEvent<HTMLDivElement>, day: Date) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mins = Math.floor(((e.clientY - rect.top) / hourHeight) * 2) * 30;
    const d = new Date(day);
    d.setHours(startHour, mins, 0, 0);
    onSlotClick?.(d);
  };

  return (
    <section
      aria-label={`Week of ${range}`}
      aria-busy={loading || undefined}
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-crm-border px-3 py-2">
        <h2 className="text-sm font-medium text-crm-fg" aria-live="polite">
          {range}
        </h2>
        <div className="flex items-center gap-1.5">
          <IconButton label="Previous week" onClick={() => go(new Date(+anchor - 7 * DAY))}>
            <ChevronLeft />
          </IconButton>
          <Button size="sm" onClick={() => go(now)}>
            Today
          </Button>
          <IconButton label="Next week" onClick={() => go(new Date(+anchor + 7 * DAY))}>
            <ChevronRight />
          </IconButton>
        </div>
      </header>
      <div className="overflow-x-auto">
        <div className="min-w-max">
          <div
            className="grid border-b border-crm-border"
            style={{ gridTemplateColumns: gridCols }}
          >
            <span className="crm-caption self-end px-1 pb-1 text-crm-subtle">all-day</span>
            {days.map((d) => {
              const today = sameDay(d, now);
              return (
                <div
                  key={+d}
                  className="flex min-h-14 flex-col gap-1 border-l border-crm-border p-1"
                >
                  <span
                    className={cn(
                      "flex items-baseline gap-1 text-xs",
                      today ? "text-crm-fg" : "text-crm-subtle",
                    )}
                  >
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                    <span
                      className={cn(
                        "grid size-5 place-items-center rounded-full tabular-nums",
                        today && "bg-crm-primary text-crm-primary-fg",
                      )}
                    >
                      {d.getDate()}
                    </span>
                  </span>
                  {allDay(d).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onEventClick?.(e)}
                      className={cn(
                        "truncate rounded border-l-2 px-1 text-left text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                        tones[e.tone ?? "primary"],
                      )}
                    >
                      {e.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <div
            className="relative grid max-h-[520px] overflow-y-auto"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="relative" style={{ height: gridHeight }}>
              {hours.map((h, i) => (
                <span
                  key={h}
                  className="absolute right-1.5 -translate-y-1/2 text-[10px] text-crm-subtle tabular-nums"
                  style={{ top: i * hourHeight }}
                >
                  {i === 0 ? "" : fmtTime(new Date(2000, 0, 1, h))}
                </span>
              ))}
            </div>
            {days.map((d) => {
              const dayEvents = events.filter((e) => !e.allDay && sameDay(new Date(e.start), d));
              const placed = layoutDay(dayEvents);
              const showNow =
                sameDay(d, now) && now.getHours() >= startHour && now.getHours() < endHour;
              const nowTop =
                ((now.getHours() - startHour) * 60 + now.getMinutes()) * (hourHeight / 60);
              return (
                <div
                  key={+d}
                  role="group"
                  aria-label={d.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  className="relative border-l border-crm-border"
                  style={{
                    height: gridHeight,
                    backgroundImage: `repeating-linear-gradient(to bottom, var(--color-crm-border) 0 1px, transparent 1px ${hourHeight}px)`,
                  }}
                  onClick={onSlotClick ? (e) => slotFromClick(e, d) : undefined}
                >
                  {placed.map((p) => {
                    const top =
                      ((p.start.getHours() - startHour) * 60 + p.start.getMinutes()) *
                      (hourHeight / 60);
                    const height = Math.max(
                      18,
                      ((+p.end - +p.start) / 60_000) * (hourHeight / 60) - 2,
                    );
                    if (top + height < 0 || top > gridHeight) return null;
                    return (
                      <button
                        key={p.event.id}
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onEventClick?.(p.event);
                        }}
                        aria-label={`${p.event.title}, ${fmtTime(p.start)} to ${fmtTime(p.end)}${p.event.location ? `, ${p.event.location}` : ""}`}
                        className={cn(
                          "absolute overflow-hidden rounded border-l-2 px-1.5 py-0.5 text-left text-[11px] leading-tight outline-none",
                          "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-crm-ring/60 hover:brightness-125",
                          tones[p.event.tone ?? "primary"],
                        )}
                        style={{
                          top: Math.max(0, top),
                          height,
                          left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
                          width: `calc(${100 / p.cols}% - 4px)`,
                        }}
                      >
                        <span className="block truncate font-medium">{p.event.title}</span>
                        {height > 30 ? (
                          <span className="block truncate text-crm-soft">
                            {fmtTime(p.start)}
                            {p.event.location ? ` · ${p.event.location}` : ""}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                  {showNow ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute right-0 left-0 z-20 h-px bg-crm-danger before:absolute before:-top-1 before:-left-1 before:size-2 before:rounded-full before:bg-crm-danger"
                      style={{ top: nowTop }}
                    />
                  ) : null}
                </div>
              );
            })}
            {loading ? (
              <div className="absolute inset-0 grid place-items-center bg-crm-card/60 text-xs text-crm-soft">
                Loading events…
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
