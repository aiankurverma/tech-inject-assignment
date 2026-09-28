import * as React from "react";
import { AlarmClock, BellOff, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/crm/popover";
import { cn } from "@/lib/utils";

export interface SnoozeOption {
  label: string;
  /** Returns the new reminder time given "now". */
  at: (now: Date) => Date;
}

function atHour(d: Date, h: number): Date {
  const x = new Date(d);
  x.setHours(h, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Next working day (Mon-Fri) at 9:00. */
function nextBusinessMorning(now: Date): Date {
  let d = addDays(now, 1);
  while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  return atHour(d, 9);
}

export const defaultSnoozeOptions: SnoozeOption[] = [
  { label: "In 1 hour", at: (n) => new Date(n.getTime() + 3_600_000) },
  {
    label: "Later today",
    at: (n) => (n.getHours() < 16 ? atHour(n, 17) : new Date(n.getTime() + 3 * 3_600_000)),
  },
  { label: "Tomorrow morning", at: nextBusinessMorning },
  {
    label: "Next Monday",
    at: (n) => atHour(addDays(n, (8 - n.getDay()) % 7 || 7), 9),
  },
  { label: "In 2 weeks", at: (n) => atHour(addDays(n, 14), 9) },
];

export type ReminderState = "scheduled" | "due" | "overdue" | "done";

export function reminderState(at: Date, now: Date, done?: boolean): ReminderState {
  if (done) return "done";
  const diff = at.getTime() - now.getTime();
  if (diff < -15 * 60_000) return "overdue";
  if (diff <= 15 * 60_000) return "due";
  return "scheduled";
}

/** "Today 5:00 PM", "Tomorrow 9:00 AM", "Mon 9:00 AM", "12 Oct". */
export function formatReminder(at: Date, now: Date, locale?: string): string {
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(at);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(at) - day(now)) / 86_400_000);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days === -1) return `Yesterday ${time}`;
  if (days > 1 && days < 7) {
    return `${new Intl.DateTimeFormat(locale, { weekday: "short" }).format(at)} ${time}`;
  }
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(at);
}

export interface ReminderChipProps {
  /** Reminder time; null means no reminder is set. */
  at: Date | string | number | null;
  onChange?: (at: Date | null) => void;
  /** Called when the reminder is marked complete. */
  onDone?: () => void;
  done?: boolean;
  /** What the reminder is about, used in labels ("Follow up with Acme"). */
  subject?: string;
  options?: SnoozeOption[];
  /** Clock override for tests and stories. */
  now?: Date;
  locale?: string;
  disabled?: boolean;
  className?: string;
}

const tone: Record<ReminderState, string> = {
  scheduled: "border-crm-border bg-crm-raised text-crm-soft",
  due: "border-crm-warning/40 bg-crm-warning/10 text-crm-warning",
  overdue: "border-crm-danger/40 bg-crm-danger/10 text-crm-danger",
  done: "border-crm-border bg-transparent text-crm-subtle line-through",
};

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Follow-up reminder pill that turns amber when due and red when overdue, with smart snooze
 * presets (skips weekends), a custom date-time, mark done and clear.
 */
export function ReminderChip({
  at,
  onChange,
  onDone,
  done,
  subject,
  options = defaultSnoozeOptions,
  now: nowProp,
  locale,
  disabled,
  className,
}: ReminderChipProps) {
  const [tick, setTick] = React.useState(() => new Date());
  React.useEffect(() => {
    if (nowProp) return;
    const id = setInterval(() => setTick(new Date()), 30_000);
    return () => clearInterval(id);
  }, [nowProp]);
  const now = nowProp ?? tick;
  const [open, setOpen] = React.useState(false);
  const [custom, setCustom] = React.useState("");
  const inputId = React.useId();
  const date = at === null ? null : new Date(at);
  const valid = date && !Number.isNaN(date.getTime()) ? date : null;
  const state = valid ? reminderState(valid, now, done) : null;
  const text = valid ? formatReminder(valid, now, locale) : "Remind me";
  const customDate = custom ? new Date(custom) : null;
  const customInPast = !!customDate && customDate.getTime() <= now.getTime();

  const set = (d: Date | null) => {
    onChange?.(d);
    setOpen(false);
    setCustom("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={
            valid
              ? `Reminder${subject ? ` for ${subject}` : ""}: ${text}${state === "overdue" ? ", overdue" : state === "due" ? ", due now" : ""}. Change`
              : `Set reminder${subject ? ` for ${subject}` : ""}`
          }
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded-full border px-2 font-crm text-xs whitespace-nowrap outline-none",
            "focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-50 [&_svg]:size-3",
            state
              ? tone[state]
              : "border-dashed border-crm-input text-crm-subtle hover:text-crm-fg",
            className,
          )}
        >
          {state === "done" ? <Check aria-hidden /> : <AlarmClock aria-hidden />}
          {state === "overdue" ? "Overdue · " : null}
          {text}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-1">
        <p className="px-2 pt-1.5 pb-1 crm-eyebrow text-crm-subtle">
          {valid ? "Snooze until" : "Remind me"}
        </p>
        <ul>
          {options.map((o) => {
            const d = o.at(now);
            return (
              <li key={o.label}>
                <button
                  type="button"
                  onClick={() => set(d)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm text-crm-fg outline-none hover:bg-crm-muted focus-visible:bg-crm-muted"
                >
                  <span>{o.label}</span>
                  <span className="crm-caption text-crm-subtle">
                    {formatReminder(d, now, locale)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <form
          className="mt-1 flex flex-col gap-1.5 border-t border-crm-border px-2 pt-2 pb-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (customDate && !customInPast) set(customDate);
          }}
        >
          <label className="crm-caption text-crm-soft" htmlFor={inputId}>
            Pick date & time
          </label>
          <div className="flex gap-1.5">
            <input
              id={inputId}
              type="datetime-local"
              min={toLocalInput(now)}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              aria-invalid={customInPast || undefined}
              className="h-7 min-w-0 flex-1 rounded-md border border-crm-input/60 bg-crm-raised px-2 text-xs text-crm-fg outline-none [color-scheme:dark] focus-visible:ring-2 focus-visible:ring-crm-ring/40 aria-[invalid=true]:border-crm-danger"
            />
            <button
              type="submit"
              disabled={!customDate || customInPast}
              className="h-7 rounded-full bg-crm-primary px-2.5 text-xs text-crm-primary-fg disabled:opacity-40"
            >
              Set
            </button>
          </div>
          {customInPast ? (
            <p role="alert" className="crm-caption text-crm-danger">
              Pick a time in the future.
            </p>
          ) : null}
        </form>
        {valid ? (
          <div className="mt-1 flex gap-1 border-t border-crm-border p-1">
            {onDone && !done ? (
              <button
                type="button"
                onClick={() => {
                  onDone();
                  setOpen(false);
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs text-crm-fg hover:bg-crm-muted [&_svg]:size-3"
              >
                <Check aria-hidden /> Mark done
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => set(null)}
              className="flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs text-crm-soft hover:bg-crm-muted hover:text-crm-danger [&_svg]:size-3"
            >
              <BellOff aria-hidden /> Clear
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
