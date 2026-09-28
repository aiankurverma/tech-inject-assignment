import * as React from "react";
import { PaymentMethod, type PaymentMethodData } from "@/components/crm/payment-method";

const now = new Date("2026-09-28T10:00:00Z");
const initial: PaymentMethodData[] = [
  {
    id: "pm_1",
    type: "card",
    brand: "visa",
    last4: "4242",
    expMonth: 3,
    expYear: 2028,
    holder: "Priya Sharma",
    isDefault: true,
  },
  {
    id: "pm_2",
    type: "card",
    brand: "amex",
    last4: "0005",
    expMonth: 10,
    expYear: 2026,
    holder: "Priya Sharma",
  },
  {
    id: "pm_3",
    type: "card",
    brand: "mastercard",
    last4: "4444",
    expMonth: 6,
    expYear: 2026,
    holder: "Finance Team",
  },
  { id: "pm_4", type: "bank", bankName: "Chase Business", last4: "6789" },
];

export default function Example() {
  const [methods, setMethods] = React.useState(initial);
  const [pay, setPay] = React.useState("pm_1");
  const [note, setNote] = React.useState("");
  return (
    <div
      className="flex w-full max-w-md flex-col gap-2"
      role="radiogroup"
      aria-label="Pay invoice with"
    >
      {methods.map((m) => (
        <PaymentMethod
          key={m.id}
          method={m}
          now={now}
          selectable
          selected={pay === m.id}
          onSelect={setPay}
          onSetDefault={(id) =>
            setMethods((ms) => ms.map((x) => ({ ...x, isDefault: x.id === id })))
          }
          onRemove={(id) => setMethods((ms) => ms.filter((x) => x.id !== id))}
          onUpdate={(id) => setNote(`Open card update form for ${id}`)}
        />
      ))}
      {note ? <p className="text-xs text-crm-soft">{note}</p> : null}
    </div>
  );
}
