import * as React from "react";
import { Camera, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { FormField, Input } from "@/components/crm/input";
import { SettingsGroup, SettingsRow } from "@/components/crm/settings-row";
import { Switch } from "@/components/crm/switch";
import { Textarea } from "@/components/crm/textarea";

export interface ProfileSettings {
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  phone: string;
  avatarUrl?: string;
  timezone: string;
  /** "HH:MM" 24h. */
  workStart: string;
  workEnd: string;
  workDays: number[];
  signature: string;
  weeklyDigest: boolean;
  showCalendar: boolean;
}

export interface SettingsProfileProps {
  /** Saved values; the form resets to these on Discard and after a successful save. */
  initialValues: ProfileSettings;
  onSave: (values: ProfileSettings) => void | Promise<void>;
  /** Handle a picked avatar file; return the uploaded URL. */
  onUploadAvatar?: (file: File) => Promise<string>;
  timezones?: string[];
  loading?: boolean;
  className?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_TZ = [
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
];

function tzOffset(tz: string) {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? "";
  } catch {
    return "";
  }
}

export function validateProfile(v: ProfileSettings) {
  const e: Partial<Record<keyof ProfileSettings, string>> = {};
  if (!v.firstName.trim()) e.firstName = "First name is required";
  if (!v.lastName.trim()) e.lastName = "Last name is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim()))
    e.email = "Enter a valid email address";
  if (v.phone && !/^\+?[\d\s().-]{7,20}$/.test(v.phone))
    e.phone = "Use digits, spaces and + ( ) - only";
  if (v.workStart >= v.workEnd) e.workEnd = "End time must be after start time";
  if (!v.workDays.length) e.workDays = "Pick at least one working day";
  if (v.signature.length > 500) e.signature = "Signature is limited to 500 characters";
  return e;
}

/** Personal profile settings page: identity, avatar upload, timezone with live offset, working hours, signature, dirty-state save bar. */
export function SettingsProfile({
  initialValues,
  onSave,
  onUploadAvatar,
  timezones = DEFAULT_TZ,
  loading,
  className,
}: SettingsProfileProps) {
  const uid = React.useId();
  const [saved, setSaved] = React.useState(initialValues);
  const [v, setV] = React.useState(initialValues);
  const [submitted, setSubmitted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setSaved(initialValues);
    setV(initialValues);
  }, [initialValues]);

  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const errors = validateProfile(v);
  const show = (k: keyof ProfileSettings) => (submitted ? errors[k] : undefined);
  const set = <K extends keyof ProfileSettings>(k: K, val: ProfileSettings[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setStatus(null);
  };
  const fullName = `${v.firstName} ${v.lastName}`.trim() || "?";

  const hours = (() => {
    const [sh = 0, sm = 0] = v.workStart.split(":").map(Number);
    const [eh = 0, em = 0] = v.workEnd.split(":").map(Number);
    const perDay = Math.max(0, eh * 60 + em - (sh * 60 + sm)) / 60;
    return Math.round(perDay * v.workDays.length * 10) / 10;
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) {
      setStatus({ ok: false, msg: "Fix the highlighted fields." });
      return;
    }
    setSaving(true);
    try {
      await onSave(v);
      setSaved(v);
      setSubmitted(false);
      setStatus({ ok: true, msg: "Profile saved" });
    } catch (x) {
      setStatus({ ok: false, msg: (x as Error).message || "Couldn't save. Try again." });
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = async (file?: File) => {
    if (!file || !onUploadAvatar) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type))
      return setStatus({ ok: false, msg: "Avatar must be PNG, JPG, WEBP or GIF." });
    if (file.size > 2 * 1024 * 1024)
      return setStatus({ ok: false, msg: "Avatar must be under 2 MB." });
    setUploading(true);
    try {
      set("avatarUrl", await onUploadAvatar(file));
    } catch {
      setStatus({ ok: false, msg: "Upload failed." });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex flex-col gap-3", className)} aria-busy>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-crm bg-crm-muted" />
        ))}
      </div>
    );
  }

  const fieldProps = (k: keyof ProfileSettings, id: string) => ({
    id,
    invalid: !!show(k),
    "aria-describedby": show(k) ? `${id}-msg` : undefined,
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="Profile settings"
      className={cn("flex flex-col gap-5 font-crm text-crm-fg", className)}
    >
      <section className="flex flex-wrap items-center gap-4 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
        <Avatar name={fullName} src={v.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{fullName}</p>
          <p className="text-xs text-crm-soft">
            {v.title || "No title"} · {v.email}
          </p>
        </div>
        {onUploadAvatar ? (
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => pickAvatar(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="size-3" aria-hidden /> Change photo
            </Button>
            {v.avatarUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set("avatarUrl", undefined)}
              >
                <Trash2 className="size-3" aria-hidden /> Remove
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised sm:grid-cols-2">
        <h3 className="crm-eyebrow text-crm-subtle sm:col-span-2">Personal info</h3>
        <FormField
          label="First name"
          htmlFor={`${uid}-sp-first`}
          required
          error={show("firstName")}
        >
          <Input
            {...fieldProps("firstName", `${uid}-sp-first`)}
            value={v.firstName}
            autoComplete="given-name"
            onChange={(e) => set("firstName", e.target.value)}
          />
        </FormField>
        <FormField label="Last name" htmlFor={`${uid}-sp-last`} required error={show("lastName")}>
          <Input
            {...fieldProps("lastName", `${uid}-sp-last`)}
            value={v.lastName}
            autoComplete="family-name"
            onChange={(e) => set("lastName", e.target.value)}
          />
        </FormField>
        <FormField
          label="Work email"
          htmlFor={`${uid}-sp-email`}
          required
          error={show("email")}
          hint={
            v.email !== saved.email && !show("email")
              ? "We'll send a verification link to the new address."
              : undefined
          }
        >
          <Input
            {...fieldProps("email", `${uid}-sp-email`)}
            type="email"
            value={v.email}
            autoComplete="email"
            onChange={(e) => set("email", e.target.value)}
          />
        </FormField>
        <FormField label="Phone" htmlFor={`${uid}-sp-phone`} error={show("phone")}>
          <Input
            {...fieldProps("phone", `${uid}-sp-phone`)}
            type="tel"
            value={v.phone}
            autoComplete="tel"
            onChange={(e) => set("phone", e.target.value)}
          />
        </FormField>
        <FormField label="Job title" htmlFor={`${uid}-sp-title`} className="sm:col-span-2">
          <Input
            id={`${uid}-sp-title`}
            value={v.title}
            autoComplete="organization-title"
            onChange={(e) => set("title", e.target.value)}
          />
        </FormField>
      </section>

      <SettingsGroup heading="Working hours">
        <SettingsRow
          label="Time zone"
          description="Used for meeting links, reminders and SLA clocks."
          htmlFor={`${uid}-sp-tz`}
          control={
            <select
              id={`${uid}-sp-tz`}
              value={v.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              className="h-8 max-w-60 rounded-crm border border-crm-border bg-crm-bg px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              {(timezones.includes(v.timezone) ? timezones : [v.timezone, ...timezones]).map(
                (tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")} ({tzOffset(tz)})
                  </option>
                ),
              )}
            </select>
          }
        />
        <SettingsRow
          label="Hours"
          description={
            show("workEnd") ? (
              <span className="text-crm-danger">{show("workEnd")}</span>
            ) : (
              `${hours} h / week bookable`
            )
          }
          control={
            <span className="flex items-center gap-1.5 text-sm">
              <input
                type="time"
                aria-label="Start time"
                value={v.workStart}
                onChange={(e) => set("workStart", e.target.value)}
                className="h-8 rounded-crm border border-crm-border bg-crm-bg px-2"
              />
              –
              <input
                type="time"
                aria-label="End time"
                aria-invalid={!!show("workEnd") || undefined}
                value={v.workEnd}
                onChange={(e) => set("workEnd", e.target.value)}
                className="h-8 rounded-crm border border-crm-border bg-crm-bg px-2 aria-[invalid=true]:border-crm-danger"
              />
            </span>
          }
        />
        <SettingsRow
          label="Working days"
          description={
            show("workDays") ? (
              <span className="text-crm-danger">{show("workDays")}</span>
            ) : undefined
          }
          control={
            <span role="group" aria-label="Working days" className="flex gap-1">
              {DAYS.map((d, i) => {
                const on = v.workDays.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set(
                        "workDays",
                        on ? v.workDays.filter((x) => x !== i) : [...v.workDays, i].sort(),
                      )
                    }
                    className={cn(
                      "h-7 w-9 rounded-crm border text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                      on
                        ? "border-crm-primary bg-crm-primary/15 text-crm-fg"
                        : "border-crm-border text-crm-soft",
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </span>
          }
        />
        <SettingsRow
          label="Show my calendar to teammates"
          description="Free/busy only, never event details."
          control={
            <Switch
              checked={v.showCalendar}
              onCheckedChange={(c) => set("showCalendar", c)}
              aria-label="Show my calendar to teammates"
            />
          }
        />
        <SettingsRow
          label="Weekly pipeline digest"
          description="Monday 8:00 in your time zone."
          control={
            <Switch
              checked={v.weeklyDigest}
              onCheckedChange={(c) => set("weeklyDigest", c)}
              aria-label="Weekly pipeline digest"
            />
          }
        />
      </SettingsGroup>

      <section className="rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
        <FormField label="Email signature" htmlFor={`${uid}-sp-sig`} error={show("signature")}>
          <Textarea
            id={`${uid}-sp-sig`}
            value={v.signature}
            onChange={(e) => set("signature", e.target.value)}
            showCount
            maxLength={500}
            autoResize
            maxRows={8}
            invalid={!!show("signature")}
          />
        </FormField>
      </section>

      <div className="sticky bottom-0 flex items-center gap-3 rounded-crm border border-crm-border bg-crm-raised p-3 shadow-crm-raised">
        <p
          aria-live="polite"
          className={cn(
            "text-xs",
            status ? (status.ok ? "text-crm-success" : "text-crm-danger") : "text-crm-soft",
          )}
        >
          {status?.msg ?? (dirty ? "You have unsaved changes" : "All changes saved")}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          disabled={!dirty || saving}
          onClick={() => {
            setV(saved);
            setSubmitted(false);
            setStatus(null);
          }}
        >
          Discard
        </Button>
        <Button type="submit" size="sm" loading={saving} disabled={!dirty || saving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
