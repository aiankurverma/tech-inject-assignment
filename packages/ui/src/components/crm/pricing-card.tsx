import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";

export interface PricingFeature {
  label: string;
  /** false renders the feature as not included. */
  included?: boolean;
  /** Short limit hint, e.g. "5 seats" or "10k/mo". */
  hint?: string;
}

export interface PricingCardProps {
  name: string;
  description?: string;
  /** Price per seat per month when billed monthly. null = custom / contact sales. */
  monthlyPrice: number | null;
  /** Price per seat per month when billed yearly (already discounted). Defaults to monthlyPrice. */
  yearlyMonthlyPrice?: number | null;
  interval?: "monthly" | "yearly";
  /** Seats used to compute the billed total. */
  seats?: number;
  perSeat?: boolean;
  currency?: string;
  locale?: string;
  features: PricingFeature[];
  /** Highlight as the recommended tier. */
  featured?: boolean;
  badge?: string;
  /** Marks the tier the customer is already on; CTA is disabled. */
  current?: boolean;
  ctaLabel?: string;
  onSelect?: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Collapse features beyond this count behind a "show all" toggle. */
  maxFeatures?: number;
  className?: string;
}

/** Plan tier card with interval-aware pricing, per-seat totals, included/excluded features, current-plan and custom-price states. */
export function PricingCard({
  name,
  description,
  monthlyPrice,
  yearlyMonthlyPrice,
  interval = "monthly",
  seats,
  perSeat = true,
  currency = "USD",
  locale,
  features,
  featured,
  badge,
  current,
  ctaLabel,
  onSelect,
  loading,
  disabled,
  maxFeatures = 6,
  className,
}: PricingCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const titleId = React.useId();
  const unit = interval === "yearly" ? (yearlyMonthlyPrice ?? monthlyPrice) : monthlyPrice;
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  const qty = perSeat && seats ? seats : 1;
  const periodTotal = unit === null ? null : interval === "yearly" ? unit * qty * 12 : unit * qty;
  const struck =
    interval === "yearly" && monthlyPrice !== null && unit !== null && unit < monthlyPrice
      ? monthlyPrice
      : null;
  const shown = expanded ? features : features.slice(0, maxFeatures);
  const hidden = features.length - shown.length;
  const label = current
    ? "Current plan"
    : (ctaLabel ?? (unit === null ? "Contact sales" : `Choose ${name}`));

  return (
    <section
      aria-labelledby={titleId}
      data-featured={featured || undefined}
      className={cn(
        "relative flex w-full min-w-0 flex-col rounded-crm border bg-crm-card p-5 font-crm text-crm-fg shadow-crm-raised",
        featured ? "border-crm-primary/70 ring-1 ring-crm-primary/40" : "border-crm-border",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 id={titleId} className="text-sm font-semibold">
          {name}
        </h3>
        {current ? (
          <span className="rounded-full bg-crm-success/15 px-2 text-[11px] leading-5 text-crm-success">
            Current
          </span>
        ) : badge ? (
          <span className="rounded-full bg-crm-primary/20 px-2 text-[11px] leading-5 text-crm-fg">
            {badge}
          </span>
        ) : null}
      </div>
      {description ? <p className="mt-1 text-xs text-crm-soft">{description}</p> : null}

      <div className="mt-4 flex items-baseline gap-1.5">
        {unit === null ? (
          <span className="text-2xl font-semibold">Custom</span>
        ) : (
          <>
            {struck !== null ? (
              <span className="text-sm text-crm-subtle line-through">{fmt(struck)}</span>
            ) : null}
            <span className="text-2xl font-semibold tabular-nums">{fmt(unit)}</span>
            <span className="text-xs text-crm-soft">{perSeat ? "/ seat / mo" : "/ mo"}</span>
          </>
        )}
      </div>
      <p className="crm-caption mt-1 min-h-4 text-crm-subtle" aria-live="polite">
        {periodTotal === null
          ? "Volume pricing, SSO and invoicing terms"
          : `${fmt(periodTotal)} billed ${interval === "yearly" ? "yearly" : "monthly"}${
              perSeat && seats ? ` for ${seats} seat${seats === 1 ? "" : "s"}` : ""
            }`}
      </p>

      <Button
        className="mt-4 w-full"
        variant={featured && !current ? "primary" : "secondary"}
        disabled={disabled || current}
        loading={loading}
        onClick={onSelect}
      >
        {label}
      </Button>

      <ul className="mt-5 flex flex-col gap-2 text-xs" aria-label={`${name} features`}>
        {shown.map((f) => {
          const inc = f.included !== false;
          return (
            <li key={f.label} className={cn("flex items-start gap-2", !inc && "text-crm-subtle")}>
              {inc ? (
                <Check className="mt-px size-3.5 shrink-0 text-crm-success" aria-hidden />
              ) : (
                <Minus className="mt-px size-3.5 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="sr-only">{inc ? "Included: " : "Not included: "}</span>
                {f.label}
              </span>
              {f.hint ? (
                <span className="shrink-0 text-crm-soft tabular-nums">{f.hint}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {hidden > 0 || expanded ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 self-start rounded text-xs text-crm-soft underline-offset-2 outline-none hover:text-crm-fg hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          {expanded ? "Show fewer" : `Show all ${features.length} features`}
        </button>
      ) : null}
    </section>
  );
}
