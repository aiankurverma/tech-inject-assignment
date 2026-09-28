import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { NumberInput } from "@/components/crm/number-input";
import { CurrencyInput } from "@/components/crm/currency-input";

export interface QuoteLineItem {
  id: string;
  name: string;
  sku?: string;
  quantity: number;
  /** List unit price in major units. */
  unitPrice: number;
  /** Line discount percent 0-100. */
  discount: number;
  /** Line tax rate percent. */
  taxRate: number;
  /** Billing cadence note, e.g. "per year". */
  term?: string;
}

export interface QuoteLineTotals {
  net: number;
  discount: number;
  tax: number;
  total: number;
}

export interface QuoteTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  /** Tax grouped by rate, e.g. { 18: 540 }. */
  taxByRate: Record<number, number>;
}

export interface QuoteLineItemsProps {
  items?: QuoteLineItem[];
  defaultItems?: QuoteLineItem[];
  onItemsChange?: (items: QuoteLineItem[]) => void;
  currency?: string;
  locale?: string;
  /** Max line discount a rep may give without approval; above it the line is flagged. */
  maxDiscount?: number;
  /** Default tax rate for new lines. */
  defaultTaxRate?: number;
  /** Adds a line; defaults to a blank custom line. Return null to cancel. */
  onAddLine?: () => QuoteLineItem | null;
  readOnly?: boolean;
  className?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function lineTotals(l: QuoteLineItem): QuoteLineTotals {
  const gross = l.quantity * l.unitPrice;
  const discount = r2((gross * Math.min(100, Math.max(0, l.discount))) / 100);
  const net = r2(gross - discount);
  const tax = r2((net * l.taxRate) / 100);
  return { net, discount, tax, total: r2(net + tax) };
}

/** Quote totals with tax grouped per rate (for tax lines on the quote PDF). */
export function quoteTotals(items: QuoteLineItem[]): QuoteTotals {
  const out: QuoteTotals = { subtotal: 0, discount: 0, tax: 0, total: 0, taxByRate: {} };
  for (const l of items) {
    const t = lineTotals(l);
    out.subtotal += l.quantity * l.unitPrice;
    out.discount += t.discount;
    out.tax += t.tax;
    out.total += t.total;
    out.taxByRate[l.taxRate] = r2((out.taxByRate[l.taxRate] ?? 0) + t.tax);
  }
  out.subtotal = r2(out.subtotal);
  out.discount = r2(out.discount);
  out.tax = r2(out.tax);
  out.total = r2(out.total);
  return out;
}

let seq = 0;

/** Editable quote table: products, quantity, unit price, line discount (with approval threshold), per-line tax, reorder, and totals with tax grouped by rate. */
export function QuoteLineItems({
  items: itemsProp,
  defaultItems = [],
  onItemsChange,
  currency = "USD",
  locale,
  maxDiscount = 20,
  defaultTaxRate = 0,
  onAddLine,
  readOnly,
  className,
}: QuoteLineItemsProps) {
  const [inner, setInner] = React.useState(defaultItems);
  const items = itemsProp ?? inner;
  const money = new Intl.NumberFormat(locale, { style: "currency", currency });
  const totals = quoteTotals(items);
  const needsApproval = items.filter((l) => l.discount > maxDiscount);
  const nameRefs = React.useRef(new Map<string, HTMLInputElement>());
  const [focusId, setFocusId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (focusId) {
      nameRefs.current.get(focusId)?.focus();
      setFocusId(null);
    }
  }, [focusId]);

  const commit = (next: QuoteLineItem[]) => {
    if (itemsProp === undefined) setInner(next);
    onItemsChange?.(next);
  };
  const patch = (id: string, p: Partial<QuoteLineItem>) =>
    commit(items.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    const a = next[i];
    const b = next[j];
    if (!a || !b) return;
    next[i] = b;
    next[j] = a;
    commit(next);
  };
  const add = () => {
    const line = onAddLine
      ? onAddLine()
      : {
          id: `line-${Date.now()}-${++seq}`,
          name: "",
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          taxRate: defaultTaxRate,
        };
    if (!line) return;
    commit([...items, line]);
    setFocusId(line.id);
  };

  const cell = "px-2 py-2 align-middle";
  const iconBtn =
    "inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-crm-muted-fg outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-30 disabled:pointer-events-none [&_svg]:size-3";

  return (
    <div className={cn("flex min-w-0 flex-col gap-3 font-crm text-xs text-crm-fg", className)}>
      <div className="overflow-x-auto rounded-crm border border-crm-border bg-crm-card">
        <table className="w-full min-w-[780px] table-fixed border-collapse">
          <caption className="sr-only">Quote line items</caption>
          <thead>
            <tr className="border-b border-crm-border text-left text-[11px] text-crm-soft">
              <th scope="col" className={cn(cell, "font-medium")}>
                Product
              </th>
              <th scope="col" className={cn(cell, "w-28 font-medium")}>
                Qty
              </th>
              <th scope="col" className={cn(cell, "w-32 font-medium")}>
                Unit price
              </th>
              <th scope="col" className={cn(cell, "w-20 font-medium")}>
                Disc %
              </th>
              <th scope="col" className={cn(cell, "w-20 font-medium")}>
                Tax %
              </th>
              <th scope="col" className={cn(cell, "w-28 text-right font-medium")}>
                Amount
              </th>
              {!readOnly ? (
                <th scope="col" className={cn(cell, "w-24")}>
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 6 : 7} className="px-3 py-8 text-center text-crm-soft">
                  No products on this quote yet.
                </td>
              </tr>
            ) : null}
            {items.map((l, i) => {
              const t = lineTotals(l);
              const flagged = l.discount > maxDiscount;
              const label = l.name || `Line ${i + 1}`;
              return (
                <tr key={l.id} className="border-b border-crm-border last:border-b-0">
                  <td className={cell}>
                    {readOnly ? (
                      <span className="block truncate font-medium">{l.name}</span>
                    ) : (
                      <input
                        ref={(el) => {
                          if (el) nameRefs.current.set(l.id, el);
                          else nameRefs.current.delete(l.id);
                        }}
                        value={l.name}
                        onChange={(e) => patch(l.id, { name: e.target.value })}
                        placeholder="Product or service"
                        aria-label={`Product name, line ${i + 1}`}
                        aria-invalid={!l.name.trim() || undefined}
                        className="h-7 w-full rounded-md bg-transparent px-1.5 font-medium outline-none hover:bg-crm-raised focus:bg-crm-input focus:ring-1 focus:ring-crm-ring/60"
                      />
                    )}
                    <span className="block truncate px-1.5 text-[11px] text-crm-subtle">
                      {[l.sku, l.term].filter(Boolean).join(" · ") || " "}
                    </span>
                  </td>
                  <td className={cell}>
                    {readOnly ? (
                      l.quantity
                    ) : (
                      <NumberInput
                        size="sm"
                        value={l.quantity}
                        min={1}
                        step={1}
                        onChange={(v) => patch(l.id, { quantity: v ?? 1 })}
                        aria-label={`Quantity for ${label}`}
                      />
                    )}
                  </td>
                  <td className={cell}>
                    {readOnly ? (
                      money.format(l.unitPrice)
                    ) : (
                      <CurrencyInput
                        value={l.unitPrice}
                        currency={currency}
                        locale={locale}
                        min={0}
                        onChange={(v) => patch(l.id, { unitPrice: v ?? 0 })}
                        aria-label={`Unit price for ${label}`}
                      />
                    )}
                  </td>
                  <td className={cell}>
                    {readOnly ? (
                      `${l.discount}%`
                    ) : (
                      <NumberInput
                        size="sm"
                        hideSteppers
                        value={l.discount}
                        min={0}
                        max={100}
                        step={1}
                        invalid={flagged}
                        onChange={(v) => patch(l.id, { discount: v ?? 0 })}
                        aria-label={`Discount percent for ${label}`}
                      />
                    )}
                    {flagged ? (
                      <span className="mt-0.5 block text-[10px] text-crm-warning">
                        Needs approval
                      </span>
                    ) : null}
                  </td>
                  <td className={cell}>
                    {readOnly ? (
                      `${l.taxRate}%`
                    ) : (
                      <NumberInput
                        size="sm"
                        hideSteppers
                        value={l.taxRate}
                        min={0}
                        max={100}
                        step={0.5}
                        onChange={(v) => patch(l.id, { taxRate: v ?? 0 })}
                        aria-label={`Tax percent for ${label}`}
                      />
                    )}
                  </td>
                  <td className={cn(cell, "text-right whitespace-nowrap tabular-nums")}>
                    <span className="block font-medium">{money.format(t.net)}</span>
                    {t.discount > 0 ? (
                      <span className="block text-[11px] text-crm-subtle line-through">
                        {money.format(l.quantity * l.unitPrice)}
                      </span>
                    ) : null}
                  </td>
                  {!readOnly ? (
                    <td className={cn(cell, "whitespace-nowrap")}>
                      <button
                        type="button"
                        className={iconBtn}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        aria-label={`Move ${label} up`}
                      >
                        <ArrowUp aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        disabled={i === items.length - 1}
                        onClick={() => move(i, 1)}
                        aria-label={`Move ${label} down`}
                      >
                        <ArrowDown aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={cn(iconBtn, "hover:text-crm-danger")}
                        onClick={() => commit(items.filter((x) => x.id !== l.id))}
                        aria-label={`Remove ${label}`}
                      >
                        <Trash2 aria-hidden />
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          {!readOnly ? (
            <Button className="self-start" onClick={add}>
              <Plus aria-hidden />
              Add line
            </Button>
          ) : null}
          {needsApproval.length ? (
            <p role="status" className="text-[11px] text-crm-warning">
              {needsApproval.length} line{needsApproval.length === 1 ? "" : "s"} over the{" "}
              {maxDiscount}% discount limit need manager approval.
            </p>
          ) : null}
        </div>
        <dl className="flex w-full flex-col gap-1.5 sm:w-64" aria-live="polite">
          <div className="flex justify-between">
            <dt className="text-crm-soft">Subtotal</dt>
            <dd className="tabular-nums">{money.format(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 ? (
            <div className="flex justify-between">
              <dt className="text-crm-soft">Discounts</dt>
              <dd className="text-crm-success tabular-nums">-{money.format(totals.discount)}</dd>
            </div>
          ) : null}
          {Object.entries(totals.taxByRate)
            .filter(([rate]) => Number(rate) > 0)
            .map(([rate, amt]) => (
              <div key={rate} className="flex justify-between">
                <dt className="text-crm-soft">Tax {rate}%</dt>
                <dd className="tabular-nums">{money.format(amt)}</dd>
              </div>
            ))}
          <div className="flex justify-between border-t border-crm-border pt-1.5 text-sm font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{money.format(totals.total)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
