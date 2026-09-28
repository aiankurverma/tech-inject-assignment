import * as React from "react";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "type" | "min" | "max"
> {
  /** Amount in major units (e.g. 1250.5 dollars). */
  value?: number | null;
  defaultValue?: number | null;
  onChange?: (value: number | null) => void;
  /** ISO 4217 code, e.g. "USD", "EUR", "INR". */
  currency?: string;
  locale?: string;
  min?: number;
  max?: number;
  /** Show the currency code after the amount. */
  showCode?: boolean;
  invalid?: boolean;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function currencyParts(locale: string | undefined, currency: string) {
  const f = new Intl.NumberFormat(locale, { style: "currency", currency });
  const parts = f.formatToParts(1234567.5);
  return {
    symbol: parts.find((p) => p.type === "currency")?.value ?? currency,
    group: parts.find((p) => p.type === "group")?.value ?? ",",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
    digits: f.resolvedOptions().maximumFractionDigits ?? 2,
  };
}

/** Locale-aware money field. Groups digits while typing, normalises to the currency's fraction digits on blur and emits a plain number. */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput(
    {
      value: valueProp,
      defaultValue = null,
      onChange,
      currency = "USD",
      locale,
      min,
      max,
      showCode,
      invalid,
      disabled,
      className,
      onBlur,
      onFocus,
      onKeyDown,
      placeholder,
      ...props
    },
    ref,
  ) {
    const { symbol, group, decimal, digits } = React.useMemo(
      () => currencyParts(locale, currency),
      [locale, currency],
    );
    const fmt = React.useMemo(
      () =>
        new Intl.NumberFormat(locale, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }),
      [locale, digits],
    );
    const intFmt = React.useMemo(
      () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
      [locale],
    );
    const [inner, setInner] = React.useState<number | null>(defaultValue);
    const controlled = valueProp !== undefined;
    const value = controlled ? valueProp : inner;
    const [draft, setDraft] = React.useState<string | null>(null);

    const parse = (text: string): number | null => {
      const neg = text.trim().startsWith("-");
      const cleaned = text
        .split(group)
        .join("")
        .replace(decimal, ".")
        .replace(/[^\d.]/g, "");
      if (cleaned === "" || cleaned === ".") return null;
      const n = Number(cleaned);
      return Number.isNaN(n) ? null : neg ? -n : n;
    };

    /** Re-group the integer part as the user types; keep their fractional part as typed. */
    const liveFormat = (text: string) => {
      const neg = text.trim().startsWith("-") && (min == null || min < 0);
      const raw = text.replace(new RegExp(`[^\\d${escape(decimal)}]`, "g"), "");
      const [int = "", ...rest] = raw.split(decimal);
      const frac = rest.join("").slice(0, digits);
      const trimmedInt = int.replace(/^0+(?=\d)/, "");
      const grouped = trimmedInt ? intFmt.format(Number(trimmedInt)) : "";
      const hasDecimal = raw.includes(decimal) && digits > 0;
      return (
        (neg ? "-" : "") + (grouped || (hasDecimal ? "0" : "")) + (hasDecimal ? decimal + frac : "")
      );
    };

    const commit = (n: number | null) => {
      const next =
        n === null
          ? null
          : Number(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)).toFixed(digits));
      if (!controlled) setInner(next);
      if (next !== value) onChange?.(next);
      return next;
    };

    const display = draft ?? (value == null ? "" : fmt.format(value));

    return (
      <div
        className={cn(
          "flex h-9 w-full items-center gap-1.5 rounded-crm border border-crm-input/60 bg-crm-raised px-3 font-crm",
          "transition-[border-color,box-shadow] duration-150 ease-crm hover:border-crm-input",
          "focus-within:border-crm-ring focus-within:ring-2 focus-within:ring-crm-ring/40",
          invalid && "border-crm-danger ring-crm-danger/20",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <span aria-hidden className="shrink-0 text-sm text-crm-subtle">
          {symbol}
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={display}
          placeholder={placeholder ?? fmt.format(0)}
          onFocus={(e) => {
            setDraft(value == null ? "" : fmt.format(value));
            onFocus?.(e);
          }}
          onChange={(e) => setDraft(liveFormat(e.target.value))}
          onBlur={(e) => {
            if (draft !== null) commit(parse(draft));
            setDraft(null);
            onBlur?.(e);
          }}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.key === "Enter" && draft !== null) {
              const next = commit(parse(draft));
              setDraft(next == null ? "" : fmt.format(next));
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-crm-fg tabular-nums outline-none placeholder:text-crm-faint disabled:cursor-not-allowed"
          {...props}
        />
        {showCode ? (
          <span className="shrink-0 text-[11px] font-medium tracking-wide text-crm-subtle">
            {currency}
          </span>
        ) : null}
      </div>
    );
  },
);
