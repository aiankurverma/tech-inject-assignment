import * as React from "react";
import { Check, Copy, Mail, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { StatusBadge } from "@/components/crm/badge";

export interface ReceiptItem {
  id: string;
  name: string;
  /** SKU or plan code shown as a caption. */
  sku?: string;
  quantity: number;
  unitPrice: number;
  /** Absolute discount for this line. */
  discount?: number;
}

export interface ReceiptPayment {
  id: string;
  /** e.g. "Visa •••• 4242", "UPI", "Cash". */
  method: string;
  amount: number;
  /** Negative-flow payments (refunds). */
  refund?: boolean;
  date?: Date;
}

export interface ReceiptMerchant {
  name: string;
  address?: string[];
  taxId?: string;
  email?: string;
  logo?: React.ReactNode;
}

export interface ReceiptProps {
  receiptNumber: string;
  issuedAt: Date;
  merchant: ReceiptMerchant;
  customer?: { name: string; email?: string; address?: string[] };
  items: ReceiptItem[];
  /** Percent tax applied on the discounted subtotal. */
  taxRate?: number;
  taxLabel?: string;
  shipping?: number;
  tip?: number;
  payments: ReceiptPayment[];
  currency?: string;
  locale?: string;
  footerNote?: string;
  onEmail?: () => void;
  /** Override the print action (defaults to window.print()). */
  onPrint?: () => void;
  className?: string;
}

export interface ReceiptTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  refunded: number;
  balance: number;
  status: "paid" | "partial" | "refunded" | "unpaid" | "overpaid";
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Totals, payments and settlement status for a receipt. */
export function computeReceipt(
  items: ReceiptItem[],
  payments: ReceiptPayment[],
  {
    taxRate = 0,
    shipping = 0,
    tip = 0,
  }: { taxRate?: number; shipping?: number; tip?: number } = {},
): ReceiptTotals {
  const subtotal = r2(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const discount = r2(items.reduce((s, i) => s + (i.discount ?? 0), 0));
  const tax = r2((subtotal - discount) * (taxRate / 100));
  const total = r2(subtotal - discount + tax + shipping + tip);
  const paid = r2(payments.filter((p) => !p.refund).reduce((s, p) => s + p.amount, 0));
  const refunded = r2(payments.filter((p) => p.refund).reduce((s, p) => s + p.amount, 0));
  const net = r2(paid - refunded);
  const balance = r2(total - net);
  const status: ReceiptTotals["status"] =
    refunded > 0 && net <= 0
      ? "refunded"
      : net <= 0
        ? "unpaid"
        : balance > 0
          ? "partial"
          : balance < 0
            ? "overpaid"
            : "paid";
  return { subtotal, discount, tax, total, paid, refunded, balance, status };
}

const statusMeta = {
  paid: { label: "Paid", dot: "active" },
  partial: { label: "Partially paid", dot: "warning" },
  refunded: { label: "Refunded", dot: "neutral" },
  unpaid: { label: "Unpaid", dot: "danger" },
  overpaid: { label: "Change due", dot: "warning" },
} as const;

/** Printable receipt with line items, discounts, tax, split payments/refunds, balance and print/email/copy actions. */
export function Receipt({
  receiptNumber,
  issuedAt,
  merchant,
  customer,
  items,
  taxRate = 0,
  taxLabel = "Tax",
  shipping = 0,
  tip = 0,
  payments,
  currency = "USD",
  locale = "en-US",
  footerNote,
  onEmail,
  onPrint,
  className,
}: ReceiptProps) {
  const t = computeReceipt(items, payments, { taxRate, shipping, tip });
  const [copied, setCopied] = React.useState(false);
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
  const meta = statusMeta[t.status];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(receiptNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const row = (label: React.ReactNode, value: React.ReactNode, strong?: boolean) => (
    <div
      className={cn(
        "flex justify-between gap-4",
        strong ? "text-base font-medium" : "text-crm-soft",
      )}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );

  return (
    <article
      aria-label={`Receipt ${receiptNumber}`}
      className={cn(
        "w-full max-w-[420px] rounded-crm border border-crm-border bg-crm-card font-crm text-sm text-crm-fg shadow-crm-raised",
        "print:max-w-none print:border-0 print:bg-white print:text-black print:shadow-none",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-dashed border-crm-border px-5 py-4">
        <div className="flex items-start gap-3">
          {merchant.logo ? (
            <span className="grid size-9 place-items-center rounded-crm bg-crm-muted [&_svg]:size-4">
              {merchant.logo}
            </span>
          ) : null}
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{merchant.name}</span>
            {merchant.address?.map((l) => (
              <span key={l} className="text-xs text-crm-muted-fg">
                {l}
              </span>
            ))}
            {merchant.taxId ? (
              <span className="text-xs text-crm-subtle">Tax ID {merchant.taxId}</span>
            ) : null}
          </div>
        </div>
        <StatusBadge status={meta.dot}>{meta.label}</StatusBadge>
      </header>

      <div className="flex flex-wrap justify-between gap-3 px-5 py-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="crm-eyebrow text-crm-faint">Receipt</span>
          <span className="flex items-center gap-1 font-mono text-crm-fg">
            {receiptNumber}
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? "Copied" : "Copy receipt number"}
              className="rounded p-0.5 text-crm-subtle outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 print:hidden"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            </button>
          </span>
          <time dateTime={issuedAt.toISOString()} className="text-crm-muted-fg">
            {issuedAt.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </div>
        {customer ? (
          <div className="flex flex-col gap-0.5 text-right">
            <span className="crm-eyebrow text-crm-faint">Billed to</span>
            <span className="text-crm-fg">{customer.name}</span>
            {customer.email ? <span className="text-crm-muted-fg">{customer.email}</span> : null}
            {customer.address?.map((l) => (
              <span key={l} className="text-crm-muted-fg">
                {l}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-6 text-center text-xs text-crm-subtle">No items on this receipt.</p>
      ) : (
        <table className="w-full border-y border-dashed border-crm-border text-left">
          <caption className="sr-only">Items</caption>
          <thead>
            <tr className="crm-caption text-crm-subtle">
              <th scope="col" className="px-5 py-2 font-normal">
                Item
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Qty
              </th>
              <th scope="col" className="px-5 py-2 text-right font-normal">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="align-top">
                <td className="px-5 py-1.5">
                  <span className="block">{i.name}</span>
                  <span className="text-xs text-crm-subtle">
                    {i.sku ? `${i.sku} · ` : ""}
                    {fmt(i.unitPrice)} ea
                    {i.discount ? ` · −${fmt(i.discount)}` : ""}
                  </span>
                </td>
                <td className="py-1.5 text-right tabular-nums">{i.quantity}</td>
                <td className="px-5 py-1.5 text-right tabular-nums">
                  {fmt(i.quantity * i.unitPrice - (i.discount ?? 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <dl className="flex flex-col gap-1.5 px-5 py-3">
        {row("Subtotal", fmt(t.subtotal))}
        {t.discount ? row("Discounts", `−${fmt(t.discount)}`) : null}
        {taxRate ? row(`${taxLabel} (${taxRate}%)`, fmt(t.tax)) : null}
        {shipping ? row("Shipping", fmt(shipping)) : null}
        {tip ? row("Tip", fmt(tip)) : null}
        <div className="my-1 border-t border-dashed border-crm-border" />
        {row("Total", fmt(t.total), true)}
      </dl>

      <div className="border-t border-dashed border-crm-border px-5 py-3">
        <p className="crm-eyebrow mb-1.5 text-crm-faint">Payments</p>
        {payments.length === 0 ? (
          <p className="text-xs text-crm-subtle">No payments recorded.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-xs">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span className="text-crm-soft">
                  {p.refund ? "Refund to " : ""}
                  {p.method}
                  {p.date ? (
                    <span className="text-crm-subtle">
                      {" "}
                      · {p.date.toLocaleDateString(locale, { month: "short", day: "numeric" })}
                    </span>
                  ) : null}
                </span>
                <span className={cn("tabular-nums", p.refund && "text-crm-danger")}>
                  {p.refund ? "−" : ""}
                  {fmt(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div
          className={cn(
            "mt-2 flex justify-between text-sm font-medium",
            t.balance > 0 ? "text-crm-warning" : "text-crm-fg",
          )}
        >
          <span>{t.balance < 0 ? "Change due" : "Balance due"}</span>
          <span className="tabular-nums">{fmt(Math.abs(t.balance))}</span>
        </div>
      </div>

      {footerNote ? (
        <p className="border-t border-dashed border-crm-border px-5 py-3 text-center text-xs text-crm-muted-fg">
          {footerNote}
        </p>
      ) : null}

      <footer className="flex justify-end gap-2 border-t border-crm-border px-5 py-3 print:hidden">
        {onEmail ? (
          <Button variant="ghost" onClick={onEmail}>
            <Mail /> Email
          </Button>
        ) : null}
        <Button onClick={() => (onPrint ? onPrint() : window.print())}>
          <Printer /> Print
        </Button>
      </footer>
    </article>
  );
}
