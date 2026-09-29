import * as React from "react";
import { Command } from "cmdk";
import { DayPicker, type DateRange } from "react-day-picker";
import { format, startOfMonth, startOfQuarter, subDays } from "date-fns";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { OPERATORS, parseDay, toDay } from "@/components/crm/pro-filter-bar/operators";
import type {
  FilterCondition,
  FilterField,
  FilterOption,
} from "@/components/crm/pro-filter-bar/types";

export interface ValueEditorProps {
  field: FilterField<never>;
  condition: FilterCondition;
  options: FilterOption[];
  counts?: Map<string, number>;
  onChange: (values: string[]) => void;
  /** Close the popover (Enter in single-value editors). */
  onDone: () => void;
}

const inputCls =
  "h-8 w-full rounded-crm border border-crm-border bg-crm-bg px-2.5 text-[13px] text-crm-fg placeholder:text-crm-subtle outline-none focus-visible:border-crm-ring";
const nf = new Intl.NumberFormat();

/** Routes to the editor for the field type and operator. */
export function ValueEditor(props: ValueEditorProps) {
  const { field, condition } = props;
  if (OPERATORS[condition.operator].arity === 0)
    return <p className="px-3 py-2.5 text-xs text-crm-muted-fg">This operator takes no value.</p>;
  switch (field.type) {
    case "enum":
      return <EnumEditor {...props} />;
    case "boolean":
      return <EnumEditor {...props} single />;
    case "number":
      return <NumberEditor {...props} />;
    case "date":
      return <DateEditor {...props} />;
    default:
      return <TextEditor {...props} />;
  }
}

// ---------------------------------------------------------------- enum

function EnumEditor({
  options,
  counts,
  condition,
  onChange,
  onDone,
  single,
}: ValueEditorProps & { single?: boolean }) {
  const selected = React.useMemo(() => new Set(condition.values), [condition.values]);
  const toggle = (v: string) => {
    if (single) {
      onChange([v]);
      onDone();
      return;
    }
    onChange(selected.has(v) ? condition.values.filter((x) => x !== v) : [...condition.values, v]);
  };
  // Selected first, then by live count so the most useful options stay on top.
  const sorted = React.useMemo(
    () =>
      [...options].sort(
        (a, b) =>
          Number(selected.has(b.value)) - Number(selected.has(a.value)) ||
          (counts ? (counts.get(b.value) ?? 0) - (counts.get(a.value) ?? 0) : 0),
      ),
    // Keep the order stable while the popover is open: only re-sort when options change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options],
  );
  return (
    <Command loop tabIndex={-1} className="flex max-h-80 w-64 flex-col outline-none" label="Values">
      {options.length > 7 && (
        <div className="border-b border-crm-border p-1.5">
          <Command.Input placeholder="Search values…" className={inputCls} />
        </div>
      )}
      <Command.List className="overflow-y-auto p-1">
        <Command.Empty className="px-2 py-3 text-center text-xs text-crm-muted-fg">
          No matching values
        </Command.Empty>
        {sorted.map((o) => {
          const on = selected.has(o.value);
          const n = counts?.get(o.value) ?? 0;
          return (
            <Command.Item
              key={o.value}
              value={`${o.label} ${o.value}`}
              keywords={o.keywords ? [o.keywords] : undefined}
              onSelect={() => toggle(o.value)}
              aria-selected={on}
              className="flex h-8 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-[13px] text-crm-chip data-[selected=true]:bg-crm-muted data-[selected=true]:text-crm-fg"
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border",
                  single && "rounded-full",
                  on ? "border-crm-primary bg-crm-primary text-crm-primary-fg" : "border-crm-input",
                )}
              >
                {on && <Check className="size-2.5" strokeWidth={3} />}
              </span>
              {o.icon}
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {counts && (
                <span
                  className={cn("text-xs tabular-nums", n ? "text-crm-muted-fg" : "text-crm-faint")}
                >
                  {nf.format(n)}
                </span>
              )}
            </Command.Item>
          );
        })}
      </Command.List>
      {!single && condition.values.length > 0 && (
        <div className="flex items-center justify-between border-t border-crm-border px-2.5 py-1.5 text-xs">
          <span className="text-crm-muted-fg">{condition.values.length} selected</span>
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded px-1.5 py-0.5 text-crm-soft hover:bg-crm-muted hover:text-crm-fg"
          >
            Clear
          </button>
        </div>
      )}
    </Command>
  );
}

// ---------------------------------------------------------------- text

function TextEditor({ field, condition, onChange, onDone }: ValueEditorProps) {
  const [draft, setDraft] = React.useState(condition.values[0] ?? "");
  return (
    <form
      className="w-64 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        onChange(draft ? [draft] : []);
        onDone();
      }}
    >
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onChange(draft ? [draft] : [])}
        placeholder={`${field.label}…`}
        aria-label={`${field.label} value`}
        className={inputCls}
      />
      <p className="mt-1.5 text-[11px] text-crm-subtle">Press Enter to apply</p>
    </form>
  );
}

// ---------------------------------------------------------------- number

function NumberEditor({ field, condition, onChange, onDone }: ValueEditorProps) {
  const range = condition.operator === "between";
  const [a, setA] = React.useState(condition.values[0] ?? "");
  const [b, setB] = React.useState(condition.values[1] ?? "");
  const valid = (s: string) => s !== "" && Number.isFinite(Number(s));
  const apply = () => onChange(range ? (valid(a) && valid(b) ? [a, b] : []) : valid(a) ? [a] : []);
  return (
    <form
      className="w-64 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
        onDone();
      }}
    >
      <div className="flex items-center gap-2">
        <input
          autoFocus
          inputMode="decimal"
          value={a}
          onChange={(e) => setA(e.target.value)}
          onBlur={apply}
          placeholder={range ? "Min" : "Value"}
          aria-label={range ? `${field.label} minimum` : `${field.label} value`}
          aria-invalid={a !== "" && !valid(a)}
          className={cn(inputCls, "aria-invalid:border-crm-danger")}
        />
        {range && (
          <>
            <span className="text-xs text-crm-subtle">and</span>
            <input
              inputMode="decimal"
              value={b}
              onChange={(e) => setB(e.target.value)}
              onBlur={apply}
              placeholder="Max"
              aria-label={`${field.label} maximum`}
              aria-invalid={b !== "" && !valid(b)}
              className={cn(inputCls, "aria-invalid:border-crm-danger")}
            />
          </>
        )}
      </div>
      {valid(a) && field.format && (
        <p className="mt-1.5 text-[11px] text-crm-subtle">
          {field.format(Number(a))}
          {range && valid(b) ? ` – ${field.format(Number(b))}` : ""}
        </p>
      )}
    </form>
  );
}

// ---------------------------------------------------------------- date

const dayPickerClassNames = {
  root: "text-[13px] text-crm-fg",
  months: "relative flex",
  month: "flex flex-col gap-2",
  month_caption: "flex h-7 items-center px-1 font-medium",
  caption_label: "text-[13px]",
  nav: "absolute right-0 top-0 flex gap-1",
  button_previous:
    "flex size-7 items-center justify-center rounded-crm text-crm-soft hover:bg-crm-muted hover:text-crm-fg [&_svg]:size-3.5 [&_svg]:fill-current",
  button_next:
    "flex size-7 items-center justify-center rounded-crm text-crm-soft hover:bg-crm-muted hover:text-crm-fg [&_svg]:size-3.5 [&_svg]:fill-current",
  month_grid: "border-collapse",
  weekdays: "text-[11px] text-crm-subtle",
  weekday: "size-8 font-normal",
  day: "size-8 p-0 text-center",
  day_button:
    "size-8 rounded-crm outline-none hover:bg-crm-muted focus-visible:ring-1 focus-visible:ring-crm-ring",
  selected: "[&>button]:bg-crm-primary [&>button]:text-crm-primary-fg",
  range_middle: "[&>button]:!bg-crm-muted [&>button]:!text-crm-fg [&>button]:rounded-none",
  today: "font-semibold text-crm-status",
  outside: "text-crm-faint",
  disabled: "opacity-40",
};

const LAST_DAYS = [7, 14, 30, 90, 365];

function DateEditor({ condition, onChange, onDone }: ValueEditorProps) {
  const op = condition.operator;
  if (op === "last_days") {
    const current = condition.values[0] ?? "";
    return (
      <div className="w-64 p-2">
        <div className="grid grid-cols-5 gap-1">
          {LAST_DAYS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={current === String(n)}
              onClick={() => {
                onChange([String(n)]);
                onDone();
              }}
              className="h-7 rounded-crm border border-crm-border text-xs text-crm-soft hover:bg-crm-muted aria-pressed:border-crm-primary aria-pressed:text-crm-fg"
            >
              {n}d
            </button>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-crm-muted-fg">
          Custom
          <input
            type="number"
            min={1}
            defaultValue={current}
            onChange={(e) => onChange(e.target.value ? [String(Math.max(1, +e.target.value))] : [])}
            className={cn(inputCls, "w-20")}
            aria-label="Number of days"
          />
          days
        </label>
      </div>
    );
  }
  if (op === "within") {
    const from = parseDay(condition.values[0] ?? "") ?? undefined;
    const to = parseDay(condition.values[1] ?? "") ?? undefined;
    const today = new Date();
    const presets: [string, Date, Date][] = [
      ["Last 7 days", subDays(today, 6), today],
      ["Last 30 days", subDays(today, 29), today],
      ["Month to date", startOfMonth(today), today],
      ["Quarter to date", startOfQuarter(today), today],
    ];
    return (
      <div className="flex">
        <div className="flex w-36 flex-col gap-0.5 border-r border-crm-border p-1.5">
          {presets.map(([label, a, b]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                onChange([toDay(a), toDay(b)]);
                onDone();
              }}
              className="h-7 rounded-[6px] px-2 text-left text-xs text-crm-soft hover:bg-crm-muted hover:text-crm-fg"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-2">
          <DayPicker
            mode="range"
            selected={{ from, to } as DateRange}
            defaultMonth={from ?? today}
            onSelect={(r) =>
              onChange(
                r?.from && r.to ? [toDay(r.from), toDay(r.to)] : r?.from ? [toDay(r.from), ""] : [],
              )
            }
            classNames={dayPickerClassNames}
            showOutsideDays
          />
        </div>
      </div>
    );
  }
  const day = parseDay(condition.values[0] ?? "") ?? undefined;
  return (
    <div className="p-2">
      <DayPicker
        mode="single"
        selected={day}
        defaultMonth={day ?? new Date()}
        onSelect={(d) => {
          onChange(d ? [toDay(d)] : []);
          if (d) onDone();
        }}
        classNames={dayPickerClassNames}
        showOutsideDays
      />
    </div>
  );
}

/** Short text for the chip's value segment. */
export function describeValues(
  field: FilterField<never>,
  condition: FilterCondition,
  options: FilterOption[],
): string {
  const v = condition.values.filter(Boolean);
  if (!v.length) return "…";
  switch (field.type) {
    case "enum": {
      const label = (x: string) => options.find((o) => o.value === x)?.label ?? x;
      return v.length <= 2 ? v.map(label).join(", ") : `${v.length} values`;
    }
    case "boolean":
      return v[0] === "false" ? "No" : "Yes";
    case "number": {
      const f = field.format ?? ((n: number) => nf.format(n));
      return v.map((x) => f(Number(x))).join(" – ");
    }
    case "date": {
      if (condition.operator === "last_days") return `${v[0]} days`;
      return v
        .map((x) => {
          const d = parseDay(x);
          return d ? format(d, "MMM d, yyyy") : x;
        })
        .join(" – ");
    }
    default:
      return `“${v[0]}”`;
  }
}
