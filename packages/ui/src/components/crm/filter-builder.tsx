import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/crm/button";
import { Input } from "@/components/crm/input";
import { Select, type SelectOption } from "@/components/crm/select";
import { cn } from "@/lib/utils";

export type FilterFieldType = "text" | "number" | "date" | "select";

export interface FilterField {
  value: string;
  label: string;
  type: FilterFieldType;
  /** Choices for type="select". */
  options?: SelectOption[];
}

export type FilterOperator =
  | "is"
  | "is_not"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "gt"
  | "lt"
  | "before"
  | "after"
  | "is_empty"
  | "is_not_empty";

export interface FilterRule {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

export interface FilterGroup {
  conjunction: "and" | "or";
  rules: FilterRule[];
}

export interface FilterBuilderProps {
  fields: FilterField[];
  value: FilterGroup;
  onChange: (value: FilterGroup) => void;
  /** Optional apply button; omit to apply live. */
  onApply?: (value: FilterGroup) => void;
  maxRules?: number;
  className?: string;
}

const operatorLabels: Record<FilterOperator, string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  not_contains: "does not contain",
  starts_with: "starts with",
  gt: "greater than",
  lt: "less than",
  before: "is before",
  after: "is after",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

/** Operators offered for each field type. */
export const filterOperators: Record<FilterFieldType, FilterOperator[]> = {
  text: ["contains", "not_contains", "is", "is_not", "starts_with", "is_empty", "is_not_empty"],
  number: ["is", "is_not", "gt", "lt", "is_empty", "is_not_empty"],
  date: ["is", "before", "after", "is_empty", "is_not_empty"],
  select: ["is", "is_not", "is_empty", "is_not_empty"],
};

const noValue: FilterOperator[] = ["is_empty", "is_not_empty"];

let seq = 0;
const newId = () => `rule-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Field / operator / value rule editor with an AND/OR conjunction. Operators adapt to the field type. */
export function FilterBuilder({
  fields,
  value,
  onChange,
  onApply,
  maxRules = 10,
  className,
}: FilterBuilderProps) {
  const fieldOf = (v: string) => fields.find((f) => f.value === v);
  const rowsRef = React.useRef<HTMLOListElement>(null);

  const setRules = (rules: FilterRule[]) => onChange({ ...value, rules });
  const patch = (id: string, p: Partial<FilterRule>) =>
    setRules(value.rules.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const changeField = (id: string, field: string) => {
    const f = fieldOf(field);
    const ops = filterOperators[f?.type ?? "text"];
    const rule = value.rules.find((r) => r.id === id);
    patch(id, {
      field,
      operator: rule && ops.includes(rule.operator) ? rule.operator : ops[0]!,
      value: "",
    });
  };
  const add = () => {
    const f = fields[0];
    if (!f) return;
    setRules([
      ...value.rules,
      { id: newId(), field: f.value, operator: filterOperators[f.type][0]!, value: "" },
    ]);
    requestAnimationFrame(() => {
      const rows = rowsRef.current?.querySelectorAll<HTMLElement>("li");
      rows?.[rows.length - 1]?.querySelector<HTMLElement>("button")?.focus();
    });
  };
  const remove = (id: string) => setRules(value.rules.filter((r) => r.id !== id));
  const fieldOptions: SelectOption[] = fields.map((f) => ({ value: f.value, label: f.label }));

  return (
    <div
      role="group"
      aria-label="Filter rules"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-crm-border bg-crm-popover p-3 font-crm text-crm-fg",
        className,
      )}
    >
      {value.rules.length === 0 ? (
        <p className="py-4 text-center text-xs text-crm-subtle">
          No filters yet. Add a rule to narrow down records.
        </p>
      ) : (
        <ol ref={rowsRef} className="flex flex-col gap-2">
          {value.rules.map((rule, i) => {
            const field = fieldOf(rule.field);
            const type = field?.type ?? "text";
            const ops = filterOperators[type];
            const n = i + 1;
            return (
              <li
                key={rule.id}
                className="grid grid-cols-[52px_1fr_auto] items-center gap-2 sm:grid-cols-[64px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]"
              >
                <span className="text-xs text-crm-subtle">
                  {i === 0 ? (
                    "Where"
                  ) : i === 1 ? (
                    <button
                      type="button"
                      aria-label={`Match ${value.conjunction === "and" ? "all" : "any"} rules. Switch to ${value.conjunction === "and" ? "any" : "all"}`}
                      onClick={() =>
                        onChange({
                          ...value,
                          conjunction: value.conjunction === "and" ? "or" : "and",
                        })
                      }
                      className="h-7 cursor-pointer rounded-lg border border-crm-input/60 bg-crm-raised px-2 font-medium text-crm-fg uppercase outline-none hover:border-crm-input focus-visible:ring-2 focus-visible:ring-crm-ring/40"
                    >
                      {value.conjunction}
                    </button>
                  ) : (
                    <span className="pl-2 uppercase">{value.conjunction}</span>
                  )}
                </span>
                <Select
                  aria-label={`Rule ${n} field`}
                  options={fieldOptions}
                  value={rule.field}
                  onValueChange={(v) => changeField(rule.id, v)}
                  className="h-8"
                />
                <button
                  type="button"
                  aria-label={`Remove rule ${n}`}
                  onClick={() => remove(rule.id)}
                  className="col-start-3 row-start-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-danger focus-visible:ring-2 focus-visible:ring-crm-ring/60 sm:col-start-5 [&_svg]:size-3.5"
                >
                  <X />
                </button>
                <Select
                  aria-label={`Rule ${n} operator`}
                  options={ops.map((o) => ({ value: o, label: operatorLabels[o] }))}
                  value={rule.operator}
                  onValueChange={(v) =>
                    patch(rule.id, {
                      operator: v as FilterOperator,
                      value: noValue.includes(v as FilterOperator) ? "" : rule.value,
                    })
                  }
                  className="col-start-2 h-8 sm:col-start-3 sm:row-start-1"
                />
                <div className="col-start-2 sm:col-start-4 sm:row-start-1">
                  {noValue.includes(rule.operator) ? null : type === "select" ? (
                    <Select
                      aria-label={`Rule ${n} value`}
                      options={field?.options ?? []}
                      value={rule.value}
                      placeholder="Choose..."
                      onValueChange={(v) => patch(rule.id, { value: v })}
                      className="h-8"
                    />
                  ) : (
                    <Input
                      aria-label={`Rule ${n} value`}
                      type={type === "number" ? "number" : type === "date" ? "date" : "text"}
                      value={rule.value}
                      placeholder="Value"
                      onChange={(e) => patch(rule.id, { value: e.target.value })}
                      className="h-8"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex items-center gap-2 border-t border-crm-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={add}
          disabled={!fields.length || value.rules.length >= maxRules}
        >
          <Plus aria-hidden />
          Add filter
        </Button>
        {value.rules.length ? (
          <Button variant="ghost" size="sm" onClick={() => setRules([])}>
            Clear all
          </Button>
        ) : null}
        {onApply ? (
          <Button variant="primary" size="sm" className="ml-auto" onClick={() => onApply(value)}>
            Apply
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** True when a rule has everything it needs to be applied. */
export function isRuleComplete(rule: FilterRule) {
  return noValue.includes(rule.operator) || rule.value.trim() !== "";
}
