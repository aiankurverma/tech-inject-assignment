import * as React from "react";
import { CurrencyInput } from "@/components/crm/currency-input";

export default function Example() {
  const [amount, setAmount] = React.useState<number | null>(48000);
  const [eur, setEur] = React.useState<number | null>(null);
  return (
    <div className="flex w-[260px] flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-crm-soft">Deal value</span>
        <CurrencyInput value={amount} onChange={setAmount} min={0} aria-label="Deal value" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-crm-soft">Budget (EUR, German format)</span>
        <CurrencyInput
          value={eur}
          onChange={setEur}
          currency="EUR"
          locale="de-DE"
          showCode
          aria-label="Budget"
        />
      </label>
    </div>
  );
}
