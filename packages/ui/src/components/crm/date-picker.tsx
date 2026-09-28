import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const sameDay = (a?: Date | null, b?: Date | null) =>
  !!a &&
  !!b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** 42 days (6 weeks, Monday first) covering the month of `month`. */
function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export interface CalendarProps {
  value?: Date | null;
  onChange?: (date: Date) => void;
  min?: Date;
  max?: Date;
  className?: string;
}

/** Month grid (role="grid"). Arrows move a day/week, PageUp/PageDown change month, Home/End jump within the week, Enter selects. */
export function Calendar({ value, onChange, min, max, className }: CalendarProps) {
  const [focus, setFocus] = React.useState<Date>(() => startOfDay(value ?? new Date()));
  const gridRef = React.useRef<HTMLDivElement>(null);
  const moved = React.useRef(false);
  const today = startOfDay(new Date());
  const days = monthGrid(focus);
  const disabled = (d: Date) =>
    (min ? d < startOfDay(min) : false) || (max ? d > startOfDay(max) : false);
  const label = focus.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  React.useEffect(() => {
    if (!moved.current) return;
    gridRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  }, [focus]);

  const move = (d: Date) => {
    moved.current = true;
    setFocus(d);
  };
  const shiftMonth = (n: number) =>
    move(new Date(focus.getFullYear(), focus.getMonth() + n, Math.min(focus.getDate(), 28)));

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, () => void> = {
      ArrowLeft: () => move(addDays(focus, -1)),
      ArrowRight: () => move(addDays(focus, 1)),
      ArrowUp: () => move(addDays(focus, -7)),
      ArrowDown: () => move(addDays(focus, 7)),
      PageUp: () => shiftMonth(-1),
      PageDown: () => shiftMonth(1),
      Home: () => move(addDays(focus, -((focus.getDay() + 6) % 7))),
      End: () => move(addDays(focus, 6 - ((focus.getDay() + 6) % 7))),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  const nav =
    "grid size-7 cursor-pointer place-items-center rounded-full text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3.5";

  return (
    <div className={cn("w-[252px] font-crm", className)}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
          className={nav}
        >
          <ChevronLeft />
        </button>
        <span aria-live="polite" className="text-sm font-medium text-crm-fg">
          {label}
        </span>
        <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className={nav}>
          <ChevronRight />
        </button>
      </div>
      <div role="grid" aria-label={label} ref={gridRef} onKeyDown={onKeyDown}>
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
              const selected = sameDay(d, value);
              const outside = d.getMonth() !== focus.getMonth();
              const off = disabled(d);
              return (
                <span role="gridcell" key={d.toISOString()} aria-selected={selected}>
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
                    onClick={() => {
                      setFocus(d);
                      onChange?.(d);
                    }}
                    className={cn(
                      "grid size-9 cursor-pointer place-items-center rounded-full text-xs tabular-nums outline-none transition-colors duration-150",
                      "focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed disabled:opacity-30",
                      selected
                        ? "bg-crm-primary text-crm-primary-fg shadow-crm-primary"
                        : outside
                          ? "text-crm-faint hover:bg-crm-muted"
                          : "text-crm-fg hover:bg-crm-muted",
                      !selected && sameDay(d, today) && "ring-1 ring-crm-input",
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
}

export interface DatePickerProps extends CalendarProps {
  placeholder?: string;
  /** Format the chosen date for the trigger. */
  format?: (d: Date) => string;
  /** Accessible name for the trigger when there is no visible label. */
  "aria-label"?: string;
  disabled?: boolean;
}

const defaultFormat = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Input-styled trigger that opens a Calendar in a popover. Closes and returns focus on select. */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  format = defaultFormat,
  min,
  max,
  disabled,
  className,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          className={cn(
            "flex h-9 w-full cursor-pointer items-center gap-2 rounded-crm border border-crm-input/60 bg-crm-raised px-3 font-crm text-sm",
            "outline-none transition-[border-color,box-shadow] duration-150 ease-crm hover:border-crm-input",
            "focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <CalendarDays className="size-3.5 text-crm-subtle" />
          <span className={value ? "text-crm-fg" : "text-crm-subtle"}>
            {value ? format(value) : placeholder}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 rounded-xl border border-crm-border bg-crm-popover p-3 shadow-crm-overlay outline-none data-[state=open]:animate-crm-in"
        >
          <Calendar
            value={value}
            min={min}
            max={max}
            onChange={(d) => {
              onChange?.(d);
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
