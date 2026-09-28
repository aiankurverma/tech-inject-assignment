import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ArrowDown, ArrowDownUp, ArrowUp, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { Button } from "@/components/crm/button";
import { Select } from "@/components/crm/select";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

export interface SortField {
  value: string;
  label: string;
}

export interface SortRule {
  field: string;
  direction: SortDirection;
}

export interface SortMenuProps {
  fields: SortField[];
  /** Ordered rules; the first is the primary sort. */
  value: SortRule[];
  onChange: (rules: SortRule[]) => void;
  /** Maximum number of sort levels. */
  max?: number;
  /** Custom trigger; defaults to a "Sort" button showing the rule count. */
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
  defaultOpen?: boolean;
}

const iconBtn =
  "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-crm-subtle outline-none transition-colors hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-3.5";

/** Multi-column sort editor in a popover: pick fields, flip direction, reorder priority, remove. */
export function SortMenu({
  fields,
  value,
  onChange,
  max = 5,
  trigger,
  align = "start",
  defaultOpen,
}: SortMenuProps) {
  const used = new Set(value.map((r) => r.field));
  const unused = fields.filter((f) => !used.has(f.value));
  const labelOf = (v: string) => fields.find((f) => f.value === v)?.label ?? v;

  const update = (i: number, patch: Partial<SortRule>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    const [r] = next.splice(i, 1);
    next.splice(i + d, 0, r!);
    onChange(next);
  };
  const add = () => {
    const f = unused[0];
    if (f) onChange([...value, { field: f.value, direction: "asc" }]);
  };

  return (
    <Popover.Root defaultOpen={defaultOpen}>
      <Popover.Trigger asChild>
        {trigger ?? (
          <Button variant={value.length ? "muted" : "secondary"}>
            <ArrowDownUp aria-hidden />
            {value.length === 1
              ? `Sorted by ${labelOf(value[0]!.field)}`
              : value.length
                ? `Sorted by ${value.length} fields`
                : "Sort"}
          </Button>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          aria-label="Sort options"
          className="z-50 w-[min(420px,calc(100vw-2rem))] rounded-xl border border-crm-border bg-crm-popover p-3 font-crm text-crm-fg shadow-crm-overlay outline-none data-[state=open]:animate-crm-in"
        >
          <p className="crm-eyebrow pb-2 text-crm-subtle">Sort by</p>
          {value.length === 0 ? (
            <p className="py-3 text-center text-xs text-crm-subtle">
              No sorting applied. Records use their default order.
            </p>
          ) : (
            <ol className="flex flex-col gap-2" aria-label="Sort rules">
              {value.map((rule, i) => {
                const opts = fields.filter((f) => f.value === rule.field || !used.has(f.value));
                const asc = rule.direction === "asc";
                return (
                  <li key={rule.field} className="flex items-center gap-1.5">
                    <span className="w-10 shrink-0 text-xs text-crm-subtle">
                      {i === 0 ? "First" : "Then"}
                    </span>
                    <Select
                      aria-label={`Sort field ${i + 1}`}
                      options={opts}
                      value={rule.field}
                      onValueChange={(v) => update(i, { field: v })}
                      className="h-8 min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      aria-label={`Direction: ${asc ? "ascending" : "descending"}. Toggle`}
                      onClick={() => update(i, { direction: asc ? "desc" : "asc" })}
                      className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-crm border border-crm-input/60 bg-crm-raised px-2 text-xs text-crm-fg outline-none hover:border-crm-input focus-visible:ring-2 focus-visible:ring-crm-ring/40 [&_svg]:size-3.5"
                    >
                      {asc ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />}
                      {asc ? "Asc" : "Desc"}
                    </button>
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className={iconBtn}
                    >
                      <ChevronUp />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={i === value.length - 1}
                      onClick={() => move(i, 1)}
                      className={iconBtn}
                    >
                      <ChevronDown />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove sort by ${labelOf(rule.field)}`}
                      onClick={() => onChange(value.filter((_, j) => j !== i))}
                      className={cn(iconBtn, "hover:text-crm-danger")}
                    >
                      <X />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-crm-border pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={add}
              disabled={!unused.length || value.length >= max}
            >
              <Plus aria-hidden />
              Add sort
            </Button>
            {value.length ? (
              <Button variant="ghost" size="sm" onClick={() => onChange([])}>
                Clear
              </Button>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
