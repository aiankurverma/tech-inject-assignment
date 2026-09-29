import * as React from "react";
import {
  ProBankReconciliation,
  type BankLine,
  type BookEntry,
  type ReconMatch,
  type ReconRule,
} from "@/components/crm/pro-bank-reconciliation";

const VENDORS = [
  ["AWS EMEA", "Cloud hosting"],
  ["Stripe payout", "Sales receipts"],
  ["Gusto payroll", "Payroll"],
  ["WeWork", "Rent"],
  ["Google Workspace", "Software"],
  ["Delta Air Lines", "Travel"],
  ["Acme Corp", "Accounts receivable"],
  ["Figma", "Software"],
  ["Comcast Business", "Utilities"],
  ["Uber Business", "Travel"],
] as const;

// Deterministic PRNG so the example renders the same data every time.
function rng(seed: number) {
  return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

function generate(n: number): { bank: BankLine[]; book: BookEntry[] } {
  const r = rng(42);
  const bank: BankLine[] = [];
  const book: BookEntry[] = [];
  const start = Date.UTC(2026, 0, 1);
  for (let i = 0; i < n; i++) {
    const [vendor, account] = VENDORS[Math.floor(r() * VENDORS.length)]!;
    const inflow = account === "Sales receipts" || account === "Accounts receivable";
    const amount = Math.round((inflow ? 1 : -1) * (500 + r() * 480_000));
    const day = new Date(start + Math.floor(r() * 270) * 86_400_000);
    const ref = `INV-${10_000 + i}`;
    const date = day.toISOString().slice(0, 10);
    bank.push({
      id: `b${i}`,
      date,
      description: `${vendor.toUpperCase()} ${ref}`,
      reference: ref,
      amount,
    });
    const roll = r();
    if (roll < 0.08) continue; // bank-only line (fee, unrecorded)
    const drift = Math.floor(r() * 4);
    const bookDate = new Date(day.getTime() - drift * 86_400_000).toISOString().slice(0, 10);
    if (roll < 0.14 && Math.abs(amount) > 2000) {
      // Split into two ledger entries: needs a many-to-one match.
      const part = Math.round(amount * 0.6);
      book.push({
        id: `k${i}a`,
        date: bookDate,
        description: `${vendor} (1/2)`,
        account,
        amount: part,
      });
      book.push({
        id: `k${i}b`,
        date: bookDate,
        description: `${vendor} (2/2)`,
        account,
        amount: amount - part,
      });
      continue;
    }
    book.push({
      id: `k${i}`,
      date: bookDate,
      description: vendor,
      reference: roll < 0.7 ? ref : undefined,
      account,
      amount: roll > 0.97 ? amount + 125 : amount, // a few booked with a small error
    });
  }
  return { bank, book };
}

export default function Example() {
  const data = React.useMemo(() => generate(10_000), []);
  const [matches, setMatches] = React.useState<ReconMatch[]>([]);
  const [rules, setRules] = React.useState<ReconRule[]>([
    {
      id: "r-stripe",
      name: '"stripe" -> Sales receipts',
      contains: "stripe",
      account: "Sales receipts",
      maxDays: 3,
    },
  ]);
  const adjustments = matches.reduce((a, m) => a + m.adjustment, 0);

  return (
    <div className="space-y-3 bg-crm-bg p-4 font-crm">
      <div className="flex items-baseline justify-between text-crm-fg">
        <h2 className="text-base font-medium">Operating account 4417 · Jan-Sep 2026</h2>
        <p className="text-xs text-crm-muted-fg">
          {matches.length.toLocaleString()} matches · adjustments{" "}
          {(adjustments / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}
        </p>
      </div>
      <ProBankReconciliation
        bankLines={data.bank}
        bookEntries={data.book}
        matches={matches}
        onMatchesChange={setMatches}
        rules={rules}
        onRulesChange={setRules}
        allowAdjustments
        height={520}
      />
    </div>
  );
}
