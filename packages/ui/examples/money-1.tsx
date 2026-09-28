import * as React from "react";
import { Money, sumMoney } from "@/components/crm/money";

const lines = [
  { item: "Growth plan · 25 seats", qty: 25, unit: 49 },
  { item: "Onboarding package", qty: 1, unit: 1200 },
  { item: "SMS credits (10k)", qty: 3, unit: 149.99 },
];

export default function Example() {
  const [currency, setCurrency] = React.useState<"USD" | "EUR" | "JPY" | "INR">("USD");
  const subtotal = sumMoney(lines.map((l) => l.qty * l.unit));
  const discount = -Math.round(subtotal * 0.1 * 100) / 100;
  const total = sumMoney([subtotal, discount]);
  const fx = { USD: 1, EUR: 0.92, JPY: 148.3, INR: 83.4 }[currency];

  return (
    <div className="w-full max-w-md space-y-4 rounded-crm border border-crm-border bg-crm-surface p-4 font-crm">
      <div className="flex items-center justify-between">
        <span className="crm-eyebrow">Quote Q-2041</span>
        <select
          aria-label="Display currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as typeof currency)}
          className="rounded-md border border-crm-input bg-crm-raised px-2 py-1 text-xs text-crm-fg"
        >
          {["USD", "EUR", "JPY", "INR"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <ul className="divide-y divide-crm-border text-sm">
        {lines.map((l) => (
          <li key={l.item} className="flex items-center justify-between py-2">
            <span className="text-crm-soft">{l.item}</span>
            <Money amount={l.qty * l.unit * fx} currency={currency} />
          </li>
        ))}
        <li className="flex items-center justify-between py-2">
          <span className="text-crm-soft">Annual prepay discount</span>
          <Money amount={discount * fx} currency={currency} toneBySign sign="accounting" />
        </li>
      </ul>
      <div className="flex items-end justify-between">
        <span className="text-xs text-crm-subtle">Total due</span>
        <Money
          amount={total * fx}
          currency={currency}
          size="xl"
          compareAt={subtotal * fx}
          converted={
            currency === "USD"
              ? undefined
              : { amount: total, currency: "USD", rateLabel: "reporting" }
          }
        />
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-crm-border pt-3 text-center">
        <div>
          <p className="crm-caption">ARR</p>
          <Money amount={1_284_500} compact size="lg" />
        </div>
        <div>
          <p className="crm-caption">Net change</p>
          <Money amount={-42_310} compact sign="always" toneBySign size="lg" />
        </div>
        <div>
          <p className="crm-caption">Invoice (cents)</p>
          <Money amount={1999900} minorUnits size="lg" />
        </div>
      </div>
      <p className="text-xs text-crm-subtle">
        Unpaid balance: <Money amount={null} size="sm" />
      </p>
    </div>
  );
}
