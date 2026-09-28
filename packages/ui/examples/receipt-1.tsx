import { useState } from "react";
import { Coffee } from "lucide-react";
import { Receipt, type ReceiptPayment } from "@/components/crm/receipt";

const basePayments: ReceiptPayment[] = [
  { id: "p1", method: "Visa •••• 4242", amount: 120, date: new Date("2026-09-27T18:42:00") },
  { id: "p2", method: "Gift card GC-8812", amount: 25, date: new Date("2026-09-27T18:43:00") },
];

export default function Example() {
  const [payments, setPayments] = useState(basePayments);
  const [sent, setSent] = useState(false);
  return (
    <div className="flex flex-col items-center gap-3 font-crm">
      <Receipt
        receiptNumber="RCPT-2026-004187"
        issuedAt={new Date("2026-09-27T18:41:00")}
        merchant={{
          name: "Bluebird Roastery",
          logo: <Coffee />,
          address: ["214 Valencia St", "San Francisco, CA 94103"],
          taxId: "94-3187732",
        }}
        customer={{ name: "Priya Raman", email: "priya@northwind.io" }}
        items={[
          {
            id: "1",
            name: "Ethiopia Guji — 1kg",
            sku: "BN-ETH-1K",
            quantity: 2,
            unitPrice: 42,
            discount: 8.4,
          },
          { id: "2", name: "Pour-over kit", sku: "KIT-V60", quantity: 1, unitPrice: 36 },
          { id: "3", name: "Oat flat white", quantity: 3, unitPrice: 5.75 },
        ]}
        taxRate={8.625}
        taxLabel="SF sales tax"
        tip={6}
        payments={payments}
        footerNote="Returns accepted within 30 days with this receipt."
        onEmail={() => setSent(true)}
      />
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          className="rounded-full bg-crm-raised px-3 py-1 text-crm-fg"
          onClick={() =>
            setPayments((p) => [...p, { id: `p${p.length + 1}`, method: "Cash", amount: 20 }])
          }
        >
          Add $20 cash
        </button>
        <button
          type="button"
          className="rounded-full bg-crm-raised px-3 py-1 text-crm-fg"
          onClick={() =>
            setPayments((p) => [
              ...p,
              { id: `r${p.length}`, method: "Visa •••• 4242", amount: 36, refund: true },
            ])
          }
        >
          Refund kit
        </button>
        {sent ? <span className="text-crm-success">Emailed to customer</span> : null}
      </div>
    </div>
  );
}
