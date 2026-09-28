import * as React from "react";
import { InvoiceDetail, type Invoice } from "@/components/crm/invoice-detail";

const initial: Invoice = {
  number: "INV-2026-0418",
  issueDate: "2026-08-29",
  dueDate: "2026-09-25",
  currency: "USD",
  status: "sent",
  billTo: {
    name: "Dana Whitfield",
    company: "Northwind Traders",
    email: "ap@northwind.com",
    address: "500 Market St, Suite 1200\nSan Francisco, CA 94105",
  },
  from: {
    name: "Kitbase Inc.",
    address: "88 Colin P Kelly Jr St\nSan Francisco, CA 94107",
    taxId: "84-2197731",
  },
  items: [
    {
      id: "i1",
      description: "Platform Pro seat — annual (Oct 2026 – Sep 2027)",
      quantity: 120,
      unitPrice: 499.8,
      taxRate: 8.25,
    },
    {
      id: "i2",
      description: "Power Dialer add-on — annual",
      quantity: 40,
      unitPrice: 225,
      taxRate: 8.25,
    },
    { id: "i3", description: "Guided onboarding (20h)", quantity: 1, unitPrice: 3500 },
  ],
  payments: [
    { id: "pay1", date: "2026-09-15", amount: 30000, method: "wire", reference: "WF-88213" },
  ],
  notes: "Net 30. Please reference the invoice number on your remittance.",
};

export default function Example() {
  const [invoice, setInvoice] = React.useState(initial);
  return (
    <div className="w-full max-w-[860px]">
      <InvoiceDetail
        invoice={invoice}
        today="2026-09-28"
        onSend={() => console.log("send reminder")}
        onDownload={() => console.log("download pdf")}
        onRecordPayment={(p) =>
          setInvoice((inv) => ({
            ...inv,
            payments: [...(inv.payments ?? []), { ...p, id: `pay${Date.now()}` }],
          }))
        }
      />
    </div>
  );
}
