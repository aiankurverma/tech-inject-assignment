import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarRange, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface DateRangePreset {
  label: string;
  range: (today: Date) => DateRange;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DAY = 86_400_000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const sameDay = (a?: Date | null, b?: Date | null) =>
  !!a && !!b && startOfDay(a).getTime() === startOfDay(b).getTime();
/** Inclusive day count of a range. */
export const rangeDays = (r: DateRange) =>
  Math.round((startOfDay(r.to).getTime() - startOfDay(r.from).getTime()) / DAY) + 1;

function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

const quarterStart = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);

export const DEFAULT_PRESETS: DateRangePreset[] = [
  { label: "Today", range: (t) => ({ from: t, to: t }) },
  { label: "Last 7 days", range: (t) => ({ from: addDays(t, -6), to: t }) },
  { label: "Last 30 days", range: (t) => ({ from: addDays(t, -29), to: t }) },
  {
    label: "Month to date",
    range: (t) => ({ from: new Date(t.getFullYear(), t.getMonth(), 1), to: t }),
  },
  {
    label: "Last month",
    range: (t) => ({
      from: new Date(t.getFullYear(), t.getMonth() - 1, 1),
      to: new Date(t.getFullYear(), t.getMonth(), 0),
    }),
  },
  { label: "Quarter to date", range: (t) => ({ from: quarterStart(t), to: t }) },
  {
    label: "Last quarter",
    range: (t) => {
      const q = quarterStart(t);
      return { from: new Date(q.getFullYear(), q.getMonth() - 3, 1), to: addDays(q, -1) };
    },
  },
  { label: "Year to date", range: (t) => ({ from: new Date(t.getFullYear(), 0, 1), to: t }) },
];

/** "Sep 1 – 28, 2026", "Aug 30 – Sep 5, 2026", "Dec 12, 2025 – Jan 4, 2026". */
export function formatRange(r: DateRange, locale = "en-US"): string {
  const { from, to } = r;
  if (sameDay(from, to))
    return from.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
  const sameYear = from.getFullYear() === to.getFullYear();
  const sameMonth = sameYear && from.getMonth() === to.getMonth();
  const a = from.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const b = to.toLocaleDateString(locale, {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: "numeric",
  });
  return `${a} – ${b}`;
}

export interface DateRangePickerProps {
  value?: DateRange | null;
  defaultValue?: DateRange | null;
  onChange?: (range: DateRange | null) => void;
  presets?: DateRangePreset[] | false;
  min?: Date;
  max?: Date;
  /** Longest allowed span in days (inclusive); days beyond it are disabled after picking a start. */
  maxDays?: number;
  /** Show the equivalent previous period under the trigger ("vs Aug 2 – 29"). */
  showComparison?: boolean;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  "aria-label"?: string;
  className?: string;
}

/** Previous period of the same length ending the day before `r.from`. */
export function previousPeriod(r: DateRange): DateRange {
  const n = rangeDays(r);
  return { from: addDays(r.from, -n), to: addDays(r.from, -1) };
}

/**
 * Range picker with two side-by-side months (one on narrow screens), presets, hover preview,
 * min/max/maxDays constraints and an Apply/Cancel draft so reports don't refetch on every click.
 * Keyboard: arrows move a day/week, PageUp/PageDown change month, Enter picks, Escape cancels.
 */
export function DateRangePicker({
  value,
  defaultValue = null,
  onChange,
  presets = DEFAULT_PRESETS,
  min,
  max,
  maxDays,
  showComparison = false,
  placeholder = "Select dates",
  disabled,
  clearable = true,
  "aria-label": ariaLabel,
  className,
}: DateRangePickerProps) {
  const [inner, setInner] = React.useState<DateRange | null>(defaultValue);
  const committed = value !== undefined ? value : inner;
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<{ from: Date; to: Date | null } | null>(null);
  const [hover, setHover] = React.useState<Date | null>(null);
  const today = startOfDay(new Date());
  const [focus, setFocus] = React.useState<Date>(today);
  const [month, setMonth] = React.useState<Date>(addMonths(today, -1));
  const gridRef = React.useRef<HTMLDivElement>(null);
  const moved = React.useRef(false);

  const commit = (r: DateRange | null) => {
    if (value === undefined) setInner(r);
    onChange?.(r);
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) {
      const anchor = committed?.to ?? today;
      setDraft(committed ? { from: committed.from, to: committed.to } : null);
      setFocus(startOfDay(anchor));
      setMonth(addMonths(anchor, -1));
      moved.current = false;
    }
  };

  React.useEffect(() => {
    if (!moved.current) return;
    gridRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
  }, [focus]);

  const outOfBounds = (d: Date) => {
    if (min && d < startOfDay(min)) return true;
    if (max && d > startOfDay(max)) return true;
    if (maxDays && draft && !draft.to) {
      const span = Math.abs(d.getTime() - draft.from.getTime()) / DAY + 1;
      if (span > maxDays) return true;
    }
    return false;
  };

  const pick = (d: Date) => {
    if (outOfBounds(d)) return;
    if (!draft || draft.to) {
      setDraft({ from: d, to: null });
    } else {
      const [a, b] = d < draft.from ? [d, draft.from] : [draft.from, d];
      setDraft({ from: a, to: b });
    }
  };

  const move = (d: Date) => {
    moved.current = true;
    setFocus(d);
    const secondMonth = addMonths(month, 1);
    if (d < month) setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    else if (d >= addMonths(secondMonth, 1)) setMonth(addMonths(d, -1));
    if (draft && !draft.to) setHover(d);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, () => void> = {
      ArrowLeft: () => move(addDays(focus, -1)),
      ArrowRight: () => move(addDays(focus, 1)),
      ArrowUp: () => move(addDays(focus, -7)),
      ArrowDown: () => move(addDays(focus, 7)),
      PageUp: () =>
        move(new Date(focus.getFullYear(), focus.getMonth() - 1, Math.min(focus.getDate(), 28))),
      PageDown: () =>
        move(new Date(focus.getFullYear(), focus.getMonth() + 1, Math.min(focus.getDate(), 28))),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  const previewEnd = draft && !draft.to ? (hover ?? draft.from) : null;
  const span: DateRange | null = draft
    ? draft.to
      ? { from: draft.from, to: draft.to }
      : previewEnd
        ? previewEnd < draft.from
          ? { from: previewEnd, to: draft.from }
          : { from: draft.from, to: previewEnd }
        : null
    : null;

  const complete = draft?.to ? { from: draft.from, to: draft.to } : null;
  const activePreset =
    presets && complete
      ? presets.find((p) => {
          const r = p.range(today);
          return sameDay(r.from, complete.from) && sameDay(r.to, complete.to);
        })
      : undefined;

  const renderMonth = (m: Date, hideOnMobile: boolean) => {
    const days = monthGrid(m);
    const title = m.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return (
      <div className={cn("w-[252px]", hideOnMobile && "hidden sm:block")}>
        <p className="mb-2 text-center text-sm font-medium text-crm-fg">{title}</p>
        <div role="grid" aria-label={title}>
          <div role="row" className="grid grid-cols-7">
            {WEEKDAYS.map((w) => (
              <span
                key={w}
                role="columnheader"
                className="grid h-7 place-items-center text-[11px] text-crm-subtle"
              >
                {w}
              </span>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, row) => (
            <div role="row" key={row} className="grid grid-cols-7">
              {days.slice(row * 7, row * 7 + 7).map((d) => {
                const outside = d.getMonth() !== m.getMonth();
                if (outside)
                  return <span key={d.toISOString()} role="gridcell" className="size-9" />;
                const off = outOfBounds(d);
                const inRange = !!span && d >= startOfDay(span.from) && d <= startOfDay(span.to);
                const isStart = !!span && sameDay(d, span.from);
                const isEnd = !!span && sameDay(d, span.to);
                const edge = isStart || isEnd;
                return (
                  <span
                    role="gridcell"
                    key={d.toISOString()}
                    aria-selected={inRange}
                    className={cn(
                      "relative",
                      inRange && !(isStart && isEnd) && "bg-crm-primary/15",
                      isStart && "rounded-l-full",
                      isEnd && "rounded-r-full",
                    )}
                  >
                    <button
                      type="button"
                      tabIndex={sameDay(d, focus) ? 0 : -1}
                      disabled={off}
                      aria-label={d.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                      aria-current={sameDay(d, today) ? "date" : undefined}
                      onMouseEnter={() => draft && !draft.to && setHover(d)}
                      onFocus={() => setFocus(d)}
                      onClick={() => pick(d)}
                      className={cn(
                        "grid size-9 cursor-pointer place-items-center rounded-full text-xs tabular-nums outline-none transition-colors duration-100",
                        "focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed disabled:opacity-25",
                        edge
                          ? "bg-crm-primary text-crm-primary-fg shadow-crm-primary"
                          : inRange
                            ? "text-crm-fg hover:bg-crm-primary/25"
                            : "text-crm-fg hover:bg-crm-muted",
                        !edge && sameDay(d, today) && "ring-1 ring-crm-input",
                      )}
                    >
                      {d.getDate()}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const nav =
    "grid size-7 cursor-pointer place-items-center rounded-full text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3.5";

  const status = !draft
    ? "Pick a start date"
    : !draft.to
      ? `Start ${draft.from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · pick an end date${maxDays ? ` (max ${maxDays} days)` : ""}`
      : `${formatRange({ from: draft.from, to: draft.to })} · ${rangeDays({ from: draft.from, to: draft.to })} days`;

  return (
    <div className={cn("inline-flex flex-col gap-1 font-crm", className)}>
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <div className="relative">
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={
                ariaLabel
                  ? `${ariaLabel}: ${committed ? formatRange(committed) : placeholder}`
                  : undefined
              }
              aria-haspopup="dialog"
              className={cn(
                "flex h-9 w-full min-w-[240px] cursor-pointer items-center gap-2 rounded-crm border border-crm-input/60 bg-crm-raised pr-8 pl-3 text-sm",
                "outline-none transition-[border-color,box-shadow] duration-150 ease-crm hover:border-crm-input",
                "focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <CalendarRange aria-hidden className="size-3.5 shrink-0 text-crm-subtle" />
              <span className={cn("truncate", committed ? "text-crm-fg" : "text-crm-subtle")}>
                {committed ? formatRange(committed) : placeholder}
              </span>
            </button>
          </Popover.Trigger>
          {clearable && committed && !disabled ? (
            <button
              type="button"
              aria-label="Clear date range"
              onClick={() => commit(null)}
              className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            aria-label="Choose date range"
            className="z-50 flex max-w-[calc(100vw-24px)] flex-col rounded-xl border border-crm-border bg-crm-popover font-crm shadow-crm-overlay outline-none data-[state=open]:animate-crm-in sm:flex-row"
          >
            {presets ? (
              <ul
                aria-label="Presets"
                className="flex gap-1 overflow-x-auto border-b border-crm-border p-2 sm:w-36 sm:flex-col sm:border-r sm:border-b-0"
              >
                {presets.map((p) => {
                  const r = p.range(today);
                  const blocked = outOfBoundsStatic(r, min, max, maxDays);
                  return (
                    <li key={p.label}>
                      <button
                        type="button"
                        disabled={blocked}
                        aria-pressed={activePreset === p}
                        onClick={() => {
                          setDraft({ from: r.from, to: r.to });
                          setFocus(r.to);
                          setMonth(addMonths(r.to, -1));
                        }}
                        className={cn(
                          "w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-xs whitespace-nowrap outline-none",
                          "hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed disabled:opacity-40",
                          activePreset === p ? "bg-crm-muted text-crm-fg" : "text-crm-soft",
                        )}
                      >
                        {p.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className="flex flex-col p-3">
              <div
                className="relative"
                ref={gridRef}
                onKeyDown={onKeyDown}
                onMouseLeave={() => setHover(null)}
              >
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setMonth(addMonths(month, -1))}
                  className={cn(nav, "absolute top-0 left-0")}
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setMonth(addMonths(month, 1))}
                  className={cn(nav, "absolute top-0 right-0")}
                >
                  <ChevronRight />
                </button>
                <div className="flex gap-4">
                  {renderMonth(month, true)}
                  {renderMonth(addMonths(month, 1), false)}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-crm-border pt-3">
                <p aria-live="polite" className="mr-auto text-xs text-crm-soft">
                  {status}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-7 cursor-pointer rounded-full px-2.5 text-xs text-crm-muted-fg outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!complete}
                  onClick={() => {
                    if (complete) commit(complete);
                    setOpen(false);
                  }}
                  className="h-7 cursor-pointer rounded-full bg-crm-primary px-3 text-xs font-medium text-crm-primary-fg shadow-crm-primary outline-none hover:bg-[#5237ff] focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {showComparison && committed ? (
        <span className="text-[11px] text-crm-subtle">
          vs {formatRange(previousPeriod(committed))}
        </span>
      ) : null}
    </div>
  );
}

function outOfBoundsStatic(r: DateRange, min?: Date, max?: Date, maxDays?: number) {
  if (min && r.from < startOfDay(min)) return true;
  if (max && r.to > startOfDay(max)) return true;
  if (maxDays && rangeDays(r) > maxDays) return true;
  return false;
}
