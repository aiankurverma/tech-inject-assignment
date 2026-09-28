import * as React from "react";
import { cn } from "@/lib/utils";

export interface OrderSummaryItem {
  id: string;
  name: string;
  /** Secondary line, e.g. "Annual · 25 seats". */
  detail?: string;
  quantity: number;
  /** Unit price in major units. */
  unitPrice: number;
}

export interface OrderAdjustment {
  label: string;
  /** Percent of the running subtotal, or a fixed amount. */
  type: "percent" | "amount";
  value: number;
}

export interface OrderTotals {
  subtotal: number;
  /** Amount of each discount, in the order given. */
  discountLines: number[];
  discount: number;
  taxable: number;
  tax: number;
  shipping: number;
  credit: number;
  total: number;
}

export interface OrderSummaryProps {
  items: OrderSummaryItem[];
  /** Discounts applied before tax (coupons, volume). */
  discounts?: OrderAdjustment[];
  /** Tax rate as a percentage, applied to the discounted subtotal. */
  taxRate?: number;
  taxLabel?: string;
  /** Prices already include tax (VAT/GST style): tax is extracted, not added. */
  taxInclusive?: boolean;
  shipping?: number;
  /** Account credit / prorated credit applied after tax. */
  credit?: number;
  currency?: string;
  locale?: string;
  /** Suffix after the total, e.g. "/ year". */
  totalSuffix?: string;
  /** Collapse the item list beyond this count. */
  maxItems?: number;
  loading?: boolean;
  /** Rendered between lines and totals, e.g. a CouponInput. */
  children?: React.ReactNode;
  /** Rendered under the total, e.g. the checkout button. */
  footer?: React.ReactNode;
  className?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Pure totals calculation: subtotal, stacked discounts (capped), exclusive or inclusive tax, shipping and credits. */
export function computeOrderTotals({
  items,
  discounts = [],
  taxRate = 0,
  taxInclusive = false,
  shipping = 0,
  credit = 0,
}: Pick<
  OrderSummaryProps,
  "items" | "discounts" | "taxRate" | "taxInclusive" | "shipping" | "credit"
>): OrderTotals {
  const subtotal = r2(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  let running = subtotal;
  const discountLines: number[] = [];
  for (const d of discounts) {
    const amt = Math.min(running, d.type === "percent" ? (running * d.value) / 100 : d.value);
    discountLines.push(r2(amt));
    running = Math.max(0, running - amt);
  }
  const discount = r2(subtotal - running);
  const taxable = r2(running);
  const tax = taxInclusive
    ? r2(taxable - taxable / (1 + taxRate / 100))
    : r2((taxable * taxRate) / 100);
  const gross = taxInclusive ? taxable + shipping : taxable + tax + shipping;
  const appliedCredit = r2(Math.min(credit, gross));
  return {
    subtotal,
    discountLines,
    discount,
    taxable,
    tax,
    shipping,
    credit: appliedCredit,
    total: r2(gross - appliedCredit),
  };
}

/** Checkout totals block: line items, stacked discounts, inclusive/exclusive tax, shipping, credits and a live grand total. */
export function OrderSummary({
  items,
  discounts = [],
  taxRate = 0,
  taxLabel = "Tax",
  taxInclusive,
  shipping = 0,
  credit = 0,
  currency = "USD",
  locale,
  totalSuffix,
  maxItems = 4,
  loading,
  children,
  footer,
  className,
}: OrderSummaryProps) {
  const [open, setOpen] = React.useState(false);
  const money = new Intl.NumberFormat(locale, { style: "currency", currency });
  const t = computeOrderTotals({ items, discounts, taxRate, taxInclusive, shipping, credit });
  const shown = open ? items : items.slice(0, maxItems);
  const rest = items.length - shown.length;
  const row = "flex items-baseline justify-between gap-3";
  const skeleton = <span className="h-3 w-14 animate-pulse rounded bg-crm-muted" aria-hidden />;

  return (
    <section
      aria-label="Order summary"
      aria-busy={loading || undefined}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 font-crm text-xs text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <h3 className="crm-eyebrow text-crm-soft">Order summary</h3>
      {items.length === 0 ? (
        <p className="py-4 text-center text-crm-soft">Your order is empty.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shown.map((i) => (
            <li key={i.id} className={row}>
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {i.name}
                  {i.quantity !== 1 ? <span className="text-crm-soft"> × {i.quantity}</span> : null}
                </span>
                {i.detail ? <span className="block truncate text-crm-soft">{i.detail}</span> : null}
              </span>
              <span className="shrink-0 tabular-nums">
                {loading ? skeleton : money.format(i.quantity * i.unitPrice)}
              </span>
            </li>
          ))}
          {rest > 0 || open ? (
            <li>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="cursor-pointer rounded text-crm-soft outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
              >
                {open ? "Show less" : `+${rest} more item${rest === 1 ? "" : "s"}`}
              </button>
            </li>
          ) : null}
        </ul>
      )}
      {children}
      <dl className="flex flex-col gap-1.5 border-t border-crm-border pt-3">
        <div className={row}>
          <dt className="text-crm-soft">Subtotal</dt>
          <dd className="tabular-nums">{loading ? skeleton : money.format(t.subtotal)}</dd>
        </div>
        {discounts.map((d, idx) => (
          <div key={`${idx}-${d.label}`} className={row}>
            <dt className="truncate text-crm-soft">
              {d.label}
              {d.type === "percent" ? ` (${d.value}%)` : ""}
            </dt>
            <dd className="text-crm-success tabular-nums">
              {loading ? skeleton : `-${money.format(t.discountLines[idx] ?? 0)}`}
            </dd>
          </div>
        ))}
        {t.discount > 0 && discounts.length > 1 ? (
          <div className={row}>
            <dt className="text-crm-soft">Total savings</dt>
            <dd className="text-crm-success tabular-nums">-{money.format(t.discount)}</dd>
          </div>
        ) : null}
        {taxRate > 0 ? (
          <div className={row}>
            <dt className="text-crm-soft">
              {taxLabel} ({taxRate}%{taxInclusive ? ", included" : ""})
            </dt>
            <dd className="tabular-nums">{loading ? skeleton : money.format(t.tax)}</dd>
          </div>
        ) : null}
        {shipping > 0 ? (
          <div className={row}>
            <dt className="text-crm-soft">Shipping</dt>
            <dd className="tabular-nums">{money.format(t.shipping)}</dd>
          </div>
        ) : null}
        {t.credit > 0 ? (
          <div className={row}>
            <dt className="text-crm-soft">Account credit</dt>
            <dd className="text-crm-success tabular-nums">-{money.format(t.credit)}</dd>
          </div>
        ) : null}
        <div className={cn(row, "mt-1 border-t border-crm-border pt-2.5 text-sm font-semibold")}>
          <dt>Total due</dt>
          <dd className="tabular-nums" aria-live="polite">
            {loading ? skeleton : money.format(t.total)}
            {totalSuffix && !loading ? (
              <span className="ml-1 text-xs font-normal text-crm-soft">{totalSuffix}</span>
            ) : null}
          </dd>
        </div>
      </dl>
      {footer}
    </section>
  );
}
