import * as React from "react";
import { BellRing, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UsageMeter } from "@/components/crm/pro-usage-metering-dashboard/types";

/** Edits alert thresholds (percent of limit) for every metered, limited meter. */
export function ThresholdEditor({
  meters,
  value,
  onChange,
  disabled,
}: {
  meters: UsageMeter[];
  value: Record<string, number[]>;
  onChange: (next: Record<string, number[]>) => void;
  disabled?: boolean;
}) {
  const limited = meters.filter((m) => m.limit !== undefined);
  if (!limited.length) {
    return (
      <p className="text-xs text-crm-muted-fg">
        No meters have limits, so there is nothing to alert on.
      </p>
    );
  }
  return (
    <ul className="space-y-3" aria-label="Alert thresholds">
      {limited.map((m) => (
        <MeterThresholds
          key={m.id}
          meter={m}
          thresholds={value[m.id] ?? m.alertThresholds ?? []}
          disabled={disabled}
          onChange={(t) => onChange({ ...value, [m.id]: t })}
        />
      ))}
    </ul>
  );
}

function MeterThresholds({
  meter,
  thresholds,
  onChange,
  disabled,
}: {
  meter: UsageMeter;
  thresholds: number[];
  onChange: (t: number[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const inputId = React.useId();
  const errId = `${inputId}-err`;
  const sorted = React.useMemo(() => [...thresholds].sort((a, b) => a - b), [thresholds]);

  const add = () => {
    const n = Number(draft);
    if (!draft.trim() || !Number.isFinite(n) || n <= 0 || n > 200) {
      setError("Enter a percentage between 1 and 200.");
      return;
    }
    const f = Math.round(n) / 100;
    if (sorted.includes(f)) {
      setError(`${Math.round(n)}% already exists.`);
      return;
    }
    if (sorted.length >= 6) {
      setError("Up to 6 thresholds per meter.");
      return;
    }
    onChange([...sorted, f]);
    setDraft("");
    setError(null);
  };

  return (
    <li className="rounded-crm border border-crm-border bg-crm-raised p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-crm-fg">
        <BellRing className="h-3.5 w-3.5 text-crm-icon" aria-hidden />
        {meter.name}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {sorted.length === 0 && <span className="text-[11px] text-crm-muted-fg">No alerts</span>}
        {sorted.map((t) => (
          <span
            key={t}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] tabular-nums",
              t >= 1
                ? "border-crm-danger/50 text-crm-danger"
                : "border-crm-warning/50 text-crm-warning",
            )}
          >
            {Math.round(t * 100)}%
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove ${Math.round(t * 100)}% alert for ${meter.name}`}
              onClick={() => onChange(sorted.filter((x) => x !== t))}
              className="rounded-full hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring disabled:opacity-40"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <form
          className="ml-auto flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            New alert threshold percent for {meter.name}
          </label>
          <input
            id={inputId}
            inputMode="numeric"
            placeholder="%"
            value={draft}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? errId : undefined}
            onChange={(e) => {
              setDraft(e.target.value.replace(/[^\d.]/g, ""));
              setError(null);
            }}
            className="h-6 w-14 rounded-crm border border-crm-input bg-crm-bg px-2 text-[11px] text-crm-fg placeholder:text-crm-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring aria-[invalid=true]:border-crm-danger"
          />
          <button
            type="submit"
            disabled={disabled}
            aria-label={`Add alert for ${meter.name}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-crm bg-crm-muted text-crm-fg hover:bg-crm-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
          </button>
        </form>
      </div>
      {error && (
        <p id={errId} role="alert" className="mt-1.5 text-[11px] text-crm-danger">
          {error}
        </p>
      )}
    </li>
  );
}
