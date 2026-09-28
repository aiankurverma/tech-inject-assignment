import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormatMoneyOptions {
  currency?: string;
  locale?: string;
  /** Treat `amount` as minor units (cents, paise) — the usual shape from billing APIs. */
  minorUnits?: boolean;
  /** Compact notation: $1.2M, ₹4.5L-style per locale. */
  compact?: boolean;
  /** Always show + for positives, or hide sign entirely. */
  sign?: "auto" | "always" | "never" | "accounting";
  /** Force fraction digits (defaults to the currency's own, e.g. 0 for JPY). */
  fractionDigits?: number;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(
  locale: string | undefined,
  opts: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale ?? ""}|${JSON.stringify(opts)}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, opts);
    formatterCache.set(key, f);
  }
  return f;
}

/** The currency's minor-unit exponent (2 for USD, 0 for JPY, 3 for KWD). */
export function currencyDigits(currency: string): number {
  try {
    return (
      getFormatter("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ??
      2
    );
  } catch {
    return 2;
  }
}

/** Formats an amount; returns null for invalid currency codes or non-finite numbers. */
export function formatMoney(amount: number, options: FormatMoneyOptions = {}): string | null {
  const { currency = "USD", locale, minorUnits, compact, sign = "auto", fractionDigits } = options;
  if (!Number.isFinite(amount)) return null;
  try {
    const digits = currencyDigits(currency);
    const major = minorUnits ? amount / 10 ** digits : amount;
    const fd = fractionDigits ?? (compact ? undefined : digits);
    return getFormatter(locale, {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      signDisplay: sign === "accounting" ? "auto" : sign === "always" ? "exceptZero" : sign,
      currencySign: sign === "accounting" ? "accounting" : "standard",
      minimumFractionDigits: fd,
      maximumFractionDigits: fd ?? (compact ? 1 : digits),
    }).format(major);
  } catch {
    return null;
  }
}

const sizes = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg font-semibold",
  xl: "text-3xl font-semibold tracking-tight",
} as const;

export interface MoneyProps extends FormatMoneyOptions {
  /** Amount in major units (or minor units with `minorUnits`). `null` renders the placeholder. */
  amount: number | null | undefined;
  size?: keyof typeof sizes;
  /** Colour by sign: green for positive, red for negative. */
  toneBySign?: boolean;
  /** Show the ISO code after the amount (useful when mixing currencies). */
  showCode?: boolean;
  /** A previous/list price rendered struck through, e.g. before a discount. */
  compareAt?: number;
  /** A converted amount shown as secondary text, e.g. the account's reporting currency. */
  converted?: { amount: number; currency: string; rateLabel?: string };
  /** Rendered when amount is null/undefined. */
  placeholder?: React.ReactNode;
  className?: string;
}

/**
 * Formatted money value. Tabular numerals, currency-correct fraction digits, compact mode
 * with the exact figure in the title, discount compare-at and FX conversion line.
 */
export function Money({
  amount,
  currency = "USD",
  locale,
  minorUnits,
  compact,
  sign,
  fractionDigits,
  size = "md",
  toneBySign,
  showCode,
  compareAt,
  converted,
  placeholder = "—",
  className,
}: MoneyProps) {
  const opts = { currency, locale, minorUnits, sign, fractionDigits };
  if (amount == null || !Number.isFinite(amount)) {
    return (
      <span
        className={cn("font-crm text-crm-subtle", sizes[size], className)}
        aria-label="No amount"
      >
        {placeholder}
      </span>
    );
  }
  const text = formatMoney(amount, { ...opts, compact });
  if (text == null) {
    return (
      <span className={cn("font-crm text-crm-danger", sizes[size], className)} role="note">
        Invalid currency “{currency}”
      </span>
    );
  }
  const exact = compact ? formatMoney(amount, opts) : null;
  const compare = compareAt != null ? formatMoney(compareAt, opts) : null;
  const savings =
    compareAt != null && compareAt > amount
      ? Math.round(((compareAt - amount) / compareAt) * 100)
      : null;
  const conv = converted
    ? formatMoney(converted.amount, { currency: converted.currency, locale, minorUnits, compact })
    : null;
  const tone = toneBySign
    ? amount > 0
      ? "text-crm-success"
      : amount < 0
        ? "text-crm-danger"
        : "text-crm-soft"
    : "text-crm-fg";

  return (
    <span className={cn("inline-flex flex-col font-crm leading-tight", className)}>
      <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
        <data
          value={String(minorUnits ? amount / 10 ** currencyDigits(currency) : amount)}
          title={exact ?? undefined}
          className={cn("tabular-nums whitespace-nowrap", sizes[size], tone)}
        >
          {text}
          {showCode && (
            <span className="ml-1 text-[0.75em] font-medium text-crm-subtle">{currency}</span>
          )}
        </data>
        {compare && compareAt! > amount && (
          <>
            <s className="text-[0.8em] text-crm-subtle tabular-nums" aria-label={`was ${compare}`}>
              {compare}
            </s>
            {savings ? (
              <span className="tag-green rounded-full px-1.5 text-[10px] font-medium">
                −{savings}%
              </span>
            ) : null}
          </>
        )}
      </span>
      {conv && (
        <span className="crm-caption text-crm-subtle tabular-nums">
          ≈ {conv}
          {converted?.rateLabel ? ` · ${converted.rateLabel}` : ""}
        </span>
      )}
    </span>
  );
}

/** Sums major-unit amounts in integer minor units to avoid float drift (0.1 + 0.2). */
export function sumMoney(amounts: number[], currency = "USD"): number {
  const f = 10 ** currencyDigits(currency);
  return amounts.reduce((acc, a) => acc + Math.round(a * f), 0) / f;
}
