import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import { format, isValid, parseISO } from "date-fns";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import type { ValueEditorProps } from "react-querybuilder";
import { cn } from "@/lib/utils";
import {
  RELATIVE_OPERATORS,
  RELATIVE_UNITS,
  operatorArity,
  parseRelative,
  type QueryField,
  type QueryFieldOption,
} from "@/lib/pro-query-builder";

export interface QbContext {
  fieldsByName: Map<string, QueryField>;
  issues: Record<string, string>;
  showErrors: boolean;
}

export const inputCls =
  "h-[30px] min-w-0 rounded-crm border border-crm-input bg-crm-bg px-2 text-xs text-crm-fg outline-none placeholder:text-crm-subtle focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-50 aria-[invalid=true]:border-crm-danger";

const DAY_PICKER_CLASSES = {
  root: "p-2 text-xs text-crm-fg",
  months: "relative",
  month_caption: "flex h-7 items-center justify-center font-medium",
  nav: "absolute inset-x-0 top-0 flex h-7 items-center justify-between",
  button_previous:
    "grid size-7 place-items-center rounded-crm hover:bg-crm-muted [&_svg]:fill-crm-soft [&_svg]:size-3",
  button_next:
    "grid size-7 place-items-center rounded-crm hover:bg-crm-muted [&_svg]:fill-crm-soft [&_svg]:size-3",
  weekday: "size-8 text-[11px] font-normal text-crm-subtle",
  day: "size-8 p-0 text-center",
  day_button:
    "size-8 rounded-crm hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 outline-none",
  selected: "[&>button]:bg-crm-primary [&>button]:text-crm-primary-fg",
  today: "font-semibold text-crm-primary",
  outside: "text-crm-faint",
  disabled: "opacity-40",
};

function DateInput({
  value,
  onChange,
  disabled,
  invalid,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  label: string;
}) {
  const [open, setOpen] = React.useState(false);
  const date = value ? parseISO(value) : undefined;
  const valid = date && isValid(date);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        disabled={disabled}
        aria-label={label}
        aria-invalid={invalid || undefined}
        className={cn(inputCls, "inline-flex w-[132px] items-center gap-1.5 text-left")}
      >
        <CalendarDays className="size-3.5 shrink-0 text-crm-subtle" aria-hidden />
        <span className={cn("truncate", !valid && "text-crm-subtle")}>
          {valid ? format(date, "d MMM yyyy") : "Pick a date"}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-50 rounded-crm border border-crm-border bg-crm-popover shadow-crm-overlay"
        >
          <DayPicker
            mode="single"
            selected={valid ? date : undefined}
            defaultMonth={valid ? date : undefined}
            onSelect={(d) => {
              if (d) onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
            }}
            classNames={DAY_PICKER_CLASSES}
            autoFocus
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function MultiSelect({
  options,
  value,
  onChange,
  disabled,
  invalid,
  label,
}: {
  options: QueryFieldOption[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  label: string;
}) {
  const [query, setQuery] = React.useState("");
  const selected = React.useMemo(() => new Set(value), [value]);
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const summary =
    value.length === 0
      ? "Choose..."
      : value.length <= 2
        ? value.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ")
        : `${value.length} selected`;
  const toggle = (v: string) =>
    onChange(selected.has(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <Popover.Root onOpenChange={(o) => !o && setQuery("")}>
      <Popover.Trigger
        disabled={disabled}
        aria-label={label}
        aria-invalid={invalid || undefined}
        className={cn(
          inputCls,
          "inline-flex w-[170px] items-center justify-between gap-1.5 text-left",
        )}
      >
        <span className={cn("truncate", value.length === 0 && "text-crm-subtle")}>{summary}</span>
        <ChevronDown className="size-3.5 shrink-0 text-crm-subtle" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-50 w-56 rounded-crm border border-crm-border bg-crm-popover p-1 shadow-crm-overlay"
        >
          {options.length > 8 && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              aria-label="Search options"
              className={cn(inputCls, "mb-1 w-full")}
            />
          )}
          <div
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="max-h-60 overflow-auto"
          >
            {filtered.map((o) => {
              const on = selected.has(o.value);
              return (
                <div
                  key={o.value}
                  role="option"
                  aria-selected={on}
                  tabIndex={0}
                  onClick={() => toggle(o.value)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      toggle(o.value);
                    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const sib =
                        e.key === "ArrowDown"
                          ? e.currentTarget.nextElementSibling
                          : e.currentTarget.previousElementSibling;
                      (sib as HTMLElement | null)?.focus();
                    }
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-crm px-2 py-1.5 text-xs text-crm-fg outline-none hover:bg-crm-muted focus-visible:bg-crm-muted"
                >
                  <span
                    className={cn(
                      "grid size-3.5 place-items-center rounded-[3px] border border-crm-input",
                      on && "border-crm-primary bg-crm-primary",
                    )}
                  >
                    {on && <Check className="size-2.5 text-crm-primary-fg" aria-hidden />}
                  </span>
                  {o.label}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-crm-subtle">No matches</p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Typed value editor: dispatches on field type + operator arity. */
export function ProValueEditor(props: ValueEditorProps) {
  const { operator, value, handleOnChange, disabled, rule, context } = props;
  const ctx = context as QbContext;
  const field = ctx.fieldsByName.get(rule.field);
  const arity = operatorArity(field, operator);
  const issue = ctx.showErrors ? ctx.issues[rule.id ?? ""] : undefined;
  const invalid = !!issue;
  const label = `${field?.label ?? rule.field} value`;
  if (!field || arity === 0) return null;

  let editor: React.ReactNode;
  if (RELATIVE_OPERATORS.has(operator)) {
    const rel = parseRelative(value) ?? { amount: 0, unit: "days" as const };
    editor = (
      <span className="inline-flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          aria-label={`${label} amount`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={rel.amount || ""}
          onChange={(e) =>
            handleOnChange(`${Math.max(0, Math.floor(Number(e.target.value)))} ${rel.unit}`)
          }
          className={cn(inputCls, "w-16")}
        />
        <select
          aria-label={`${label} unit`}
          disabled={disabled}
          value={rel.unit}
          onChange={(e) => handleOnChange(`${rel.amount} ${e.target.value}`)}
          className={cn(inputCls, "pr-6")}
        >
          {RELATIVE_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </span>
    );
  } else if (arity === "list") {
    editor = (
      <MultiSelect
        options={field.options ?? []}
        value={Array.isArray(value) ? value : []}
        onChange={handleOnChange}
        disabled={disabled}
        invalid={invalid}
        label={label}
      />
    );
  } else if (arity === 2) {
    const pair: [string, string] = Array.isArray(value)
      ? [String(value[0] ?? ""), String(value[1] ?? "")]
      : ["", ""];
    const set = (i: 0 | 1, v: string) => handleOnChange(i === 0 ? [v, pair[1]] : [pair[0], v]);
    editor = (
      <span className="inline-flex items-center gap-1.5">
        {field.type === "date" ? (
          <>
            <DateInput
              value={pair[0]}
              onChange={(v) => set(0, v)}
              disabled={disabled}
              invalid={invalid}
              label={`${label} from`}
            />
            <span className="text-xs text-crm-subtle">and</span>
            <DateInput
              value={pair[1]}
              onChange={(v) => set(1, v)}
              disabled={disabled}
              invalid={invalid}
              label={`${label} to`}
            />
          </>
        ) : (
          <>
            <input
              type="number"
              aria-label={`${label} from`}
              aria-invalid={invalid || undefined}
              disabled={disabled}
              value={pair[0]}
              onChange={(e) => set(0, e.target.value)}
              className={cn(inputCls, "w-24")}
            />
            <span className="text-xs text-crm-subtle">and</span>
            <input
              type="number"
              aria-label={`${label} to`}
              aria-invalid={invalid || undefined}
              disabled={disabled}
              value={pair[1]}
              onChange={(e) => set(1, e.target.value)}
              className={cn(inputCls, "w-24")}
            />
          </>
        )}
      </span>
    );
  } else if (field.type === "date") {
    editor = (
      <DateInput
        value={String(value ?? "")}
        onChange={handleOnChange}
        disabled={disabled}
        invalid={invalid}
        label={label}
      />
    );
  } else if (field.type === "select" || field.type === "boolean") {
    const opts =
      field.type === "boolean"
        ? [
            { value: "true", label: "True" },
            { value: "false", label: "False" },
          ]
        : (field.options ?? []);
    editor = (
      <select
        aria-label={label}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        value={String(value ?? "")}
        onChange={(e) => handleOnChange(e.target.value)}
        className={cn(inputCls, "w-[150px]")}
      >
        <option value="" disabled>
          Choose...
        </option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else {
    editor = (
      <input
        type={field.type === "number" ? "number" : "text"}
        aria-label={label}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        min={field.min}
        max={field.max}
        placeholder={field.placeholder ?? (field.type === "number" ? "0" : "Value")}
        value={String(value ?? "")}
        onChange={(e) => handleOnChange(e.target.value)}
        className={cn(inputCls, field.type === "number" ? "w-28" : "w-44")}
      />
    );
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      {editor}
      {issue && (
        <span role="alert" className="text-[11px] text-crm-danger">
          {issue}
        </span>
      )}
    </span>
  );
}
