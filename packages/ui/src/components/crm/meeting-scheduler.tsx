import * as React from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Clock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/crm/button";
import { Input, FormField } from "@/components/crm/input";
import { SegmentedControl } from "@/components/crm/segmented-control";

export interface BusyBlock {
  /** ISO date-time. */
  start: string;
  end: string;
}

export interface WorkingHours {
  /** 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** "09:00" */
  start: string;
  /** "17:30" */
  end: string;
}

export interface MeetingBooking {
  start: Date;
  end: Date;
  duration: number;
  name: string;
  email: string;
  notes: string;
  timeZone: string;
}

export interface MeetingSchedulerProps {
  host: { name: string; title?: string };
  meetingTitle: string;
  /** Durations in minutes the guest can choose from. */
  durations?: number[];
  workingHours?: WorkingHours;
  /** Existing calendar events; overlapping slots are hidden. */
  busy?: BusyBlock[];
  /** Minutes kept free before and after every busy block. */
  bufferMinutes?: number;
  /** Earliest bookable time = now + this many hours. */
  minNoticeHours?: number;
  /** How many days ahead can be booked. */
  horizonDays?: number;
  /** Slot grid step in minutes. */
  step?: number;
  /** Override "now" (useful for demos and tests). */
  now?: Date;
  /** Return a promise to show a booking state; reject to show the error. */
  onBook: (booking: MeetingBooking) => void | Promise<void>;
  className?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const toMin = (hhmm: string) => {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
};

/** Computes open start times for one day given working hours, busy blocks, buffer and notice. */
export function computeSlots(
  day: Date,
  duration: number,
  opts: {
    workingHours: WorkingHours;
    busy: BusyBlock[];
    buffer: number;
    earliest: Date;
    step: number;
  },
): Date[] {
  if (!opts.workingHours.days.includes(day.getDay())) return [];
  const startMin = toMin(opts.workingHours.start);
  const endMin = toMin(opts.workingHours.end);
  const busy = opts.busy.map((b) => ({
    s: +new Date(b.start) - opts.buffer * 60_000,
    e: +new Date(b.end) + opts.buffer * 60_000,
  }));
  const out: Date[] = [];
  for (let m = startMin; m + duration <= endMin; m += opts.step) {
    const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, m);
    const e = +s + duration * 60_000;
    if (s < opts.earliest) continue;
    if (busy.some((b) => +s < b.e && e > b.s)) continue;
    out.push(s);
  }
  return out;
}

/** Guest-facing booking flow: duration, date strip with availability, time slots, details form, confirmation. */
export function MeetingScheduler({
  host,
  meetingTitle,
  durations = [15, 30, 60],
  workingHours = { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" },
  busy = [],
  bufferMinutes = 10,
  minNoticeHours = 4,
  horizonDays = 21,
  step = 30,
  now: nowProp,
  onBook,
  className,
}: MeetingSchedulerProps) {
  const now = React.useMemo(() => nowProp ?? new Date(), [nowProp]);
  const timeZone = React.useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const [duration, setDuration] = React.useState(durations[1] ?? durations[0] ?? 30);
  const [page, setPage] = React.useState(0);
  const [slot, setSlot] = React.useState<Date | null>(null);
  const [step2, setStep2] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", notes: "" });
  const [touched, setTouched] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = React.useState("");

  const earliest = new Date(+now + minNoticeHours * 3_600_000);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const allDays = Array.from({ length: horizonDays }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });
  const slotsFor = (d: Date) =>
    computeSlots(d, duration, { workingHours, busy, buffer: bufferMinutes, earliest, step });
  const firstOpen = allDays.find((d) => slotsFor(d).length) ?? today;
  const [day, setDay] = React.useState<Date>(firstOpen);
  const perPage = 7;
  const visible = allDays.slice(page * perPage, page * perPage + perPage);
  const slots = slotsFor(day);

  const errors = {
    name: form.name.trim() ? "" : "Enter your name",
    email: EMAIL_RE.test(form.email.trim()) ? "" : "Enter a valid email",
  };
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const fmtDay = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!slot || errors.name || errors.email) return;
    setStatus("saving");
    setError("");
    try {
      await onBook({
        start: slot,
        end: new Date(+slot + duration * 60_000),
        duration,
        name: form.name.trim(),
        email: form.email.trim(),
        notes: form.notes.trim(),
        timeZone,
      });
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Booking failed, try another time");
    }
  };

  const summary = slot ? (
    <p className="flex items-center gap-2 text-sm text-crm-fg">
      <CalendarCheck className="size-4 text-crm-success" aria-hidden />
      {fmtDay(slot)}, {fmtTime(slot)} – {fmtTime(new Date(+slot + duration * 60_000))}
    </p>
  ) : null;

  return (
    <section
      aria-label={`Book ${meetingTitle} with ${host.name}`}
      className={cn(
        "grid w-full overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm shadow-crm-raised md:grid-cols-[220px_1fr]",
        className,
      )}
    >
      <aside className="flex flex-col gap-3 border-b border-crm-border p-4 md:border-r md:border-b-0">
        <p className="crm-eyebrow text-crm-subtle">{host.name}</p>
        <h2 className="text-lg font-semibold text-crm-fg">{meetingTitle}</h2>
        {host.title ? <p className="text-xs text-crm-soft">{host.title}</p> : null}
        <p className="flex items-center gap-1.5 text-xs text-crm-soft">
          <Clock className="size-3.5" aria-hidden /> {duration} min
        </p>
        <p className="flex items-center gap-1.5 text-xs text-crm-soft">
          <Globe className="size-3.5" aria-hidden /> {timeZone}
        </p>
        {!step2 && status !== "done" ? (
          <SegmentedControl
            label="Meeting length"
            size="sm"
            value={String(duration)}
            onValueChange={(v) => {
              setDuration(Number(v));
              setSlot(null);
            }}
            options={durations.map((d) => ({ value: String(d), label: `${d}m` }))}
          />
        ) : null}
      </aside>

      <div className="flex min-h-[340px] flex-col gap-4 p-4">
        {status === "done" ? (
          <div
            role="status"
            className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
          >
            <CalendarCheck className="size-8 text-crm-success" aria-hidden />
            <h3 className="text-base font-semibold text-crm-fg">You are booked</h3>
            {summary}
            <p className="text-xs text-crm-soft">
              A calendar invite was sent to {form.email.trim()}.
            </p>
          </div>
        ) : step2 && slot ? (
          <form noValidate onSubmit={submit} className="flex flex-col gap-3">
            {summary}
            <FormField label="Name" htmlFor="ms-name" required error={touched ? errors.name : ""}>
              <Input
                id="ms-name"
                value={form.name}
                autoComplete="name"
                invalid={touched && !!errors.name}
                aria-describedby="ms-name-msg"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>
            <FormField
              label="Email"
              htmlFor="ms-email"
              required
              error={touched ? errors.email : ""}
            >
              <Input
                id="ms-email"
                type="email"
                value={form.email}
                autoComplete="email"
                invalid={touched && !!errors.email}
                aria-describedby="ms-email-msg"
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </FormField>
            <FormField label="What should we cover?" htmlFor="ms-notes" hint="Optional">
              <Input
                id="ms-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </FormField>
            {status === "error" ? (
              <p role="alert" className="text-xs text-crm-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep2(false)}>
                Back
              </Button>
              <Button type="submit" variant="primary" loading={status === "saving"}>
                Confirm booking
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-crm-fg">Select a date</h3>
              <div className="flex gap-1">
                <IconButton
                  label="Earlier dates"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft />
                </IconButton>
                <IconButton
                  label="Later dates"
                  disabled={(page + 1) * perPage >= allDays.length}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight />
                </IconButton>
              </div>
            </div>
            <div role="listbox" aria-label="Dates" className="grid grid-cols-7 gap-1">
              {visible.map((d) => {
                const count = slotsFor(d).length;
                const on = +d === +day;
                return (
                  <button
                    key={+d}
                    type="button"
                    role="option"
                    aria-selected={on}
                    disabled={!count}
                    aria-label={`${fmtDay(d)}, ${count} open times`}
                    onClick={() => {
                      setDay(d);
                      setSlot(null);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-crm border py-1.5 text-xs outline-none",
                      "focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed disabled:opacity-35",
                      on
                        ? "border-crm-primary bg-crm-primary/15 text-crm-fg"
                        : "cursor-pointer border-crm-border text-crm-soft hover:bg-crm-muted",
                    )}
                  >
                    <span className="text-[10px] uppercase">
                      {d.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span className="text-sm font-medium tabular-nums">{d.getDate()}</span>
                    <span
                      aria-hidden
                      className={cn(
                        "size-1 rounded-full",
                        count ? "bg-crm-success" : "bg-transparent",
                      )}
                    />
                  </button>
                );
              })}
            </div>
            <h3 className="text-sm font-medium text-crm-fg">{fmtDay(day)}</h3>
            {slots.length ? (
              <div
                role="listbox"
                aria-label="Available times"
                className="grid grid-cols-3 gap-1.5 sm:grid-cols-4"
              >
                {slots.map((s) => {
                  const on = slot !== null && +s === +slot;
                  return (
                    <button
                      key={+s}
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => setSlot(s)}
                      className={cn(
                        "h-8 cursor-pointer rounded-crm border text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                        on
                          ? "border-crm-primary bg-crm-primary text-crm-primary-fg"
                          : "border-crm-border text-crm-fg hover:border-crm-primary",
                      )}
                    >
                      {fmtTime(s)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-crm border border-dashed border-crm-border p-4 text-center text-xs text-crm-subtle">
                No open times on this day. Pick another date.
              </p>
            )}
            <div className="mt-auto flex justify-end">
              <Button variant="primary" disabled={!slot} onClick={() => setStep2(true)}>
                Next
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
