import * as React from "react";
import { QueryBuilder, formatQuery, type Field, type RuleGroupType } from "react-querybuilder";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlagVariant, TargetingRule } from "@/components/crm/pro-feature-flag-console/types";

const ctl =
  "h-7 rounded border border-crm-input bg-crm-bg px-2 text-[12px] text-crm-fg focus:border-crm-ring focus:outline-none";
const btn =
  "h-7 rounded border border-crm-border bg-crm-raised px-2 text-[12px] text-crm-soft hover:bg-crm-muted hover:text-crm-fg";

/** Tailwind/CRM classes for react-querybuilder's default controls (library CSS not required). */
const classNames = {
  queryBuilder: "text-[12px]",
  ruleGroup: "flex flex-col gap-2 rounded-md border border-crm-border bg-crm-bg/40 p-2",
  header: "flex flex-wrap items-center gap-1.5",
  body: "flex flex-col gap-1.5 [&:empty]:hidden",
  combinators: ctl,
  addRule: btn,
  addGroup: btn,
  removeGroup: cn(btn, "ml-auto hover:text-crm-danger"),
  rule: "flex flex-wrap items-center gap-1.5",
  fields: ctl,
  operators: ctl,
  value: cn(ctl, "min-w-[140px] flex-1"),
  valueListItem: ctl,
  removeRule: cn(btn, "hover:text-crm-danger"),
  notToggle: "inline-flex items-center gap-1 text-crm-muted-fg",
  invalid: "[&_input]:border-crm-danger",
};

const newQuery = (): RuleGroupType => ({ combinator: "and", rules: [] });

export interface TargetingRulesProps {
  rules: TargetingRule[];
  onChange: (rules: TargetingRule[]) => void;
  attributes: Field[];
  variants: FlagVariant[];
  disabled?: boolean;
  errors?: Record<number, string | undefined>;
}

let seq = 0;
const uid = () => `rule_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** Ordered rule list: first match wins. Each rule is a react-querybuilder query plus a served variant. */
export function TargetingRules({
  rules,
  onChange,
  attributes,
  variants,
  disabled,
  errors,
}: TargetingRulesProps) {
  const update = (i: number, patch: Partial<TargetingRule>) =>
    onChange(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...rules];
    const [r] = next.splice(i, 1);
    next.splice(i + d, 0, r!);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {rules.length === 0 ? (
        <p className="rounded-md border border-dashed border-crm-border px-3 py-4 text-center text-xs text-crm-muted-fg">
          No targeting rules. Everyone falls through to the percentage rollout.
        </p>
      ) : null}
      <ol className="space-y-3">
        {rules.map((r, i) => (
          <li
            key={r.id}
            className="rounded-md border border-crm-border bg-crm-raised p-3"
            aria-label={`Rule ${i + 1}: ${r.name}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="grid size-5 place-items-center rounded bg-crm-muted text-[11px] tabular-nums">
                {i + 1}
              </span>
              <input
                value={r.name}
                disabled={disabled}
                onChange={(e) => update(i, { name: e.target.value })}
                aria-label={`Rule ${i + 1} name`}
                className={cn(ctl, "min-w-[160px] flex-1 font-medium")}
              />
              <label className="flex items-center gap-1.5 text-xs text-crm-muted-fg">
                serve
                <select
                  value={r.serve}
                  disabled={disabled}
                  onChange={(e) => update(i, { serve: e.target.value })}
                  className={ctl}
                >
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  disabled={disabled || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`Move rule ${i + 1} up`}
                  className="rounded p-1 text-crm-soft hover:bg-crm-muted disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled || i === rules.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Move rule ${i + 1} down`}
                  className="rounded p-1 text-crm-soft hover:bg-crm-muted disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(rules.filter((_, j) => j !== i))}
                  aria-label={`Delete rule ${i + 1}`}
                  className="rounded p-1 text-crm-soft hover:bg-crm-danger/15 hover:text-crm-danger disabled:opacity-30"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
            <QueryBuilder
              fields={attributes}
              query={r.query}
              onQueryChange={(q) => update(i, { query: q })}
              controlClassnames={classNames}
              disabled={disabled}
              showNotToggle
              resetOnFieldChange
              translations={{ addRule: { label: "+ Condition" }, addGroup: { label: "+ Group" } }}
            />
            <p
              className="mt-2 truncate font-mono text-[11px] text-crm-muted-fg"
              title="Evaluated expression"
            >
              {r.query.rules.length
                ? formatQuery(r.query, "sql")
                : "No conditions (matches everyone)"}
            </p>
            {errors?.[i] ? <p className="mt-1 text-xs text-crm-danger">{errors[i]}</p> : null}
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...rules,
            {
              id: uid(),
              name: `Rule ${rules.length + 1}`,
              query: newQuery(),
              serve: variants[0]?.id ?? "",
            },
          ])
        }
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-crm-border px-3 py-1.5 text-xs text-crm-soft hover:border-crm-ring hover:text-crm-fg disabled:opacity-40"
      >
        <Plus className="size-3.5" aria-hidden /> Add targeting rule
      </button>
    </div>
  );
}
