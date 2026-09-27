import * as React from "react";
import { CalendarDays, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MoneyValueProps {
  amount: number;
  currency?: string;
  className?: string;
}

/** Amount with a muted currency sign: "$ 530,111". */
export function MoneyValue({ amount, currency = "$", className }: MoneyValueProps) {
  return (
    <span className={cn("inline-flex items-baseline gap-1 font-crm text-sm text-crm-fg tabular-nums", className)}>
      <span className="text-crm-subtle">{currency}</span>
      {amount.toLocaleString("en-US")}
    </span>
  );
}

export interface DateCellProps {
  date: string;
  /** Interaction type shown after a divider, e.g. "Demo". */
  type?: string;
  className?: string;
}

/** Calendar icon + date, optional divider + type. */
export function DateCell({ date, type, className }: DateCellProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-crm text-sm text-crm-fg", className)}>
      <CalendarDays className="size-3.5 text-crm-soft" aria-hidden />
      {date}
      {type ? (
        <>
          <span className="h-3 w-px bg-crm-input" aria-hidden />
          {type}
        </>
      ) : null}
    </span>
  );
}

export interface ContactLineProps {
  email?: string;
  phone?: string;
  /** Leading node, e.g. an Avatar with the name. */
  lead?: React.ReactNode;
  className?: string;
}

/** Row of contact details with mail and phone icons. */
export function ContactLine({ email, phone, lead, className }: ContactLineProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 font-crm text-sm text-crm-fg", className)}>
      {lead}
      {email ? (
        <a href={`mailto:${email}`} className="flex items-center gap-1.5 rounded hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:outline-none">
          <Mail className="size-3 text-crm-soft" aria-hidden />
          {email}
        </a>
      ) : null}
      {phone ? (
        <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="flex items-center gap-1.5 rounded hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:outline-none">
          <Phone className="size-3 text-crm-soft" aria-hidden />
          {phone}
        </a>
      ) : null}
    </div>
  );
}
