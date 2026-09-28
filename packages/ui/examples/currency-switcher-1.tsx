import { useState } from "react";
import {
  CurrencySwitcher,
  convertAmount,
  formatMoney,
  type CurrencyOption,
} from "@/components/crm/currency-switcher";

const currencies: CurrencyOption[] = [
  { code: "USD", name: "US Dollar", rate: 1, flag: "🇺🇸" },
  { code: "EUR", name: "Euro", rate: 0.921, flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", rate: 0.787, flag: "🇬🇧" },
  { code: "INR", name: "Indian Rupee", rate: 83.42, flag: "🇮🇳" },
  { code: "JPY", name: "Japanese Yen", rate: 149.8, flag: "🇯🇵" },
  { code: "AUD", name: "Australian Dollar", rate: 1.523, flag: "🇦🇺" },
  { code: "CAD", name: "Canadian Dollar", rate: 1.364, flag: "🇨🇦" },
  { code: "SGD", name: "Singapore Dollar", rate: 1.341, flag: "🇸🇬" },
  { code: "CHF", name: "Swiss Franc", rate: 0.884, flag: "🇨🇭" },
  { code: "AED", name: "UAE Dirham", rate: 3.673, flag: "🇦🇪" },
];

const deals = [
  { name: "Acme Corp — Enterprise renewal", amount: 184_500 },
  { name: "Globex — Platform expansion", amount: 62_300 },
  { name: "Initech — Seats add-on", amount: 9_840 },
];

export default function Example() {
  const [code, setCode] = useState("EUR");
  const rate = currencies.find((c) => c.code === code)?.rate ?? 1;
  const total = deals.reduce((s, d) => s + d.amount, 0);
  return (
    <div className="w-full max-w-md rounded-crm border border-crm-border bg-crm-card p-4 font-crm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="crm-eyebrow text-crm-muted-fg">Open pipeline</p>
          <p className="text-xl font-medium text-crm-fg tabular-nums">
            {formatMoney(convertAmount(total, rate), code)}
          </p>
        </div>
        <CurrencySwitcher
          currencies={currencies}
          baseCurrency="USD"
          value={code}
          onValueChange={setCode}
          favorites={["USD", "EUR", "INR"]}
          previewAmount={total}
          ratesAsOf={new Date("2026-09-26T09:30:00Z")}
          now={new Date("2026-09-28T10:00:00Z")}
        />
      </div>
      <ul className="divide-y divide-crm-border">
        {deals.map((d) => (
          <li key={d.name} className="flex justify-between py-2 text-sm">
            <span className="truncate text-crm-soft">{d.name}</span>
            <span className="text-crm-fg tabular-nums">
              {formatMoney(convertAmount(d.amount, rate), code)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
