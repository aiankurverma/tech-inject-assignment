import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OPERATORS_BY_TYPE,
  coerceValues,
  isActive,
  operatorLabel,
} from "@/components/crm/pro-filter-bar/operators";
import { ValueEditor, describeValues } from "@/components/crm/pro-filter-bar/value-editors";
import type {
  FilterCondition,
  FilterField,
  FilterOption,
} from "@/components/crm/pro-filter-bar/types";

export interface FilterChipProps {
  field: FilterField<never>;
  condition: FilterCondition;
  options: FilterOption[];
  counts?: Map<string, number>;
  onChange: (next: FilterCondition) => void;
  onRemove: () => void;
  /** Open the value popover on mount (a chip that was just added). */
  autoOpen?: boolean;
  disabled?: boolean;
}

const segment =
  "flex h-full items-center gap-1.5 px-2 outline-none transition-colors hover:bg-crm-muted focus-visible:bg-crm-muted focus-visible:text-crm-fg disabled:pointer-events-none";

const popoverCls =
  "z-50 overflow-hidden rounded-crm border border-crm-border bg-crm-popover shadow-crm-overlay animate-crm-in";

/** Three-part chip: field · operator (popover) · value (popover) · remove. */
export const FilterChip = React.memo(function FilterChip({
  field,
  condition,
  options,
  counts,
  onChange,
  onRemove,
  autoOpen,
  disabled,
}: FilterChipProps) {
  const [opOpen, setOpOpen] = React.useState(false);
  const [valueOpen, setValueOpen] = React.useState(!!autoOpen);
  const valueRef = React.useRef<HTMLButtonElement>(null);
  const pending = !isActive(condition);
  const ops = OPERATORS_BY_TYPE[field.type];
  const valueText = describeValues(field, condition, options);
  const opText = operatorLabel(condition.operator, field.type, condition.values.length);
  const unary = condition.operator === "empty" || condition.operator === "not_empty";

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Backspace" || e.key === "Delete") && !opOpen && !valueOpen) {
      e.preventDefault();
      onRemove();
    }
  };

  return (
    <div
      role="group"
      aria-label={`Filter: ${field.label} ${opText} ${unary ? "" : valueText}`}
      data-pending={pending || undefined}
      onKeyDown={onKeyDown}
      className={cn(
        "flex h-7 shrink-0 items-center overflow-hidden rounded-crm border border-crm-border bg-crm-raised text-[13px] text-crm-chip shadow-crm-raised",
        "data-[pending]:border-dashed data-[pending]:text-crm-soft",
      )}
    >
      <span className="flex h-full items-center gap-1.5 pl-2 pr-1.5 text-crm-soft">
        {field.icon && <span className="[&_svg]:size-3.5">{field.icon}</span>}
        {field.label}
      </span>

      <Popover.Root open={opOpen} onOpenChange={setOpOpen}>
        <Popover.Trigger
          data-filter-focusable=""
          disabled={disabled || ops.length < 2}
          aria-label={`${field.label} operator: ${opText}. Change operator`}
          className={cn(segment, "border-l border-crm-border text-crm-muted-fg")}
        >
          {opText}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} className={cn(popoverCls, "w-48 p-1")}>
            <div role="listbox" aria-label="Operator" className="flex flex-col">
              {ops.map((op) => (
                <button
                  key={op}
                  type="button"
                  role="option"
                  aria-selected={op === condition.operator}
                  onClick={() => {
                    onChange({
                      ...condition,
                      operator: op,
                      values: coerceValues(condition.values, condition.operator, op),
                    });
                    setOpOpen(false);
                    if (op !== "empty" && op !== "not_empty")
                      requestAnimationFrame(() => valueRef.current?.focus());
                  }}
                  onKeyDown={(e) => {
                    const dir = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
                    if (!dir) return;
                    e.preventDefault();
                    const all = [
                      ...(e.currentTarget.parentElement?.querySelectorAll("button") ?? []),
                    ];
                    const i = all.indexOf(e.currentTarget);
                    all[(i + dir + all.length) % all.length]?.focus();
                  }}
                  className="flex h-8 items-center justify-between rounded-[6px] px-2 text-left text-[13px] text-crm-chip outline-none hover:bg-crm-muted focus-visible:bg-crm-muted"
                >
                  {operatorLabel(op, field.type, condition.values.length)}
                  {op === condition.operator && <Check className="size-3.5 text-crm-soft" />}
                </button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {!unary && (
        <Popover.Root open={valueOpen} onOpenChange={setValueOpen}>
          <Popover.Trigger
            ref={valueRef}
            data-filter-focusable=""
            disabled={disabled}
            aria-label={`${field.label} value: ${valueText}. Edit value`}
            className={cn(segment, "max-w-56 border-l border-crm-border font-medium text-crm-fg")}
          >
            {field.type === "enum" && condition.values.length === 1 && (
              <span className="[&_svg]:size-3.5">
                {options.find((o) => o.value === condition.values[0])?.icon}
              </span>
            )}
            <span className="truncate">{valueText}</span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              collisionPadding={12}
              className={popoverCls}
              onOpenAutoFocus={(e) => {
                // Focus the editor's input, or the list itself for short option lists.
                e.preventDefault();
                const root = e.currentTarget as HTMLElement;
                requestAnimationFrame(() =>
                  root.querySelector<HTMLElement>("input, [cmdk-root], button")?.focus(),
                );
              }}
            >
              <ValueEditor
                field={field}
                condition={condition}
                options={options}
                counts={counts}
                onChange={(values) => onChange({ ...condition, values })}
                onDone={() => setValueOpen(false)}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}

      <button
        type="button"
        data-filter-focusable=""
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remove ${field.label} filter`}
        className={cn(
          segment,
          "border-l border-crm-border px-1.5 text-crm-subtle hover:text-crm-fg",
        )}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
});
