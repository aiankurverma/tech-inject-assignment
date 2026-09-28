import * as React from "react";
import { Check, Tag as TagIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";

export interface AppliedCoupon {
  code: string;
  /** Human description, e.g. "20% off for 3 months". */
  description?: string;
  type: "percent" | "amount";
  /** Percent (0-100) or amount in major units. */
  value: number;
}

export type CouponValidationResult =
  { ok: true; coupon: AppliedCoupon } | { ok: false; error: string };

export interface CouponInputProps {
  /** Validates a normalised code. May be async (server lookup). */
  onValidate: (code: string) => CouponValidationResult | Promise<CouponValidationResult>;
  /** Controlled applied coupon. */
  applied?: AppliedCoupon | null;
  defaultApplied?: AppliedCoupon | null;
  onAppliedChange?: (coupon: AppliedCoupon | null) => void;
  /** Subtotal used to preview the saving. */
  subtotal?: number;
  currency?: string;
  locale?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/** Normalises a promo code: trims, uppercases, strips spaces. */
export const normalizeCouponCode = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, "");

/** Computes the discount a coupon gives on a subtotal, never exceeding it. */
export function couponDiscount(coupon: AppliedCoupon, subtotal: number) {
  const d = coupon.type === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  return Math.min(subtotal, Math.max(0, Math.round(d * 100) / 100));
}

/** Promo code field: normalises input, runs sync/async validation with loading and error states, then shows the applied code as a removable chip with the saving. */
export function CouponInput({
  onValidate,
  applied: appliedProp,
  defaultApplied = null,
  onAppliedChange,
  subtotal,
  currency = "USD",
  locale,
  disabled,
  placeholder = "Promo code",
  className,
}: CouponInputProps) {
  const [inner, setInner] = React.useState<AppliedCoupon | null>(defaultApplied);
  const applied = appliedProp !== undefined ? appliedProp : inner;
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const reqId = React.useRef(0);
  const errId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const money = new Intl.NumberFormat(locale, { style: "currency", currency });

  const set = (c: AppliedCoupon | null) => {
    if (appliedProp === undefined) setInner(c);
    onAppliedChange?.(c);
  };

  const apply = async () => {
    const code = normalizeCouponCode(draft);
    if (!code) {
      setError("Enter a code");
      return;
    }
    const id = ++reqId.current;
    setPending(true);
    setError(null);
    try {
      const res = await onValidate(code);
      if (id !== reqId.current) return;
      if (res.ok) {
        set(res.coupon);
        setDraft("");
      } else setError(res.error);
    } catch {
      if (id === reqId.current) setError("Could not check this code. Try again.");
    } finally {
      if (id === reqId.current) setPending(false);
    }
  };

  if (applied) {
    const saving = subtotal !== undefined ? couponDiscount(applied, subtotal) : null;
    return (
      <div
        role="status"
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-crm border border-tag-green-border bg-tag-green-bg px-2.5 py-2 font-crm text-xs",
          className,
        )}
      >
        <Check className="size-3.5 shrink-0 text-tag-green-text" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="font-mono font-medium text-tag-green-text">{applied.code}</span>
          <span className="block truncate text-crm-soft">
            {applied.description ??
              (applied.type === "percent"
                ? `${applied.value}% off`
                : `${money.format(applied.value)} off`)}
          </span>
        </span>
        {saving !== null ? (
          <span className="shrink-0 tabular-nums text-tag-green-text">-{money.format(saving)}</span>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            set(null);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          aria-label={`Remove code ${applied.code}`}
          className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1 font-crm", className)}>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void apply();
        }}
      >
        <div
          className={cn(
            "flex h-[30px] min-w-0 flex-1 items-center gap-1.5 rounded-full border bg-crm-input px-2.5 text-xs",
            error ? "border-crm-danger" : "border-crm-border focus-within:border-crm-ring",
            disabled && "opacity-50",
          )}
        >
          <TagIcon className="size-3.5 shrink-0 text-crm-icon" aria-hidden />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            disabled={disabled || pending}
            placeholder={placeholder}
            aria-label="Promo code"
            aria-invalid={!!error || undefined}
            aria-describedby={error ? errId : undefined}
            autoComplete="off"
            spellCheck={false}
            maxLength={32}
            className="min-w-0 flex-1 bg-transparent font-mono text-crm-fg uppercase outline-none placeholder:font-crm placeholder:text-crm-subtle placeholder:normal-case"
          />
        </div>
        <Button type="submit" disabled={disabled || !draft.trim()} loading={pending}>
          Apply
        </Button>
      </form>
      {error ? (
        <p id={errId} role="alert" className="px-2.5 text-[11px] text-crm-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
