import * as React from "react";
import { OrderSummary, type OrderSummaryItem } from "@/components/crm/order-summary";

const base: OrderSummaryItem[] = [
  { id: "p", name: "Growth plan", detail: "Annual · per seat", quantity: 25, unitPrice: 468 },
  { id: "a", name: "Advanced forecasting", detail: "Annual add-on", quantity: 1, unitPrice: 1200 },
  { id: "o", name: "Onboarding package", detail: "One-time", quantity: 1, unitPrice: 2500 },
  { id: "s", name: "Sandbox environment", detail: "Annual", quantity: 1, unitPrice: 600 },
  { id: "d", name: "Dialer minutes", detail: "Prepaid block of 1,000", quantity: 3, unitPrice: 45 },
];

export default function Example() {
  const [seats, setSeats] = React.useState(25);
  const [gst, setGst] = React.useState(false);
  const items = base.map((i) => (i.id === "p" ? { ...i, quantity: seats } : i));
  return (
    <div className="flex w-[360px] flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-crm-soft">
        <label className="flex items-center gap-2">
          Seats
          <input
            type="range"
            min={5}
            max={100}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            aria-label="Seats"
          />
          <span className="w-6 text-crm-fg tabular-nums">{seats}</span>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={gst} onChange={(e) => setGst(e.target.checked)} />
          GST inclusive
        </label>
      </div>
      <OrderSummary
        items={items}
        discounts={[
          { label: "Annual prepay", type: "percent", value: 10 },
          { label: "PARTNER500", type: "amount", value: 500 },
        ]}
        taxRate={gst ? 18 : 8.875}
        taxLabel={gst ? "GST" : "NY sales tax"}
        taxInclusive={gst}
        credit={350}
        totalSuffix="/ year"
        footer={
          <button
            type="button"
            className="h-8 rounded-full bg-crm-primary text-xs font-medium text-crm-primary-fg"
          >
            Confirm and pay
          </button>
        }
      />
    </div>
  );
}
