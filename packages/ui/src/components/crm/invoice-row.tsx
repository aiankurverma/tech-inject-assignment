import * as React from "react";
import { Download, FileText, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type InvoiceStatus = "draft" | "open" | "paid" | "partially_paid" | "void" | "uncollectible";

export interface Invoice {
  id: string;
  number: string;
  customer?: string;
  /** ISO date issued. */
  issuedAt: string;
  /** ISO due date. */
  dueAt: string;
  /** Total in major units. */
  amount: number;
  /** Amount already paid in major units. */
  amountPaid?: number;
  currency: string;
  status: InvoiceStatus;
}

export interface InvoiceRowProps {
  invoice: Invoice;
  locale?: string;
  now?: Date;
  selected?: boolean;
  /** Renders a checkbox for bulk actions when provided. */
  onSelectedChange?: (selected: boolean) => void;
  onOpen?: (invoice: Invoice) => void;
  onDownload?: (invoice: Invoice) => void;
  onMore?: (invoice: Invoice) => void;
  showCustomer?: boolean;
  className?: string;
}

const DAY = 86_400_000;

/** Derives the display state, turning open invoices past their due date into "overdue". */
export function invoiceDisplayState(inv: Invoice, now = new Date()) {
  const paid = inv.amountPaid ?? (inv.status === "paid" ? inv.amount : 0);
  const balance = Math.max(0, inv.amount - paid);
  const daysLate = Math.floor((now.getTime() - new Date(inv.dueAt).getTime()) / DAY);
  const overdue =
    (inv.status === "open" || inv.status === "partially_paid") && balance > 0 && daysLate > 0;
  return { paid, balance, daysLate, overdue };
}

const pill: Record<InvoiceStatus | "overdue", { label: string; cls: string }> = {
  draft: {
    label: "Draft",
    cls: "border-tag-neutral-border bg-tag-neutral-bg text-tag-neutral-text",
  },
  open: { label: "Open", cls: "border-tag-blue-border bg-tag-blue-bg text-tag-blue-text" },
  paid: { label: "Paid", cls: "border-tag-green-border bg-tag-green-bg text-tag-green-text" },
  partially_paid: {
    label: "Partial",
    cls: "border-tag-amber-border bg-tag-amber-bg text-tag-amber-text",
  },
  void: { label: "Void", cls: "border-tag-neutral-border bg-tag-neutral-bg text-tag-neutral-text" },
  uncollectible: {
    label: "Uncollectible",
    cls: "border-tag-red-border bg-tag-red-bg text-tag-red-text",
  },
  overdue: { label: "Overdue", cls: "border-tag-red-border bg-tag-red-bg text-tag-red-text" },
};

/** Invoice line for billing tables: number, dates, amount/balance, derived overdue state with days late, and row actions. */
export function InvoiceRow({
  invoice,
  locale,
  now,
  selected,
  onSelectedChange,
  onOpen,
  onDownload,
  onMore,
  showCustomer = true,
  className,
}: InvoiceRowProps) {
  const { balance, daysLate, overdue } = invoiceDisplayState(invoice, now);
  const key = overdue ? "overdue" : invoice.status;
  const p = pill[key];
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: invoice.currency });
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const muted = invoice.status === "void";
  const iconBtn =
    "inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-crm-muted-fg outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3.5";

  return (
    <div
      role="row"
      aria-selected={onSelectedChange ? !!selected : undefined}
      className={cn(
        "group flex min-w-0 items-center gap-3 border-b border-crm-border px-3 py-2.5 font-crm text-xs text-crm-fg",
        "hover:bg-crm-raised/60",
        selected && "bg-crm-primary/10",
        className,
      )}
    >
      {onSelectedChange ? (
        <span role="cell" className="flex shrink-0">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={(e) => onSelectedChange(e.target.checked)}
            aria-label={`Select invoice ${invoice.number}`}
            className="size-3.5 cursor-pointer accent-crm-primary"
          />
        </span>
      ) : null}
      <span role="cell" className="flex min-w-0 flex-1 items-center gap-2">
        <FileText className="size-3.5 shrink-0 text-crm-icon" aria-hidden />
        <span className="min-w-0">
          {onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(invoice)}
              className={cn(
                "block max-w-full cursor-pointer truncate rounded text-left font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                muted && "line-through text-crm-soft",
              )}
            >
              {invoice.number}
            </button>
          ) : (
            <span
              className={cn("block truncate font-medium", muted && "line-through text-crm-soft")}
            >
              {invoice.number}
            </span>
          )}
          {showCustomer && invoice.customer ? (
            <span className="block truncate text-crm-soft">{invoice.customer}</span>
          ) : null}
        </span>
      </span>
      <span role="cell" className="hidden w-24 shrink-0 text-crm-soft sm:block">
        {date.format(new Date(invoice.issuedAt))}
      </span>
      <span
        role="cell"
        className={cn(
          "hidden w-28 shrink-0 md:block",
          overdue ? "text-crm-danger" : "text-crm-soft",
        )}
      >
        {date.format(new Date(invoice.dueAt))}
        {overdue ? <span className="block text-[11px]">{daysLate}d late</span> : null}
      </span>
      <span role="cell" className="w-28 shrink-0 text-right tabular-nums">
        <span className={cn("block", muted && "text-crm-soft line-through")}>
          {money.format(invoice.amount)}
        </span>
        {balance > 0 && balance < invoice.amount ? (
          <span className="block text-[11px] text-crm-soft">{money.format(balance)} due</span>
        ) : null}
      </span>
      <span role="cell" className="flex w-24 shrink-0 justify-end">
        <span
          className={cn(
            "inline-flex h-[20px] items-center rounded-full border px-1.5 text-[11px] leading-none whitespace-nowrap",
            p.cls,
          )}
        >
          {p.label}
        </span>
      </span>
      <span role="cell" className="flex shrink-0 items-center gap-0.5">
        {onDownload ? (
          <button
            type="button"
            className={iconBtn}
            onClick={() => onDownload(invoice)}
            disabled={invoice.status === "draft"}
            aria-label={`Download PDF for ${invoice.number}`}
          >
            <Download aria-hidden />
          </button>
        ) : null}
        {onMore ? (
          <button
            type="button"
            className={iconBtn}
            onClick={() => onMore(invoice)}
            aria-label={`More actions for ${invoice.number}`}
          >
            <MoreHorizontal aria-hidden />
          </button>
        ) : null}
      </span>
    </div>
  );
}
