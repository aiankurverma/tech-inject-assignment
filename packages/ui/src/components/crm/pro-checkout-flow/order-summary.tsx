import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import type {
  CartItem,
  Coupon,
  CouponResult,
  Totals,
} from "@/components/crm/pro-checkout-flow/pricing";

export type CouponState =
  | { status: "idle" }
  | { status: "checking"; code: string }
  | { status: "applied"; coupon: Coupon }
  | { status: "error"; code: string; message: string };

export interface OrderSummaryProps {
  items: CartItem[];
  totals: Totals;
  money: (minor: number) => string;
  coupon: CouponState;
  onApplyCoupon?: (code: string) => Promise<CouponResult> | CouponResult;
  onCouponChange: (s: CouponState) => void;
  disabled?: boolean;
  className?: string;
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: React.ReactNode;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3",
        strong && "text-sm font-medium text-crm-fg",
        muted && "text-crm-muted-fg",
      )}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** Sticky order summary with animated total and a coupon field (idle/checking/applied/error). */
export function OrderSummary({
  items,
  totals,
  money,
  coupon,
  onApplyCoupon,
  onCouponChange,
  disabled,
  className,
}: OrderSummaryProps) {
  const [code, setCode] = React.useState("");
  const reduce = useReducedMotion();
  const inputId = React.useId();
  const errId = React.useId();
  const req = React.useRef(0);

  const apply = async () => {
    const c = code.trim().toUpperCase();
    if (!c || !onApplyCoupon) return;
    const n = ++req.current;
    onCouponChange({ status: "checking", code: c });
    try {
      const r = await onApplyCoupon(c);
      if (n !== req.current) return; // a newer request superseded this one
      onCouponChange(
        r.ok
          ? { status: "applied", coupon: r.coupon }
          : { status: "error", code: c, message: r.message },
      );
      if (r.ok) setCode("");
    } catch {
      if (n === req.current)
        onCouponChange({
          status: "error",
          code: c,
          message: "Could not check this code. Try again.",
        });
    }
  };

  const count = items.reduce((a, i) => a + i.quantity, 0);

  return (
    <aside
      aria-label="Order summary"
      className={cn(
        "rounded-crm border border-crm-border bg-crm-card p-4 text-xs text-crm-soft shadow-crm-raised lg:sticky lg:top-4",
        className,
      )}
    >
      <h2 className="mb-3 text-sm font-medium text-crm-fg">
        Order summary <span className="text-crm-muted-fg">({count} items)</span>
      </h2>
      <ul className="max-h-64 space-y-3 overflow-auto pr-1">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3">
            <div className="relative size-11 shrink-0 overflow-hidden rounded-crm bg-crm-muted">
              {i.image && <img src={i.image} alt="" className="size-full object-cover" />}
              <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-crm-subtle text-[10px] text-crm-fg">
                {i.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-crm-fg">{i.name}</p>
              {i.variant && <p className="truncate text-crm-muted-fg">{i.variant}</p>}
            </div>
            <span className="tabular-nums text-crm-fg">{money(i.unitPrice * i.quantity)}</span>
          </li>
        ))}
      </ul>

      {onApplyCoupon && (
        <div className="mt-4 border-t border-crm-border pt-4">
          {coupon.status === "applied" ? (
            <div className="flex items-center justify-between rounded-crm bg-crm-success/10 px-2.5 py-2 text-crm-success">
              <span>
                <strong className="font-medium">{coupon.coupon.code}</strong> ·{" "}
                {coupon.coupon.label}
              </span>
              <button
                type="button"
                className="text-crm-muted-fg underline hover:text-crm-fg"
                onClick={() => onCouponChange({ status: "idle" })}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <label htmlFor={inputId} className="mb-1 block text-crm-muted-fg">
                Discount code
              </label>
              <div className="flex gap-2">
                <input
                  id={inputId}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (coupon.status === "error") onCouponChange({ status: "idle" });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void apply();
                    }
                  }}
                  disabled={disabled || coupon.status === "checking"}
                  aria-invalid={coupon.status === "error" || undefined}
                  aria-describedby={coupon.status === "error" ? errId : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-8 min-w-0 flex-1 rounded-crm border border-crm-input bg-crm-bg px-2.5 text-crm-fg uppercase outline-none focus-visible:ring-2 focus-visible:ring-crm-ring aria-invalid:border-crm-danger"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void apply()}
                  loading={coupon.status === "checking"}
                  disabled={disabled || !code.trim()}
                >
                  {coupon.status === "checking" ? "Checking" : "Apply"}
                </Button>
              </div>
              {coupon.status === "error" && (
                <p id={errId} role="alert" className="mt-1 text-crm-danger">
                  {coupon.message}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <dl className="mt-4 space-y-1.5 border-t border-crm-border pt-4">
        <Row label="Subtotal" value={money(totals.subtotal)} />
        {totals.discount > 0 && <Row label="Discount" value={`-${money(totals.discount)}`} />}
        <Row label="Shipping" value={totals.shipping === 0 ? "Free" : money(totals.shipping)} />
        {totals.reverseCharge ? (
          <Row label={`${totals.taxLabel} (reverse charge)`} value={money(0)} muted />
        ) : (
          <Row
            label={totals.taxInclusive ? `Incl. ${totals.taxLabel}` : totals.taxLabel}
            value={money(totals.tax)}
            muted={totals.taxInclusive}
          />
        )}
        <div className="flex items-baseline justify-between border-t border-crm-border pt-3 text-sm font-medium text-crm-fg">
          <dt>Total</dt>
          <dd aria-live="polite" aria-atomic="true" className="overflow-hidden tabular-nums">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={totals.total}
                className="inline-block text-base"
                initial={reduce ? false : { y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduce ? undefined : { y: -10, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {money(totals.total)}
              </motion.span>
            </AnimatePresence>
          </dd>
        </div>
      </dl>
    </aside>
  );
}
