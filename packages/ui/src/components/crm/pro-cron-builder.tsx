import * as React from "react";
import { AlertCircle, CheckCircle2, Copy, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCronSchedule } from "@/hooks/use-cron-schedule";
import { CronFieldEditor } from "@/components/crm/pro-cron-builder/cron-field-editor";
import { CronNextRuns } from "@/components/crm/pro-cron-builder/cron-next-runs";
import {
  CRON_FIELD_SPECS,
  DEFAULT_CRON_PRESETS,
  normalizeExpression,
  type CronPreset,
} from "@/components/crm/pro-cron-builder/cron-model";

export {
  describeCron,
  getNextRuns,
  parseExpression,
  serializeFields,
  validateCron,
  type CronFields,
  type CronFieldValue,
  type CronPreset,
} from "@/components/crm/pro-cron-builder/cron-model";

export interface ProCronBuilderProps {
  /** Controlled five-field cron expression (macros like @daily are accepted). */
  value?: string;
  defaultValue?: string;
  onChange?: (expression: string, meta: { valid: boolean; error?: string }) => void;
  /** Controlled IANA timezone used for the next-run preview. */
  timezone?: string;
  defaultTimezone?: string;
  onTimezoneChange?: (tz: string) => void;
  /** Timezones offered in the picker. Defaults to Intl.supportedValuesOf("timeZone"). */
  timezones?: string[];
  /** How many upcoming runs to preview. */
  runCount?: number;
  presets?: CronPreset[] | false;
  use24HourTimeFormat?: boolean;
  disabled?: boolean;
  /** Accessible name / visible heading. */
  label?: string;
  idPrefix?: string;
  className?: string;
}

function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function allTimezones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    const list = intl.supportedValuesOf?.("timeZone");
    if (list?.length) return list.includes("UTC") ? list : ["UTC", ...list];
  } catch {
    /* older runtimes */
  }
  return ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Kolkata"];
}

/**
 * Visual cron editor kept in lock-step with the raw expression. Parsing and iteration by
 * cron-parser, descriptions by cronstrue, timezone formatting by date-fns + @date-fns/tz.
 */
export function ProCronBuilder({
  value,
  defaultValue,
  onChange,
  timezone,
  defaultTimezone,
  onTimezoneChange,
  timezones,
  runCount = 5,
  presets = DEFAULT_CRON_PRESETS,
  use24HourTimeFormat = true,
  disabled,
  label = "Schedule",
  idPrefix,
  className,
}: ProCronBuilderProps) {
  const autoId = React.useId().replace(/:/g, "");
  const prefix = idPrefix ?? `cron${autoId}`;
  const [innerTz, setInnerTz] = React.useState(() => defaultTimezone ?? localTimezone());
  const tz = timezone ?? innerTz;
  const tzOptions = React.useMemo(() => {
    const list = timezones ?? allTimezones();
    return list.includes(tz) ? list : [tz, ...list];
  }, [timezones, tz]);

  const cron = useCronSchedule({
    value,
    defaultValue,
    onChange,
    timezone: tz,
    runCount,
    use24HourTimeFormat,
  });

  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cron.expression);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const setTz = (next: string) => {
    if (timezone === undefined) setInnerTz(next);
    onTimezoneChange?.(next);
  };

  const rawId = `${prefix}-raw`;
  const statusId = `${prefix}-status`;
  const activePreset =
    presets &&
    presets.find((p) => normalizeExpression(p.expression) === normalizeExpression(cron.expression));

  return (
    <div
      role="group"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn(
        "grid gap-4 rounded-crm border border-crm-border bg-crm-card p-4 font-crm text-crm-fg shadow-crm-raised",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={rawId} className="text-sm font-medium">
            {label}
          </label>
          <button
            type="button"
            onClick={copy}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-crm px-1.5 py-0.5 text-xs text-crm-muted-fg outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            <Copy className="size-3" aria-hidden />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <input
          id={rawId}
          value={cron.expression}
          onChange={(e) => cron.setExpression(e.target.value)}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={!cron.validation.valid}
          aria-describedby={statusId}
          placeholder="* * * * *"
          className={cn(
            "h-10 rounded-crm border bg-crm-bg px-3 font-mono text-sm tracking-wide text-crm-fg outline-none",
            "focus-visible:ring-2 focus-visible:ring-crm-ring/60",
            cron.validation.valid ? "border-crm-border" : "border-crm-danger",
          )}
        />
        <div
          className="grid grid-cols-5 gap-1 px-1 font-mono text-[10px] uppercase text-crm-faint"
          aria-hidden
        >
          {CRON_FIELD_SPECS.map((s) => (
            <span key={s.key} className="truncate">
              {s.label}
            </span>
          ))}
        </div>
        <p
          id={statusId}
          aria-live="polite"
          className={cn(
            "flex items-start gap-1.5 text-xs",
            cron.validation.valid ? "text-crm-soft" : "text-crm-danger",
          )}
        >
          {cron.validation.valid ? (
            <CheckCircle2 className="mt-px size-3.5 shrink-0 text-crm-success" aria-hidden />
          ) : (
            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          )}
          {cron.validation.valid ? cron.description : cron.validation.error}
        </p>
      </div>

      {presets && presets.length ? (
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Presets">
          {presets.map((p) => (
            <button
              key={p.expression}
              type="button"
              role="listitem"
              disabled={disabled}
              aria-pressed={activePreset === p}
              onClick={() => cron.setExpression(p.expression)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                activePreset === p
                  ? "border-crm-primary bg-crm-primary/15 text-crm-fg"
                  : "border-crm-border text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 rounded-crm border border-crm-border bg-crm-raised px-3">
          {cron.fields ? (
            CRON_FIELD_SPECS.map((spec) => (
              <CronFieldEditor
                key={spec.key}
                spec={spec}
                value={cron.fields![spec.key]}
                error={cron.fieldErrors[spec.key]}
                onChange={(v) => cron.setField(spec.key, v)}
                disabled={disabled}
                idPrefix={prefix}
              />
            ))
          ) : (
            <p className="py-6 text-center text-xs text-crm-muted-fg">
              The visual editor supports five-field expressions. Edit the raw expression above, or
              pick a preset.
            </p>
          )}
        </div>
        <div className="grid content-start gap-3">
          <div className="grid gap-1">
            <label
              htmlFor={`${prefix}-tz`}
              className="flex items-center gap-1.5 text-xs font-medium"
            >
              <Globe className="size-3.5 text-crm-icon" aria-hidden />
              Timezone
            </label>
            <select
              id={`${prefix}-tz`}
              value={tz}
              disabled={disabled}
              onChange={(e) => setTz(e.target.value)}
              className="h-8 rounded-crm border border-crm-border bg-crm-bg px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              {tzOptions.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <CronNextRuns runs={cron.nextRuns} timezone={tz} invalid={!cron.validation.valid} />
        </div>
      </div>
    </div>
  );
}
