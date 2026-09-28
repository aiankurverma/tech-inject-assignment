import * as React from "react";
import { cn } from "@/lib/utils";

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** "list" = plain radios, "cards" = bordered selectable tiles. */
  variant?: "list" | "cards";
  orientation?: "vertical" | "horizontal";
  /** Accessible name for the group. */
  label: string;
  className?: string;
}

/** Single-choice group with roving focus: arrow keys move and select, Tab leaves the group. */
export function RadioGroup({
  options,
  value,
  defaultValue,
  onValueChange,
  variant = "list",
  orientation = "vertical",
  label,
  className,
}: RadioGroupProps) {
  const [inner, setInner] = React.useState(defaultValue ?? "");
  const current = value ?? inner;
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.filter((o) => !o.disabled);
  const select = (v: string) => {
    if (value === undefined) setInner(v);
    onValueChange?.(v);
  };
  const selectedIndex = options.findIndex((o) => o.value === current && !o.disabled);
  const tabStop = selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled);
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
    const pos = enabled.findIndex((o) => o.value === options[index]?.value);
    const next = enabled[(pos + dir + enabled.length) % enabled.length];
    if (!next) return;
    select(next.value);
    refs.current[options.indexOf(next)]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-orientation={orientation}
      className={cn(
        "flex font-crm",
        orientation === "vertical" ? "flex-col" : "flex-row flex-wrap",
        variant === "cards" ? "gap-2" : "gap-3",
        className,
      )}
    >
      {options.map((o, i) => {
        const checked = o.value === current;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={o.disabled}
            tabIndex={i === tabStop ? 0 : -1}
            onClick={() => select(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "group flex cursor-pointer items-start gap-2.5 text-left outline-none disabled:cursor-not-allowed disabled:opacity-50",
              variant === "cards"
                ? cn(
                    "rounded-crm border p-3 transition-colors duration-150 ease-crm focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                    checked
                      ? "border-crm-primary bg-crm-primary/10"
                      : "border-crm-input/60 bg-crm-raised hover:border-crm-input",
                  )
                : "rounded focus-visible:ring-2 focus-visible:ring-crm-ring/60",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-150",
                checked ? "border-crm-primary" : "border-[#323232] group-hover:border-crm-input",
              )}
            >
              {checked ? <span className="size-2 rounded-full bg-crm-primary" /> : null}
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-sm text-crm-fg">{o.label}</span>
              {o.description ? (
                <span className="text-xs text-crm-soft">{o.description}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
