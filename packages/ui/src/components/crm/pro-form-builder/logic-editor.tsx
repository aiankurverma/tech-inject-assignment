import * as React from "react";
import { QueryBuilder, type Field, type RuleGroupType } from "react-querybuilder";
import { cn } from "@/lib/utils";
import {
  isInputField,
  hasOptions,
  type FormField,
} from "@/components/crm/pro-form-renderer/schema";

const ctl =
  "h-7 rounded-md border border-crm-input/60 bg-crm-raised px-1.5 text-xs text-crm-fg outline-none focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40 [color-scheme:dark]";
const btn =
  "h-7 cursor-pointer rounded-full bg-crm-raised px-2.5 text-xs text-crm-fg shadow-crm-raised outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60";

/** react-querybuilder control classes mapped onto CRM tokens (the library's own CSS is not used). */
const classNames = {
  queryBuilder: "font-crm text-xs",
  ruleGroup: "flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-card/60 p-2",
  header: "flex flex-wrap items-center gap-1.5",
  body: "flex flex-col gap-1.5 empty:hidden",
  combinators: ctl,
  addRule: btn,
  addGroup: btn,
  removeGroup: cn(
    btn,
    "ml-auto bg-transparent text-crm-muted-fg shadow-none hover:text-crm-danger",
  ),
  removeRule: cn(btn, "bg-transparent px-2 text-crm-muted-fg shadow-none hover:text-crm-danger"),
  rule: "flex flex-wrap items-center gap-1.5",
  fields: cn(ctl, "max-w-[9rem]"),
  operators: cn(ctl, "max-w-[8rem]"),
  value: cn(ctl, "min-w-0 flex-1"),
  notToggle: "flex items-center gap-1 text-crm-muted-fg",
};

const OPERATORS = [
  { name: "=", label: "is" },
  { name: "!=", label: "is not" },
  { name: "contains", label: "contains" },
  { name: "doesNotContain", label: "does not contain" },
  { name: "beginsWith", label: "starts with" },
  { name: ">", label: ">" },
  { name: ">=", label: "≥" },
  { name: "<", label: "<" },
  { name: "<=", label: "≤" },
  { name: "between", label: "between" },
  { name: "in", label: "is any of" },
  { name: "notIn", label: "is none of" },
  { name: "notNull", label: "is answered" },
  { name: "null", label: "is empty" },
];

const emptyGroup = (): RuleGroupType => ({ combinator: "and", rules: [] });

export interface LogicEditorProps {
  /** Fields the rule may reference (usually those before the edited one). */
  sources: FormField[];
  value: RuleGroupType | undefined;
  onChange: (next: RuleGroupType | undefined) => void;
  subject: string;
  disabled?: boolean;
}

/** Visual condition editor powered by react-querybuilder; empty groups are stored as undefined. */
export function LogicEditor({ sources, value, onChange, subject, disabled }: LogicEditorProps) {
  const fields = React.useMemo<Field[]>(
    () =>
      sources.filter(isInputField).map((f) => {
        const base: Field = { name: f.name, label: f.label || f.name };
        if (hasOptions(f.type) && f.options?.length)
          return {
            ...base,
            valueEditorType: "select",
            values: f.options.map((o) => ({ name: o.value, label: o.label })),
          };
        if (f.type === "consent" || (f.type === "checkbox" && !f.options?.length))
          return {
            ...base,
            valueEditorType: "select",
            values: [
              { name: "true", label: "checked" },
              { name: "false", label: "unchecked" },
            ],
          };
        if (f.type === "number" || f.type === "rating") return { ...base, inputType: "number" };
        if (f.type === "date") return { ...base, inputType: "date" };
        return base;
      }),
    [sources],
  );

  if (!fields.length) {
    return (
      <p className="rounded-crm border border-dashed border-crm-input/50 p-3 text-xs text-crm-subtle">
        Add a question before this one to show {subject} conditionally.
      </p>
    );
  }

  const active = !!value?.rules.length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-crm-muted-fg">
        {active
          ? `Show ${subject} only when:`
          : `${subject[0]?.toUpperCase()}${subject.slice(1)} is always shown.`}
      </p>
      <QueryBuilder
        fields={fields}
        operators={OPERATORS}
        query={value ?? emptyGroup()}
        onQueryChange={(q) => onChange(q.rules.length ? (q as RuleGroupType) : undefined)}
        controlClassnames={classNames}
        disabled={disabled}
        resetOnFieldChange
        translations={{
          addRule: { label: "+ Condition", title: "Add condition" },
          addGroup: { label: "+ Group", title: "Add nested group" },
          removeRule: { label: "✕", title: "Remove condition" },
          removeGroup: { label: "Remove group", title: "Remove group" },
        }}
      />
      {active ? (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="self-start text-xs text-crm-muted-fg underline-offset-2 hover:text-crm-fg hover:underline"
        >
          Clear conditions
        </button>
      ) : null}
    </div>
  );
}
