import * as React from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";
import type { CronFieldSpec, CronFieldValue } from "@/components/crm/pro-cron-builder/cron-model";

type Kind = CronFieldValue["kind"];

const KINDS: { kind: Exclude<Kind, "raw">; label: string }[] = [
  { kind: "every", label: "Every" },
  { kind: "step", label: "Interval" },
  { kind: "specific", label: "Specific" },
  { kind: "range", label: "Range" },
];

const itemCls = cn(
  "inline-flex h-7 items-center justify-center rounded-crm px-2.5 text-xs font-medium text-crm-muted-fg",
  "outline-none transition-colors hover:bg-crm-muted hover:text-crm-fg",
  "focus-visible:ring-2 focus-visible:ring-crm-ring/60",
  "data-[state=on]:bg-crm-primary data-[state=on]:text-crm-primary-fg",
  "disabled:pointer-events-none disabled:opacity-50",
);

const numberCls = cn(
  "h-7 w-16 rounded-crm border border-crm-border bg-crm-bg px-2 text-xs text-crm-fg tabular-nums",
  "outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-50",
  "aria-[invalid=true]:border-crm-danger",
);

function defaultFor(kind: Kind, spec: CronFieldSpec, prev: CronFieldValue): CronFieldValue {
  switch (kind) {
    case "every":
      return { kind: "every" };
    case "step":
      return { kind: "step", step: spec.key === "minute" ? 15 : 2, start: spec.min };
    case "specific":
      return prev.kind === "range"
        ? { kind: "specific", values: [prev.from, prev.to] }
        : { kind: "specific", values: [spec.min] };
    case "range":
      return { kind: "range", from: spec.min, to: Math.min(spec.max, spec.min + 4) };
    case "raw":
      return { kind: "raw", text: "*" };
  }
}

function label(spec: CronFieldSpec, n: number) {
  return spec.names ? spec.names[n - spec.min]! : String(n);
}

export interface CronFieldEditorProps {
  spec: CronFieldSpec;
  value: CronFieldValue;
  onChange: (value: CronFieldValue) => void;
  error?: string;
  disabled?: boolean;
  idPrefix: string;
}

/** Editor for one cron field: mode toggle + the inputs that mode needs. */
export const CronFieldEditor = React.memo(function CronFieldEditor({
  spec,
  value,
  onChange,
  error,
  disabled,
  idPrefix,
}: CronFieldEditorProps) {
  const id = `${idPrefix}-${spec.key}`;
  const errId = `${id}-err`;
  const values = React.useMemo(
    () => Array.from({ length: spec.max - spec.min + 1 }, (_, i) => spec.min + i),
    [spec],
  );

  return (
    <fieldset
      className="grid gap-2 border-t border-crm-border py-3 first:border-t-0 sm:grid-cols-[120px_1fr]"
      disabled={disabled}
      aria-describedby={error ? errId : undefined}
    >
      <legend className="sr-only">{spec.label}</legend>
      <div aria-hidden className="pt-1 text-xs font-medium text-crm-fg">
        {spec.label}
      </div>
      <div className="grid min-w-0 gap-2">
        <ToggleGroup.Root
          type="single"
          value={value.kind === "raw" ? "" : value.kind}
          onValueChange={(k) => k && onChange(defaultFor(k as Kind, spec, value))}
          aria-label={`${spec.label} mode`}
          className="inline-flex w-fit flex-wrap gap-1 rounded-crm bg-crm-raised p-0.5 shadow-crm-raised"
          disabled={disabled}
        >
          {KINDS.map((k) => (
            <ToggleGroup.Item key={k.kind} value={k.kind} className={itemCls}>
              {k.label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>

        {value.kind === "every" && (
          <p className="text-xs text-crm-muted-fg">Every {spec.label.toLowerCase()}</p>
        )}

        {value.kind === "step" && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-crm-muted-fg">
            <label htmlFor={`${id}-step`}>Every</label>
            <NumberField
              id={`${id}-step`}
              min={1}
              max={spec.max - spec.min + 1}
              value={value.step}
              invalid={!!error}
              onCommit={(step) => onChange({ ...value, step })}
            />
            <span>{spec.unit}, starting at</span>
            <NumberField
              id={`${id}-start`}
              ariaLabel={`${spec.label} start`}
              min={spec.min}
              max={spec.max}
              value={value.start}
              invalid={!!error}
              onCommit={(start) => onChange({ ...value, start })}
            />
          </div>
        )}

        {value.kind === "range" && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-crm-muted-fg">
            <label htmlFor={`${id}-from`}>From</label>
            <RangeInput
              id={`${id}-from`}
              spec={spec}
              value={value.from}
              invalid={!!error}
              onChange={(from) => onChange({ ...value, from })}
            />
            <label htmlFor={`${id}-to`}>to</label>
            <RangeInput
              id={`${id}-to`}
              spec={spec}
              value={value.to}
              invalid={!!error}
              onChange={(to) => onChange({ ...value, to })}
            />
          </div>
        )}

        {value.kind === "specific" && (
          <ToggleGroup.Root
            type="multiple"
            value={value.values.map(String)}
            onValueChange={(vals) =>
              onChange({ kind: "specific", values: vals.map(Number).sort((a, b) => a - b) })
            }
            aria-label={`${spec.label} values`}
            className={cn(
              "grid gap-1",
              spec.names
                ? "grid-cols-4 sm:grid-cols-7"
                : values.length > 31
                  ? "grid-cols-6 sm:grid-cols-12"
                  : "grid-cols-7 sm:grid-cols-12",
            )}
          >
            {values.map((n) => (
              <ToggleGroup.Item
                key={n}
                value={String(n)}
                aria-label={spec.names ? spec.names[n - spec.min] : `${spec.label} ${n}`}
                className={cn(itemCls, "px-0 tabular-nums bg-crm-bg shadow-crm-raised")}
              >
                {label(spec, n)}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        )}

        {value.kind === "raw" && (
          <p className="text-xs text-crm-muted-fg">
            Advanced syntax{" "}
            <code className="rounded bg-crm-muted px-1 text-crm-fg">{value.text}</code> — edit it in
            the expression field or pick a mode to replace it.
          </p>
        )}

        {error ? (
          <p id={errId} role="alert" className="text-xs text-crm-danger">
            {error}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
});

function RangeInput({
  id,
  spec,
  value,
  invalid,
  onChange,
}: {
  id: string;
  spec: CronFieldSpec;
  value: number;
  invalid: boolean;
  onChange: (n: number) => void;
}) {
  if (spec.names) {
    return (
      <select
        id={id}
        value={value}
        aria-invalid={invalid}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(numberCls, "w-20")}
      >
        {spec.names.map((n, i) => (
          <option key={n} value={i + spec.min}>
            {n}
          </option>
        ))}
      </select>
    );
  }
  return (
    <NumberField
      id={id}
      min={spec.min}
      max={spec.max}
      value={value}
      invalid={invalid}
      onCommit={onChange}
    />
  );
}

/** Integer input with a local draft so clearing it mid-edit never corrupts the expression. */
function NumberField({
  id,
  ariaLabel,
  min,
  max,
  value,
  invalid,
  onCommit,
}: {
  id: string;
  ariaLabel?: string;
  min: number;
  max: number;
  value: number;
  invalid: boolean;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = React.useState(String(value));
  React.useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      aria-label={ariaLabel}
      min={min}
      max={max}
      value={draft}
      aria-invalid={invalid}
      onChange={(e) => {
        setDraft(e.target.value);
        if (/^\d+$/.test(e.target.value)) onCommit(Number(e.target.value));
      }}
      onBlur={() => setDraft(String(value))}
      className={numberCls}
    />
  );
}
