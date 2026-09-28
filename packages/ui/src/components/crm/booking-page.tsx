import * as React from "react";
import {
  ArrowLeft,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { FormField, Input } from "@/components/crm/input";
import { Textarea } from "@/components/crm/textarea";

export interface BookingEventType {
  id: string;
  name: string;
  minutes: number;
  description?: string;
  location?: string;
}

export interface BookingDetails {
  eventTypeId: string;
  /** ISO start in UTC. */
  start: string;
  timeZone: string;
  name: string;
  email: string;
  notes: string;
}

export interface BookingPageProps {
  host: { name: string; title?: string; avatar?: React.ReactNode };
  eventTypes: BookingEventType[];
  /** Open slot starts as ISO UTC strings, for all event types (filtered by duration fit is up to you). */
  slots: string[];
  /** Viewer's time zone; defaults to the browser's. */
  defaultTimeZone?: string;
  timeZones?: string[];
  /** Hide slots starting sooner than this many minutes from now. */
  minNoticeMinutes?: number;
  /** Reference time (defaults to now). */
  now?: Date;
  onBook: (details: BookingDetails) => Promise<void>;
  className?: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** yyyy-mm-dd of an instant as seen in a time zone. */
function dayKey(iso: string | Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Public scheduling page: event type → month calendar → time-zone aware slots → details → confirmation. */
export function BookingPage({
  host,
  eventTypes,
  slots,
  defaultTimeZone,
  timeZones = [
    "America/Los_Angeles",
    "America/New_York",
    "Europe/London",
    "Europe/Berlin",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Australia/Sydney",
  ],
  minNoticeMinutes = 120,
  now,
  onBook,
  className,
}: BookingPageProps) {
  const id = React.useId();
  const browserTz = React.useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const [tz, setTz] = React.useState(defaultTimeZone ?? browserTz);
  const [eventId, setEventId] = React.useState(
    eventTypes.length === 1 ? (eventTypes[0]?.id ?? "") : "",
  );
  const [day, setDay] = React.useState<string | null>(null);
  const [slot, setSlot] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<"pick" | "details" | "done">("pick");
  const [form, setForm] = React.useState({ name: "", email: "", notes: "" });
  const [errors, setErrors] = React.useState<Partial<Record<"name" | "email" | "submit", string>>>(
    {},
  );
  const [busy, setBusy] = React.useState(false);
  const nowMs = (now ?? new Date()).getTime();

  const event = eventTypes.find((e) => e.id === eventId);
  const available = React.useMemo(
    () => slots.filter((s) => new Date(s).getTime() >= nowMs + minNoticeMinutes * 60_000).sort(),
    [slots, nowMs, minNoticeMinutes],
  );
  const byDay = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of available) {
      const k = dayKey(s, tz);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return m;
  }, [available, tz]);

  const firstKey = [...byDay.keys()][0] ?? dayKey(new Date(nowMs), tz);
  const [month, setMonth] = React.useState(() => firstKey.slice(0, 7));
  const [y = 1970, mo = 1] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7;
  const todayKey = dayKey(new Date(nowMs), tz);
  const shiftMonth = (d: number) => {
    const dt = new Date(Date.UTC(y, mo - 1 + d, 1));
    setMonth(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const timeFmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  const longFmt = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
      timeZoneName: "short",
    });

  const gridRef = React.useRef<HTMLDivElement>(null);
  const onGridKey = (e: React.KeyboardEvent, d: number) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = Math.min(daysInMonth, Math.max(1, d + delta));
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()))
      errs.email = "Enter a valid email.";
    setErrors(errs);
    if (Object.keys(errs).length || !slot || !event) return;
    setBusy(true);
    try {
      await onBook({
        eventTypeId: event.id,
        start: slot,
        timeZone: tz,
        name: form.name.trim(),
        email: form.email.trim(),
        notes: form.notes.trim(),
      });
      setStep("done");
    } catch (x) {
      setErrors({
        submit: x instanceof Error ? x.message : "That time was just taken. Pick another slot.",
      });
    } finally {
      setBusy(false);
    }
  };

  const summary = (
    <aside className="flex flex-col gap-3 border-b border-crm-border pb-4 md:w-60 md:shrink-0 md:border-r md:border-b-0 md:pr-4 md:pb-0">
      <div className="flex items-center gap-2">
        {host.avatar}
        <div>
          <p className="text-sm font-medium text-crm-fg">{host.name}</p>
          {host.title ? <p className="crm-caption text-crm-subtle">{host.title}</p> : null}
        </div>
      </div>
      {event ? (
        <div className="flex flex-col gap-1.5 text-sm text-crm-soft [&_svg]:size-3.5 [&_svg]:text-crm-subtle">
          <p className="text-base font-semibold text-crm-fg">{event.name}</p>
          <p className="flex items-center gap-1.5">
            <Clock aria-hidden /> {event.minutes} min
          </p>
          {event.location ? (
            <p className="flex items-center gap-1.5">
              <Video aria-hidden /> {event.location}
            </p>
          ) : null}
          {slot ? (
            <p className="flex items-center gap-1.5 text-crm-fg">
              <CalendarCheck aria-hidden /> {longFmt(slot)}
            </p>
          ) : null}
          {event.description ? <p className="text-xs">{event.description}</p> : null}
        </div>
      ) : null}
    </aside>
  );

  return (
    <section
      aria-label={`Book time with ${host.name}`}
      className={cn(
        "flex flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-4 font-crm md:flex-row sm:p-5",
        className,
      )}
    >
      {summary}
      <div className="min-w-0 flex-1">
        {step === "done" && slot && event ? (
          <div role="status" className="flex flex-col items-center gap-2 py-8 text-center">
            <CalendarCheck aria-hidden className="size-8 text-crm-success" />
            <p className="text-base font-semibold text-crm-fg">You're booked</p>
            <p className="text-sm text-crm-soft">
              {event.name} with {host.name} · {longFmt(slot)}
            </p>
            <p className="crm-caption text-crm-subtle">
              A calendar invite is on its way to {form.email}.
            </p>
          </div>
        ) : !event ? (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-crm-fg">Choose a meeting type</h2>
            {eventTypes.length === 0 ? (
              <p className="text-sm text-crm-subtle">No meeting types are available right now.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {eventTypes.map((et) => (
                  <li key={et.id}>
                    <button
                      type="button"
                      onClick={() => setEventId(et.id)}
                      className="flex w-full items-center justify-between rounded-crm border border-crm-border p-3 text-left outline-none hover:border-crm-input focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                    >
                      <span>
                        <span className="block text-sm font-medium text-crm-fg">{et.name}</span>
                        {et.description ? (
                          <span className="text-xs text-crm-soft">{et.description}</span>
                        ) : null}
                      </span>
                      <span className="crm-caption text-crm-subtle">{et.minutes} min</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : step === "details" && slot ? (
          <form noValidate onSubmit={submit} className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setStep("pick")}
              className="inline-flex items-center gap-1 self-start text-xs text-crm-subtle hover:text-crm-fg [&_svg]:size-3"
            >
              <ArrowLeft aria-hidden /> Change time
            </button>
            <FormField label="Name" htmlFor={`${id}-n`} required error={errors.name}>
              <Input
                id={`${id}-n`}
                autoComplete="name"
                value={form.name}
                invalid={!!errors.name}
                aria-describedby={`${id}-n-msg`}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>
            <FormField label="Work email" htmlFor={`${id}-e`} required error={errors.email}>
              <Input
                id={`${id}-e`}
                type="email"
                autoComplete="email"
                value={form.email}
                invalid={!!errors.email}
                aria-describedby={`${id}-e-msg`}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </FormField>
            <FormField
              label="What would you like to cover?"
              htmlFor={`${id}-t`}
              hint="Optional — helps us prepare."
            >
              <Textarea
                id={`${id}-t`}
                rows={3}
                maxLength={500}
                showCount
                value={form.notes}
                aria-describedby={`${id}-t-msg`}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </FormField>
            {errors.submit ? (
              <p role="alert" className="text-xs text-crm-danger">
                {errors.submit}
              </p>
            ) : null}
            <Button type="submit" variant="primary" size="lg" loading={busy} className="self-start">
              Confirm booking
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-center justify-between">
                {eventTypes.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEventId("");
                      setSlot(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-crm-subtle hover:text-crm-fg [&_svg]:size-3"
                  >
                    <ArrowLeft aria-hidden /> Meeting types
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => shiftMonth(-1)}
                    disabled={month <= todayKey.slice(0, 7)}
                    className="rounded-full p-1 text-crm-soft hover:bg-crm-muted disabled:opacity-30 [&_svg]:size-4"
                  >
                    <ChevronLeft />
                  </button>
                  <span
                    className="w-32 text-center text-sm font-medium text-crm-fg"
                    aria-live="polite"
                  >
                    {new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </span>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => shiftMonth(1)}
                    className="rounded-full p-1 text-crm-soft hover:bg-crm-muted [&_svg]:size-4"
                  >
                    <ChevronRight />
                  </button>
                </div>
              </div>
              <div
                ref={gridRef}
                role="grid"
                aria-label="Available days"
                className="grid grid-cols-7 gap-1 text-center"
              >
                {WEEKDAYS.map((w) => (
                  <span key={w} role="columnheader" className="crm-caption text-crm-subtle">
                    {w}
                  </span>
                ))}
                {Array.from({ length: lead }, (_, i) => (
                  <span key={`l${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = i + 1;
                  const k = `${month}-${String(d).padStart(2, "0")}`;
                  const n = byDay.get(k)?.length ?? 0;
                  const sel = day === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="gridcell"
                      data-day={d}
                      aria-selected={sel}
                      aria-label={`${k}, ${n ? `${n} times available` : "unavailable"}`}
                      aria-disabled={!n}
                      tabIndex={sel || (!day && d === 1) ? 0 : -1}
                      onKeyDown={(e) => onGridKey(e, d)}
                      onClick={() => {
                        if (n) {
                          setDay(k);
                          setSlot(null);
                        }
                      }}
                      className={cn(
                        "relative aspect-square rounded-full text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                        sel
                          ? "bg-crm-primary text-crm-primary-fg"
                          : n
                            ? "bg-crm-primary/15 font-medium text-crm-fg hover:bg-crm-primary/30"
                            : "cursor-default text-crm-faint",
                        k === todayKey && !sel && "ring-1 ring-crm-input",
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <label
                htmlFor={`${id}-tz`}
                className="mt-1 flex items-center gap-1.5 text-xs text-crm-soft [&_svg]:size-3.5"
              >
                <Globe aria-hidden /> Time zone
              </label>
              <select
                id={`${id}-tz`}
                value={tz}
                onChange={(e) => {
                  setTz(e.target.value);
                  setDay(null);
                  setSlot(null);
                }}
                className="h-8 rounded-crm border border-crm-input/60 bg-crm-raised px-2 text-sm text-crm-fg outline-none [color-scheme:dark] focus-visible:ring-2 focus-visible:ring-crm-ring/40"
              >
                {[...new Set([tz, ...timeZones])].map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              {byDay.size === 0 ? (
                <p className="text-sm text-crm-subtle">
                  No open times in the coming weeks. Check back soon.
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 lg:w-44">
              <p className="text-sm font-medium text-crm-fg">
                {day
                  ? new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })
                  : "Pick a day"}
              </p>
              {day ? (
                <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
                  {(byDay.get(day) ?? []).map((s) => (
                    <li key={s} className="flex gap-1.5">
                      <button
                        type="button"
                        aria-pressed={slot === s}
                        onClick={() => setSlot(s)}
                        className={cn(
                          "h-9 flex-1 rounded-crm border text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                          slot === s
                            ? "border-crm-primary bg-crm-muted text-crm-fg"
                            : "border-crm-primary/40 text-crm-primary hover:border-crm-primary",
                        )}
                      >
                        {timeFmt(s)}
                      </button>
                      {slot === s ? (
                        <Button variant="primary" size="lg" onClick={() => setStep("details")}>
                          Next
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
