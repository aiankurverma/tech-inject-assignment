import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { tagColors, type TagColor } from "@/components/crm/tag";

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date | string;
  /** Inclusive end; multi-day events render on every covered day. */
  end?: Date | string;
  allDay?: boolean;
  color?: TagColor;
}

export interface CalendarMonthProps {
  events: CalendarEvent[];
  /** Any date inside the visible month (controlled). */
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  selectedDate?: Date | null;
  onSelectDate?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn?: 0 | 1;
  /** Events shown per day before "+N more". */
  maxPerDay?: number;
  locale?: string;
  today?: Date;
  className?: string;
}

const toDate = (d: Date | string) => (d instanceof Date ? d : new Date(d));
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * Month grid with events per day (multi-day spans, "+N more" overflow), month navigation, a
 * Today button and roving keyboard focus (arrows, PageUp/PageDown for months, Enter selects).
 */
export function CalendarMonth({
  events,
  month: monthProp,
  defaultMonth,
  onMonthChange,
  selectedDate,
  onSelectDate,
  onEventClick,
  weekStartsOn = 1,
  maxPerDay = 3,
  locale,
  today: todayProp,
  className,
}: CalendarMonthProps) {
  const today = startOfDay(todayProp ?? new Date());
  const [inner, setInner] = React.useState(() => defaultMonth ?? today);
  const month = monthProp ?? inner;
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const [focused, setFocused] = React.useState<Date>(() =>
    selectedDate && sameDay(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1), first)
      ? selectedDate
      : month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear()
        ? today
        : first,
  );
  const gridRef = React.useRef<HTMLDivElement>(null);
  const shouldFocus = React.useRef(false);

  const setMonth = (d: Date) => {
    const m = new Date(d.getFullYear(), d.getMonth(), 1);
    if (monthProp === undefined) setInner(m);
    onMonthChange?.(m);
  };

  const lead = (first.getDay() - weekStartsOn + 7) % 7;
  const gridStart = addDays(first, -lead);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((lead + daysInMonth) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));

  const byDay = React.useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const s = startOfDay(toDate(ev.start));
      const e = ev.end ? startOfDay(toDate(ev.end)) : s;
      for (let d = s, n = 0; d <= e && n < 62; d = addDays(d, 1), n++) {
        const list = m.get(key(d)) ?? [];
        list.push(ev);
        m.set(key(d), list);
      }
    }
    for (const list of m.values())
      list.sort(
        (a, b) =>
          Number(!!b.allDay) - Number(!!a.allDay) ||
          toDate(a.start).getTime() - toDate(b.start).getTime(),
      );
    return m;
  }, [events]);

  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(first);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  const full = new Intl.DateTimeFormat(locale, { dateStyle: "full" });

  React.useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${key(focused)}"]`)?.focus();
  }, [focused, month]);

  const moveTo = (d: Date) => {
    shouldFocus.current = true;
    setFocused(d);
    if (d.getMonth() !== first.getMonth() || d.getFullYear() !== first.getFullYear()) setMonth(d);
  };

  const onKey = (e: React.KeyboardEvent, d: Date) => {
    const map: Record<string, () => Date> = {
      ArrowRight: () => addDays(d, 1),
      ArrowLeft: () => addDays(d, -1),
      ArrowDown: () => addDays(d, 7),
      ArrowUp: () => addDays(d, -7),
      PageDown: () => new Date(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), 28)),
      PageUp: () => new Date(d.getFullYear(), d.getMonth() - 1, Math.min(d.getDate(), 28)),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      moveTo(fn());
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectDate?.(d);
    }
  };

  const focusInGrid = days.some((d) => sameDay(d, focused)) ? focused : first;

  return (
    <section className={cn("rounded-crm border border-crm-border bg-crm-card font-crm", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-crm-border px-3 py-2">
        <h2 className="text-sm font-medium text-crm-fg" aria-live="polite">
          {title}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setMonth(today);
              setFocused(today);
            }}
            className="h-7 cursor-pointer rounded-full bg-crm-raised px-2.5 text-xs text-crm-fg shadow-crm-raised outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            Today
          </button>
          {[
            { l: "Previous month", d: -1, I: ChevronLeft },
            { l: "Next month", d: 1, I: ChevronRight },
          ].map(({ l, d, I }) => (
            <button
              key={l}
              type="button"
              aria-label={l}
              onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() + d, 1))}
              className="grid size-7 cursor-pointer place-items-center rounded-full text-crm-muted-fg outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <I className="size-4" aria-hidden />
            </button>
          ))}
        </div>
      </header>
      <div className="overflow-x-auto">
        <div role="grid" aria-label={title} ref={gridRef} className="min-w-[560px]">
          <div role="row" className="grid grid-cols-7 border-b border-crm-border">
            {days.slice(0, 7).map((d) => (
              <span
                key={d.getDay()}
                role="columnheader"
                className="px-2 py-1.5 text-[11px] text-crm-muted-fg"
              >
                {weekday.format(d)}
              </span>
            ))}
          </div>
          {Array.from({ length: weeks }, (_, w) => (
            <div key={w} role="row" className="grid grid-cols-7">
              {days.slice(w * 7, w * 7 + 7).map((d) => {
                const list = byDay.get(key(d)) ?? [];
                const outside = d.getMonth() !== first.getMonth();
                const isToday = sameDay(d, today);
                const isSel = selectedDate ? sameDay(d, selectedDate) : false;
                const extra = list.length - maxPerDay;
                return (
                  <div
                    key={key(d)}
                    role="gridcell"
                    tabIndex={sameDay(d, focusInGrid) ? 0 : -1}
                    data-day={key(d)}
                    aria-selected={isSel}
                    aria-label={`${full.format(d)}, ${list.length} ${list.length === 1 ? "event" : "events"}`}
                    onClick={() => {
                      setFocused(d);
                      onSelectDate?.(d);
                    }}
                    onKeyDown={(e) => onKey(e, d)}
                    className={cn(
                      "min-h-[92px] cursor-pointer border-r border-b border-crm-border p-1 outline-none last:border-r-0",
                      "hover:bg-crm-muted/40 focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:ring-inset",
                      outside && "bg-crm-bg/40",
                      isSel && "bg-crm-primary/10",
                    )}
                  >
                    <span
                      className={cn(
                        "mb-1 grid size-5 place-items-center rounded-full text-[11px] tabular-nums",
                        isToday
                          ? "bg-crm-primary text-crm-primary-fg"
                          : outside
                            ? "text-crm-faint"
                            : "text-crm-soft",
                      )}
                    >
                      {d.getDate()}
                    </span>
                    <ul className="flex flex-col gap-0.5">
                      {list.slice(0, maxPerDay).map((ev) => (
                        <li key={ev.id}>
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick?.(ev);
                            }}
                            title={ev.title}
                            className={cn(
                              "block w-full cursor-pointer truncate rounded-[4px] border px-1 text-left text-[11px] leading-[16px]",
                              ev.allDay || ev.end
                                ? tagColors[ev.color ?? "blue"]
                                : "border-transparent text-crm-chip hover:bg-crm-muted",
                            )}
                          >
                            {!ev.allDay && !ev.end ? (
                              <span className="mr-1 text-crm-muted-fg tabular-nums">
                                {time.format(toDate(ev.start))}
                              </span>
                            ) : null}
                            {ev.title}
                          </button>
                        </li>
                      ))}
                      {extra > 0 ? (
                        <li className="px-1 text-[10px] text-crm-muted-fg">+{extra} more</li>
                      ) : null}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
