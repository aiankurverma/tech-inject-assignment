import * as React from "react";
import { cn } from "@/lib/utils";

export type BillingInterval = "monthly" | "yearly";

export interface PlanSwitcherProps {
  value?: BillingInterval;
  defaultValue?: BillingInterval;
  onValueChange?: (value: BillingInterval) => void;
  /** Yearly saving vs 12x monthly, as a whole percentage (e.g. 20). Computed from prices when omitted. */
  yearlyDiscount?: number;
  /** Monthly price, used with yearlyPrice to compute the saving shown under the control. */
  monthlyPrice?: number;
  /** Full-year price paired with monthlyPrice. */
  yearlyPrice?: number;
  currency?: string;
  locale?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/** Monthly/yearly billing toggle with a savings badge and a computed "you save" line. Radio semantics with arrow-key support. */
export function PlanSwitcher({
  value,
  defaultValue = "monthly",
  onValueChange,
  yearlyDiscount,
  monthlyPrice,
  yearlyPrice,
  currency = "USD",
  locale,
  disabled,
  label = "Billing interval",
  className,
}: PlanSwitcherProps) {
  const [inner, setInner] = React.useState<BillingInterval>(defaultValue);
  const current = value ?? inner;
  const refs = React.useRef<Record<BillingInterval, HTMLButtonElement | null>>({
    monthly: null,
    yearly: null,
  });
  const select = (v: BillingInterval) => {
    if (disabled) return;
    if (value === undefined) setInner(v);
    onValueChange?.(v);
  };
  const discount =
    yearlyDiscount ??
    (monthlyPrice && yearlyPrice
      ? Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100)
      : undefined);
  const saving =
    monthlyPrice !== undefined && yearlyPrice !== undefined
      ? monthlyPrice * 12 - yearlyPrice
      : undefined;
  const fmt = new Intl.NumberFormat(locale, { style: "currency", currency });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next: BillingInterval =
      e.key === "Home"
        ? "monthly"
        : e.key === "End"
          ? "yearly"
          : current === "monthly"
            ? "yearly"
            : "monthly";
    select(next);
    refs.current[next]?.focus();
  };

  const opts: { v: BillingInterval; text: string }[] = [
    { v: "monthly", text: "Monthly" },
    { v: "yearly", text: "Yearly" },
  ];

  return (
    <div className={cn("inline-flex flex-col items-center gap-1.5 font-crm", className)}>
      <div
        role="radiogroup"
        aria-label={label}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex items-center rounded-full bg-crm-bg p-0.5 shadow-crm-raised",
          disabled && "opacity-50",
        )}
      >
        {opts.map((o) => {
          const on = current === o.v;
          return (
            <button
              key={o.v}
              ref={(el) => {
                refs.current[o.v] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              disabled={disabled}
              onClick={() => select(o.v)}
              className={cn(
                "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium outline-none",
                "transition-colors duration-150 ease-crm focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed",
                on
                  ? "bg-crm-muted text-crm-fg shadow-crm-raised"
                  : "text-crm-muted-fg hover:text-crm-fg",
              )}
            >
              {o.text}
              {o.v === "yearly" && discount && discount > 0 ? (
                <span className="rounded-full bg-crm-success/15 px-1.5 text-[10px] leading-4 text-crm-success">
                  -{discount}%
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {saving !== undefined && saving > 0 ? (
        <p className="crm-caption text-crm-soft" aria-live="polite">
          {current === "yearly"
            ? `You save ${fmt.format(saving)} per year`
            : `Switch to yearly and save ${fmt.format(saving)}`}
        </p>
      ) : null}
    </div>
  );
}
