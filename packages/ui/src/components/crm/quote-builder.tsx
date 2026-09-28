import * as React from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Tag } from "@/components/crm/tag";

export interface QuoteLine {
  id: string;
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  /** Line discount in percent (0–100). */
  discount: number;
  /** Tax rate in percent applied after discount. */
  taxRate: number;
}

export interface QuoteProductOption {
  id: string;
  name: string;
  sku?: string;
  unitPrice: number;
  taxRate?: number;
}

export interface QuoteTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  /** True when any line exceeds `maxDiscount`. */
  needsApproval: boolean;
}

export interface QuoteBuilderProps {
  lines?: QuoteLine[];
  defaultLines?: QuoteLine[];
  onLinesChange?: (lines: QuoteLine[]) => void;
  /** Products offered in the "Add line" picker. */
  products?: QuoteProductOption[];
  currency?: string;
  locale?: string;
  /** Discounts above this percent require manager approval. Default 20. */
  maxDiscount?: number;
  /** Default tax rate for custom lines. Default 0. */
  defaultTaxRate?: number;
  /** Quote validity end (ISO date), shown in the summary. */
  validUntil?: string;
  onSubmit?: (lines: QuoteLine[], totals: QuoteTotals) => void;
  submitting?: boolean;
  readOnly?: boolean;
  className?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pure totals calculation (rounded per line to cents, as invoices do). */
export function computeQuoteTotals(lines: QuoteLine[], maxDiscount = 20): QuoteTotals {
  let subtotal = 0,
    discount = 0,
    tax = 0;
  for (const l of lines) {
    const gross = round2(l.quantity * l.unitPrice);
    const disc = round2((gross * l.discount) / 100);
    subtotal += gross;
    discount += disc;
    tax += round2(((gross - disc) * l.taxRate) / 100);
  }
  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    tax: round2(tax),
    total: round2(subtotal - discount + tax),
    needsApproval: lines.some((l) => l.discount > maxDiscount),
  };
}

function lineErrors(l: QuoteLine) {
  const e: string[] = [];
  if (!l.name.trim()) e.push("Name is required");
  if (!(l.quantity >= 1) || !Number.isInteger(l.quantity))
    e.push("Quantity must be a whole number ≥ 1");
  if (!(l.unitPrice >= 0)) e.push("Price can't be negative");
  if (l.discount < 0 || l.discount > 100) e.push("Discount must be 0–100%");
  return e;
}

const cellInput =
  "h-7 w-full rounded-crm border border-transparent bg-transparent px-1.5 text-sm tabular-nums outline-none hover:border-crm-border focus:border-crm-input focus:bg-crm-bg aria-[invalid=true]:border-crm-danger disabled:hover:border-transparent";

/** Editable quote line-item table with product picker, per-line discount/tax, approval threshold and live totals. */
export function QuoteBuilder({
  lines: linesProp,
  defaultLines = [],
  onLinesChange,
  products = [],
  currency = "USD",
  locale = "en-US",
  maxDiscount = 20,
  defaultTaxRate = 0,
  validUntil,
  onSubmit,
  submitting,
  readOnly,
  className,
}: QuoteBuilderProps) {
  const [inner, setInner] = React.useState(defaultLines);
  const lines = linesProp ?? inner;
  const [picker, setPicker] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const fmt = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency }),
    [locale, currency],
  );
  const totals = computeQuoteTotals(lines, maxDiscount);

  const commit = (next: QuoteLine[]) => {
    if (linesProp === undefined) setInner(next);
    onLinesChange?.(next);
  };
  const patch = (id: string, p: Partial<QuoteLine>) =>
    commit(lines.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const moveLine = (i: number, d: -1 | 1) => {
    const next = [...lines];
    const a = next[i];
    const b = next[i + d];
    if (!a || !b) return;
    next[i] = b;
    next[i + d] = a;
    commit(next);
  };
  const addProduct = (id: string) => {
    if (id === "__custom") {
      commit([
        ...lines,
        {
          id: `l-${Date.now()}`,
          name: "",
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          taxRate: defaultTaxRate,
        },
      ]);
    } else {
      const p = products.find((x) => x.id === id);
      if (!p) return;
      const existing = lines.find((l) => l.sku && l.sku === p.sku);
      if (existing) patch(existing.id, { quantity: existing.quantity + 1 });
      else
        commit([
          ...lines,
          {
            id: `l-${Date.now()}`,
            name: p.name,
            sku: p.sku,
            quantity: 1,
            unitPrice: p.unitPrice,
            discount: 0,
            taxRate: p.taxRate ?? defaultTaxRate,
          },
        ]);
    }
    setPicker("");
  };

  const errors = lines.map(lineErrors);
  const valid = lines.length > 0 && errors.every((e) => e.length === 0);
  const num = (v: string) => (v === "" ? NaN : Number(v));

  return (
    <section
      aria-label="Quote builder"
      className={cn(
        "flex flex-col rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-crm-soft">
            <tr className="border-b border-crm-border">
              <th className="w-8 px-2 py-2">
                <span className="sr-only">Order</span>
              </th>
              <th className="px-2 py-2 font-normal">Item</th>
              <th className="w-20 px-2 py-2 text-right font-normal">Qty</th>
              <th className="w-28 px-2 py-2 text-right font-normal">Unit price</th>
              <th className="w-20 px-2 py-2 text-right font-normal">Disc %</th>
              <th className="w-20 px-2 py-2 text-right font-normal">Tax %</th>
              <th className="w-28 px-2 py-2 text-right font-normal">Amount</th>
              <th className="w-8 px-2 py-2">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-xs text-crm-subtle">
                  No line items yet — add a product below.
                </td>
              </tr>
            ) : (
              lines.map((l, i) => {
                const err = (touched || l.name ? errors[i] : undefined) ?? [];
                const net = round2(l.quantity * l.unitPrice * (1 - l.discount / 100));
                const over = l.discount > maxDiscount;
                return (
                  <tr key={l.id} className="border-b border-crm-border align-top">
                    <td className="px-2 py-1.5">
                      {!readOnly ? (
                        <div className="flex flex-col">
                          <button
                            type="button"
                            aria-label={`Move ${l.name || "line"} up`}
                            disabled={i === 0}
                            onClick={() => moveLine(i, -1)}
                            className="text-crm-faint hover:text-crm-fg disabled:opacity-30"
                          >
                            <ArrowUp className="size-3" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${l.name || "line"} down`}
                            disabled={i === lines.length - 1}
                            onClick={() => moveLine(i, 1)}
                            className="text-crm-faint hover:text-crm-fg disabled:opacity-30"
                          >
                            <ArrowDown className="size-3" />
                          </button>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        aria-label={`Line ${i + 1} name`}
                        value={l.name}
                        disabled={readOnly}
                        placeholder="Description"
                        aria-invalid={err.some((e) => e.startsWith("Name")) || undefined}
                        onChange={(e) => patch(l.id, { name: e.target.value })}
                        className={cellInput}
                      />
                      {l.sku ? (
                        <span className="px-1.5 text-xs text-crm-subtle">{l.sku}</span>
                      ) : null}
                      {err.length ? (
                        <p role="alert" className="px-1.5 text-xs text-crm-danger">
                          {err.join(" · ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        aria-label={`Line ${i + 1} quantity`}
                        disabled={readOnly}
                        value={Number.isNaN(l.quantity) ? "" : l.quantity}
                        aria-invalid={err.some((e) => e.startsWith("Quantity")) || undefined}
                        onChange={(e) => patch(l.id, { quantity: num(e.target.value) })}
                        className={cn(cellInput, "text-right")}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        aria-label={`Line ${i + 1} unit price`}
                        disabled={readOnly}
                        value={Number.isNaN(l.unitPrice) ? "" : l.unitPrice}
                        onChange={(e) => patch(l.id, { unitPrice: num(e.target.value) })}
                        className={cn(cellInput, "text-right")}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        aria-label={`Line ${i + 1} discount percent`}
                        disabled={readOnly}
                        value={l.discount}
                        onChange={(e) => patch(l.id, { discount: num(e.target.value) || 0 })}
                        className={cn(cellInput, "text-right", over && "text-tag-amber-text")}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        aria-label={`Line ${i + 1} tax percent`}
                        disabled={readOnly}
                        value={l.taxRate}
                        onChange={(e) => patch(l.id, { taxRate: num(e.target.value) || 0 })}
                        className={cn(cellInput, "text-right")}
                      />
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {Number.isFinite(net) ? fmt.format(net) : "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      {!readOnly ? (
                        <button
                          type="button"
                          aria-label={`Remove ${l.name || "line"}`}
                          onClick={() => commit(lines.filter((x) => x.id !== l.id))}
                          className="rounded p-1 text-crm-soft hover:bg-crm-danger/15 hover:text-crm-danger"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 p-3 sm:flex-row sm:items-start sm:justify-between">
        {!readOnly ? (
          <label className="flex items-center gap-2 text-xs text-crm-soft">
            <Plus className="size-3.5" aria-hidden />
            <select
              aria-label="Add line item"
              value={picker}
              onChange={(e) => addProduct(e.target.value)}
              className="h-7 rounded-crm border border-crm-border bg-crm-bg px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <option value="">Add product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {fmt.format(p.unitPrice)}
                </option>
              ))}
              <option value="__custom">Custom line</option>
            </select>
          </label>
        ) : (
          <span />
        )}

        <dl className="grid w-full grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm sm:w-72">
          <dt className="text-crm-soft">Subtotal</dt>
          <dd className="text-right tabular-nums">{fmt.format(totals.subtotal)}</dd>
          <dt className="text-crm-soft">Discount</dt>
          <dd className="text-right tabular-nums text-crm-success">
            {totals.discount ? `−${fmt.format(totals.discount)}` : fmt.format(0)}
          </dd>
          <dt className="text-crm-soft">Tax</dt>
          <dd className="text-right tabular-nums">{fmt.format(totals.tax)}</dd>
          <dt className="border-t border-crm-border pt-1.5 font-medium">Total</dt>
          <dd
            className="border-t border-crm-border pt-1.5 text-right text-base font-medium tabular-nums"
            aria-live="polite"
          >
            {fmt.format(totals.total)}
          </dd>
          {validUntil ? (
            <>
              <dt className="crm-caption text-crm-subtle">Valid until</dt>
              <dd className="crm-caption text-right text-crm-subtle">
                {new Date(validUntil + "T00:00:00").toLocaleDateString(locale, {
                  dateStyle: "medium",
                })}
              </dd>
            </>
          ) : null}
        </dl>
      </div>

      {!readOnly && onSubmit ? (
        <footer className="flex flex-wrap items-center gap-2 border-t border-crm-border p-3">
          {totals.needsApproval ? (
            <Tag color="amber" size="sm" className="gap-1">
              <AlertTriangle className="size-3" aria-hidden /> Discount over {maxDiscount}% needs
              approval
            </Tag>
          ) : null}
          <Button
            className="ml-auto"
            loading={submitting}
            disabled={submitting || lines.length === 0}
            onClick={() => {
              setTouched(true);
              if (valid) onSubmit(lines, totals);
            }}
          >
            {totals.needsApproval ? "Request approval" : "Save quote"}
          </Button>
        </footer>
      ) : null}
    </section>
  );
}
