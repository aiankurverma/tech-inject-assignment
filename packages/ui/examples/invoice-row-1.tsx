import * as React from "react";
import { InvoiceRow, invoiceDisplayState, type Invoice } from "@/components/crm/invoice-row";

const now = new Date("2026-09-28T10:00:00Z");
const invoices: Invoice[] = [
  {
    id: "1",
    number: "INV-2026-0418",
    customer: "Northwind Logistics",
    issuedAt: "2026-09-01",
    dueAt: "2026-10-01",
    amount: 12480,
    currency: "USD",
    status: "open",
  },
  {
    id: "2",
    number: "INV-2026-0401",
    customer: "Acme Robotics",
    issuedAt: "2026-08-10",
    dueAt: "2026-09-09",
    amount: 8400,
    amountPaid: 3000,
    currency: "USD",
    status: "partially_paid",
  },
  {
    id: "3",
    number: "INV-2026-0388",
    customer: "Globex Health",
    issuedAt: "2026-08-01",
    dueAt: "2026-08-31",
    amount: 2150.5,
    currency: "USD",
    status: "open",
  },
  {
    id: "4",
    number: "INV-2026-0372",
    customer: "Initech",
    issuedAt: "2026-07-15",
    dueAt: "2026-08-14",
    amount: 5600,
    currency: "USD",
    status: "paid",
  },
  {
    id: "5",
    number: "INV-2026-0365",
    customer: "Umbrella Retail",
    issuedAt: "2026-07-02",
    dueAt: "2026-08-01",
    amount: 990,
    currency: "USD",
    status: "void",
  },
  {
    id: "6",
    number: "DRAFT-0042",
    customer: "Stark Components",
    issuedAt: "2026-09-27",
    dueAt: "2026-10-27",
    amount: 18900,
    currency: "USD",
    status: "draft",
  },
];

export default function Example() {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [log, setLog] = React.useState("");
  const outstanding = invoices
    .filter((i) => selected.has(i.id))
    .reduce((s, i) => s + invoiceDisplayState(i, now).balance, 0);
  return (
    <div
      className="w-full max-w-3xl rounded-crm border border-crm-border bg-crm-card"
      role="table"
      aria-label="Invoices"
    >
      {invoices.map((inv) => (
        <InvoiceRow
          key={inv.id}
          invoice={inv}
          now={now}
          selected={selected.has(inv.id)}
          onSelectedChange={(on) =>
            setSelected((s) => {
              const n = new Set(s);
              if (on) n.add(inv.id);
              else n.delete(inv.id);
              return n;
            })
          }
          onOpen={(i) => setLog(`Opened ${i.number}`)}
          onDownload={(i) => setLog(`Downloading ${i.number}.pdf`)}
          onMore={(i) => setLog(`Actions for ${i.number}`)}
        />
      ))}
      <div className="flex justify-between px-3 py-2 text-xs text-crm-soft">
        <span>{log || "Select invoices to send reminders"}</span>
        <span className="tabular-nums">
          {selected.size} selected · $
          {outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })} outstanding
        </span>
      </div>
    </div>
  );
}
