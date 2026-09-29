import * as React from "react";
import { DayPicker } from "react-day-picker";
import { TZDate } from "@date-fns/tz";
import { addDays, format, isBefore, nextMonday } from "date-fns";
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { CalendarClock, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleValue } from "@/components/crm/pro-email-composer/types";

const FALLBACK_ZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

function allZones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    return intl.supportedValuesOf?.("timeZone") ?? FALLBACK_ZONES;
  } catch {
    return FALLBACK_ZONES;
  }
}

/** "GMT-4" style short offset label for a zone at an instant. */
function zoneAbbr(zone: string, at: Date): string {
  try {
    return (
      new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" })
        .formatToParts(at)
        .find((p) => p.type === "timeZoneName")?.value ?? zone
    );
  } catch {
    return zone;
  }
}

const TIMES = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return { value: h * 60 + m, label: format(new Date(2000, 0, 1, h, m), "h:mm a") };
});

/** Wall-clock parts of `instant` in `zone`. */
function partsIn(instant: Date, zone: string) {
  const d = new TZDate(instant.getTime(), zone);
  return {
    day: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    minutes: d.getHours() * 60 + d.getMinutes(),
  };
}

function instantFrom(day: Date, minutes: number, zone: string): Date {
  const t = new TZDate(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
    zone,
  );
  return new Date(t.getTime());
}

export interface SendLaterPickerProps {
  value: ScheduleValue | null;
  onChange: (next: ScheduleValue | null) => void;
  /** Default zone (e.g. the recipient's). Falls back to the browser zone. */
  defaultTimeZone?: string;
  /** Injectable clock for tests / SSR. */
  now?: Date;
  disabled?: boolean;
}

/** Popover to schedule a send: presets, calendar, 15-minute times, and an IANA time zone. */
export function SendLaterPicker({
  value,
  onChange,
  defaultTimeZone,
  now: nowProp,
  disabled,
}: SendLaterPickerProps) {
  const browserZone = React.useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const zones = React.useMemo(allZones, []);
  const [open, setOpen] = React.useState(false);
  const now = nowProp ?? new Date();
  const [zone, setZone] = React.useState(value?.timeZone ?? defaultTimeZone ?? browserZone);
  const initial = value ? partsIn(value.sendAt, zone) : null;
  const [day, setDay] = React.useState<Date | undefined>(initial?.day);
  const [minutes, setMinutes] = React.useState(initial?.minutes ?? 9 * 60);

  React.useEffect(() => {
    if (!open) return;
    const z = value?.timeZone ?? defaultTimeZone ?? browserZone;
    setZone(z);
    if (value) {
      const p = partsIn(value.sendAt, z);
      setDay(p.day);
      setMinutes(p.minutes);
    }
  }, [open, value, defaultTimeZone, browserZone]);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "top-end",
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context, { enabled: !disabled }),
    useDismiss(context),
    useRole(context, { role: "dialog" }),
  ]);

  const today = partsIn(now, zone).day;
  const candidate = day ? instantFrom(day, minutes, zone) : null;
  const inPast = candidate ? isBefore(candidate, now) : false;

  const presets = React.useMemo(() => {
    const t = partsIn(now, zone).day;
    return [
      { label: "Tomorrow morning", day: addDays(t, 1), minutes: 8 * 60 },
      { label: "Tomorrow afternoon", day: addDays(t, 1), minutes: 13 * 60 },
      { label: "Monday morning", day: nextMonday(t), minutes: 9 * 60 },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, now.toDateString()]);

  const confirm = () => {
    if (!candidate || inPast) return;
    onChange({ sendAt: candidate, timeZone: zone });
    setOpen(false);
  };

  const summary = value
    ? `${format(new TZDate(value.sendAt.getTime(), value.timeZone), "EEE, MMM d, h:mm a")} ${zoneAbbr(value.timeZone, value.sendAt)}`
    : "Send later";

  return (
    <div className="flex items-center">
      <button
        ref={refs.setReference}
        type="button"
        disabled={disabled}
        {...getReferenceProps()}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-crm-input px-2.5 text-sm text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none disabled:opacity-50",
          value && "border-crm-primary/60 text-crm-fg",
        )}
      >
        <CalendarClock className="size-4" aria-hidden />
        <span className="max-w-[14rem] truncate">{summary}</span>
        <ChevronDown className="size-3.5 opacity-60" aria-hidden />
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          aria-label="Clear schedule, send now"
          className="ml-1 grid size-8 place-items-center rounded-[6px] text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
        >
          <X className="size-4" />
        </button>
      )}
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              aria-label="Schedule send"
              className="z-50 w-[20rem] rounded-crm border border-crm-border bg-crm-popover p-3 font-crm text-crm-fg shadow-crm-overlay"
            >
              <div className="mb-2 flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setDay(p.day);
                      setMinutes(p.minutes);
                    }}
                    className="rounded-full border border-crm-border px-2 py-0.5 text-xs text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <DayPicker
                mode="single"
                selected={day}
                onSelect={setDay}
                defaultMonth={day ?? today}
                disabled={{ before: today }}
                weekStartsOn={1}
                classNames={{
                  root: "text-sm",
                  months: "relative",
                  month_caption: "flex h-8 items-center px-1 font-medium",
                  nav: "absolute top-0 right-0 flex gap-1",
                  button_previous:
                    "grid size-8 place-items-center rounded-[6px] text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg disabled:opacity-30",
                  button_next:
                    "grid size-8 place-items-center rounded-[6px] text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg disabled:opacity-30",
                  chevron: "size-4 fill-current",
                  month_grid: "w-full border-collapse",
                  weekdays: "text-crm-subtle",
                  weekday: "h-7 text-center text-xs font-normal",
                  day: "p-0 text-center",
                  day_button:
                    "mx-auto grid size-8 place-items-center rounded-[6px] hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none",
                  selected: "[&>button]:bg-crm-primary [&>button]:text-crm-primary-fg",
                  today: "[&>button]:font-semibold [&>button]:text-crm-status",
                  outside: "text-crm-faint",
                  disabled: "text-crm-faint [&>button]:pointer-events-none",
                }}
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs text-crm-muted-fg">
                  Time
                  <select
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    className="h-8 rounded-[6px] border border-crm-input bg-crm-bg px-1.5 text-sm text-crm-fg outline-none focus:border-crm-ring"
                  >
                    {TIMES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-crm-muted-fg">
                  Time zone
                  <select
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    className="h-8 rounded-[6px] border border-crm-input bg-crm-bg px-1.5 text-sm text-crm-fg outline-none focus:border-crm-ring"
                  >
                    {!zones.includes(zone) && <option value={zone}>{zone}</option>}
                    {zones.map((z) => (
                      <option key={z} value={z}>
                        {z.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-2 min-h-8 text-xs text-crm-muted-fg" aria-live="polite">
                {!candidate
                  ? "Pick a day."
                  : inPast
                    ? "That time has already passed in this time zone."
                    : `Sends ${format(new TZDate(candidate.getTime(), zone), "EEE, MMM d 'at' h:mm a")} ${zoneAbbr(zone, candidate)}` +
                      (zone !== browserZone
                        ? ` (${format(candidate, "EEE h:mm a")} your time)`
                        : "")}
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-8 rounded-[6px] px-3 text-sm text-crm-soft hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={!candidate || inPast}
                  className="h-8 rounded-[6px] bg-crm-primary px-3 text-sm font-medium text-crm-primary-fg shadow-crm-primary focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none disabled:opacity-40"
                >
                  Schedule
                </button>
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </div>
  );
}
