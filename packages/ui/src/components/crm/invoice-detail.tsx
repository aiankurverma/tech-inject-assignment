import * as React from "react";
import { CreditCard, Download, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Tag, type TagColor } from "@/components/crm/tag";

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Percent. */
  taxRate?: number;
}

export interface InvoicePayment {
  id: string;
  /** ISO date. */
  date: string;
  amount: number;
  method: "card" | "ach" | "wire" | "check" | "cash";
  reference?: string;
}

export interface Invoice {
  number: string;
  /** ISO dates. */
  issueDate: string;
  dueDate: string;
  currency?: string;
  status?: "draft" | "sent" | "void";
  billTo: { name: string; company?: string; email?: string; address?: string };
  from: { name: string; address?: string; taxId?: string };
  items: InvoiceLineItem[];
  payments?: InvoicePayment[];
  notes?: string;
}

export type InvoiceState = "draft" | "void" | "paid" | "partial" | "overdue" | "open";

export interface InvoiceDetailProps {
  invoice: Invoice;
  locale?: string;
  /** Reference date for overdue logic (ISO). Defaults to today. */
  today?: string;
  /** Called with a validated payment; append it to invoice.payments to reflect it. */
  onRecordPayment?: (payment: Omit<InvoicePayment, "id">) => void | Promise<void>;
  onSend?: () => void;
  onDownload?: () => void;
  className?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const METHOD_LABEL: Record<InvoicePayment["method"], string> = {
  card: "Card",
  ach: "ACH",
  wire: "Wire",
  check: "Check",
  cash: "Cash",
};
const STATE: Record<InvoiceState, { label: string; color: TagColor }> = {
  draft: { label: "Draft", color: "neutral" },
  void: { label: "Void", color: "neutral" },
  paid: { label: "Paid", color: "green" },
  partial: { label: "Partially paid", color: "blue" },
  overdue: { label: "Overdue", color: "red" },
  open: { label: "Open", color: "purple" },
};

/** Derives subtotal/tax/total/paid/balance and the effective status of an invoice. */
export function summarizeInvoice(inv: Invoice, today: string) {
  const subtotal = r2(inv.items.reduce((s, i) => s + r2(i.quantity * i.unitPrice), 0));
  const tax = r2(
    inv.items.reduce((s, i) => s + r2((i.quantity * i.unitPrice * (i.taxRate ?? 0)) / 100), 0),
  );
  const total = r2(subtotal + tax);
  const paid = r2((inv.payments ?? []).reduce((s, p) => s + p.amount, 0));
  const balance = r2(Math.max(0, total - paid));
  const daysOverdue = Math.floor((Date.parse(today) - Date.parse(inv.dueDate)) / 86_400_000);
  const state: InvoiceState =
    inv.status === "draft" || inv.status === "void"
      ? inv.status
      : balance === 0
        ? "paid"
        : daysOverdue > 0
          ? "overdue"
          : paid > 0
            ? "partial"
            : "open";
  return { subtotal, tax, total, paid, balance, state, daysOverdue };
}

/** Invoice document view with computed status, balance, payment history and a validated "record payment" form. */
export function InvoiceDetail({
  invoice,
  locale = "en-US",
  today = new Date().toISOString().slice(0, 10),
  onRecordPayment,
  onSend,
  onDownload,
  className,
}: InvoiceDetailProps) {
  const fmt = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency: invoice.currency ?? "USD" }),
    [locale, invoice.currency],
  );
  const date = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(locale, { dateStyle: "medium" });
  const s = summarizeInvoice(invoice, today);
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<InvoicePayment["method"]>("ach");
  const [payDate, setPayDate] = React.useState(today);
  const [reference, setReference] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const canPay = onRecordPayment && s.balance > 0 && s.state !== "draft" && s.state !== "void";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!amount || !(n > 0)) return setErr("Enter an amount greater than zero.");
    if (r2(n) > s.balance) return setErr(`Amount exceeds the balance of ${fmt.format(s.balance)}.`);
    if (payDate > today) return setErr("Payment date can't be in the future.");
    setErr(null);
    setSaving(true);
    try {
      await onRecordPayment?.({
        amount: r2(n),
        method,
        date: payDate,
        reference: reference || undefined,
      });
      setOpen(false);
      setAmount("");
      setReference("");
    } catch (x) {
      setErr((x as Error).message || "Could not record payment.");
    } finally {
      setSaving(false);
    }
  };

  const pct = s.total ? Math.min(100, (s.paid / s.total) * 100) : 0;
  const field =
    "h-8 w-full rounded-crm border border-crm-border bg-crm-bg px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60";

  return (
    <article
      aria-label={`Invoice ${invoice.number}`}
      className={cn(
        "flex flex-col gap-5 rounded-crm border border-crm-border bg-crm-card p-5 font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-start gap-3">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Invoice</p>
          <h2 className="text-lg font-medium tabular-nums">{invoice.number}</h2>
        </div>
        <Tag color={STATE[s.state].color}>{STATE[s.state].label}</Tag>
        {s.state === "overdue" ? (
          <span className="text-xs text-crm-danger">{s.daysOverdue} days past due</span>
        ) : null}
        <div className="ml-auto flex gap-2">
          {onDownload ? (
            <Button variant="secondary" size="sm" onClick={onDownload}>
              <Download className="size-3" aria-hidden /> PDF
            </Button>
          ) : null}
          {onSend && s.state !== "paid" && s.state !== "void" ? (
            <Button variant="secondary" size="sm" onClick={onSend}>
              <Send className="size-3" aria-hidden />{" "}
              {s.state === "draft" ? "Send" : "Send reminder"}
            </Button>
          ) : null}
          {canPay ? (
            <Button size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              <CreditCard className="size-3" aria-hidden /> Record payment
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="crm-caption text-crm-subtle">Bill to</p>
          <p className="font-medium">{invoice.billTo.company ?? invoice.billTo.name}</p>
          {invoice.billTo.company ? <p className="text-crm-soft">{invoice.billTo.name}</p> : null}
          {invoice.billTo.email ? <p className="text-crm-soft">{invoice.billTo.email}</p> : null}
          {invoice.billTo.address ? (
            <p className="whitespace-pre-line text-crm-soft">{invoice.billTo.address}</p>
          ) : null}
        </div>
        <div>
          <p className="crm-caption text-crm-subtle">From</p>
          <p className="font-medium">{invoice.from.name}</p>
          {invoice.from.address ? (
            <p className="whitespace-pre-line text-crm-soft">{invoice.from.address}</p>
          ) : null}
          {invoice.from.taxId ? <p className="text-crm-soft">Tax ID {invoice.from.taxId}</p> : null}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 self-start">
          <dt className="text-crm-subtle">Issued</dt>
          <dd className="text-right">{date(invoice.issueDate)}</dd>
          <dt className="text-crm-subtle">Due</dt>
          <dd className={cn("text-right", s.state === "overdue" && "text-crm-danger")}>
            {date(invoice.dueDate)}
          </dd>
          <dt className="text-crm-subtle">Balance</dt>
          <dd className="text-right font-medium tabular-nums">{fmt.format(s.balance)}</dd>
        </dl>
      </div>

      {open && canPay ? (
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-3 rounded-crm border border-crm-border bg-crm-bg p-3 sm:grid-cols-5 sm:items-end"
        >
          <label className="flex flex-col gap-1 text-xs text-crm-soft sm:col-span-1">
            Amount
            <input
              className={field}
              inputMode="decimal"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={!!err || undefined}
              aria-describedby="inv-pay-err"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Method
            <select
              className={field}
              value={method}
              onChange={(e) => setMethod(e.target.value as InvoicePayment["method"])}
            >
              {Object.entries(METHOD_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Date
            <input
              className={field}
              type="date"
              max={today}
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-crm-soft">
            Reference
            <input
              className={field}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAmount(String(s.balance))}
            >
              Full
            </Button>
            <Button type="submit" size="sm" loading={saving} disabled={saving}>
              Save
            </Button>
          </div>
          {err ? (
            <p id="inv-pay-err" role="alert" className="text-xs text-crm-danger sm:col-span-5">
              {err}
            </p>
          ) : null}
        </form>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-xs text-crm-soft">
            <tr className="border-b border-crm-border">
              <th className="py-2 font-normal">Description</th>
              <th className="py-2 text-right font-normal">Qty</th>
              <th className="py-2 text-right font-normal">Unit</th>
              <th className="py-2 text-right font-normal">Tax</th>
              <th className="py-2 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((i) => (
              <tr key={i.id} className="border-b border-crm-border">
                <td className="py-2 pr-3">{i.description}</td>
                <td className="py-2 text-right tabular-nums">{i.quantity}</td>
                <td className="py-2 text-right tabular-nums">{fmt.format(i.unitPrice)}</td>
                <td className="py-2 text-right text-crm-soft tabular-nums">
                  {i.taxRate ? `${i.taxRate}%` : "—"}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {fmt.format(r2(i.quantity * i.unitPrice))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:justify-between">
        <div className="flex-1 sm:max-w-sm">
          <p className="crm-eyebrow mb-2 text-crm-subtle">Payments</p>
          {(invoice.payments ?? []).length === 0 ? (
            <p className="text-xs text-crm-subtle">No payments recorded.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {[...(invoice.payments ?? [])]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="text-crm-soft">{date(p.date)}</span>
                    <Tag size="sm">{METHOD_LABEL[p.method]}</Tag>
                    {p.reference ? (
                      <span className="truncate text-xs text-crm-subtle">{p.reference}</span>
                    ) : null}
                    <span className="ml-auto tabular-nums text-crm-success">
                      {fmt.format(p.amount)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <div
            role="progressbar"
            aria-label="Amount paid"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-crm-track"
          >
            <div className="h-full rounded-full bg-crm-success" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <dl className="grid w-full grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm sm:w-64">
          <dt className="text-crm-soft">Subtotal</dt>
          <dd className="text-right tabular-nums">{fmt.format(s.subtotal)}</dd>
          <dt className="text-crm-soft">Tax</dt>
          <dd className="text-right tabular-nums">{fmt.format(s.tax)}</dd>
          <dt className="font-medium">Total</dt>
          <dd className="text-right font-medium tabular-nums">{fmt.format(s.total)}</dd>
          <dt className="text-crm-soft">Paid</dt>
          <dd className="text-right tabular-nums">−{fmt.format(s.paid)}</dd>
          <dt className="border-t border-crm-border pt-1.5 font-medium">Balance due</dt>
          <dd
            className={cn(
              "border-t border-crm-border pt-1.5 text-right text-base font-medium tabular-nums",
              s.state === "overdue" && "text-crm-danger",
            )}
          >
            {fmt.format(s.balance)}
          </dd>
        </dl>
      </div>

      {invoice.notes ? (
        <p className="border-t border-crm-border pt-3 text-xs whitespace-pre-line text-crm-soft">
          {invoice.notes}
        </p>
      ) : null}
    </article>
  );
}
