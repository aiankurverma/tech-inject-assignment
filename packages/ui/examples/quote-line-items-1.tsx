import * as React from "react";
import { QuoteLineItems, quoteTotals, type QuoteLineItem } from "@/components/crm/quote-line-items";

const initial: QuoteLineItem[] = [
  {
    id: "l1",
    name: "Growth plan licence",
    sku: "CRM-GRW-Y",
    term: "per seat / year",
    quantity: 40,
    unitPrice: 468,
    discount: 15,
    taxRate: 18,
  },
  {
    id: "l2",
    name: "Onboarding & data migration",
    sku: "SVC-ONB",
    term: "one-time",
    quantity: 1,
    unitPrice: 6500,
    discount: 0,
    taxRate: 18,
  },
  {
    id: "l3",
    name: "Premium support add-on",
    sku: "SUP-PRM-Y",
    term: "per year",
    quantity: 1,
    unitPrice: 4800,
    discount: 25,
    taxRate: 18,
  },
  {
    id: "l4",
    name: "Admin training (remote)",
    sku: "SVC-TRN",
    term: "per session",
    quantity: 3,
    unitPrice: 750,
    discount: 0,
    taxRate: 5,
  },
];

export default function Example() {
  const [items, setItems] = React.useState(initial);
  const t = quoteTotals(items);
  return (
    <div className="flex w-full max-w-4xl flex-col gap-2">
      <QuoteLineItems items={items} onItemsChange={setItems} defaultTaxRate={18} maxDiscount={20} />
      <p className="text-right text-[11px] text-crm-soft">
        Q-2026-117 · Effective discount{" "}
        {t.subtotal ? ((t.discount / t.subtotal) * 100).toFixed(1) : "0"}%
      </p>
    </div>
  );
}
