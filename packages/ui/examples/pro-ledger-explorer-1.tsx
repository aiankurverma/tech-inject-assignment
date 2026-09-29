import * as React from "react";
import {
  ProLedgerExplorer,
  type JournalEntry,
  type LedgerAccount,
} from "@/components/crm/pro-ledger-explorer";

const accounts: LedgerAccount[] = [
  { id: "1000", code: "1000", name: "Assets", type: "asset" },
  { id: "1100", code: "1100", name: "Cash at bank", type: "asset", parentId: "1000" },
  { id: "1110", code: "1110", name: "Operating account", type: "asset", parentId: "1100" },
  { id: "1120", code: "1120", name: "Payroll account", type: "asset", parentId: "1100" },
  { id: "1200", code: "1200", name: "Accounts receivable", type: "asset", parentId: "1000" },
  { id: "2000", code: "2000", name: "Liabilities", type: "liability" },
  { id: "2100", code: "2100", name: "Accounts payable", type: "liability", parentId: "2000" },
  { id: "2200", code: "2200", name: "Sales tax payable", type: "liability", parentId: "2000" },
  { id: "3000", code: "3000", name: "Equity", type: "equity" },
  { id: "3100", code: "3100", name: "Owner capital", type: "equity", parentId: "3000" },
  { id: "4000", code: "4000", name: "Revenue", type: "revenue" },
  { id: "4100", code: "4100", name: "Subscription revenue", type: "revenue", parentId: "4000" },
  { id: "4200", code: "4200", name: "Services revenue", type: "revenue", parentId: "4000" },
  { id: "5000", code: "5000", name: "Expenses", type: "expense" },
  { id: "5100", code: "5100", name: "Salaries", type: "expense", parentId: "5000" },
  { id: "5200", code: "5200", name: "Cloud hosting", type: "expense", parentId: "5000" },
  { id: "5300", code: "5300", name: "Software", type: "expense", parentId: "5000" },
];

const customers = ["Globex", "Initech", "Umbrella", "Hooli", "Stark", "Wayne", "Acme", "Soylent"];
const vendors = ["AWS", "Google Cloud", "Figma", "Linear", "Notion", "Datadog"];

/** 50k balanced entries (~110k posting lines) with a deterministic PRNG. */
function generate(count: number): JournalEntry[] {
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const start = new Date(2023, 0, 1).getTime();
  const span = 1000 * 60 * 60 * 24 * 730;
  const out: JournalEntry[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(start + Math.floor(rnd() * span));
    const kind = rnd();
    const amt = Math.round(200 + rnd() * 9800) * 100;
    const ref = `JE-${String(i + 1).padStart(6, "0")}`;
    if (kind < 0.4) {
      const c = customers[Math.floor(rnd() * customers.length)]!;
      const tax = Math.round(amt * 0.08);
      out.push({
        id: ref,
        date,
        reference: ref,
        description: `Invoice ${c}`,
        source: "Billing",
        postings: [
          { accountId: "1200", debit: amt + tax, credit: 0, memo: `${c} INV-${10000 + i}` },
          { accountId: rnd() < 0.7 ? "4100" : "4200", debit: 0, credit: amt },
          { accountId: "2200", debit: 0, credit: tax },
        ],
      });
    } else if (kind < 0.7) {
      const c = customers[Math.floor(rnd() * customers.length)]!;
      out.push({
        id: ref,
        date,
        reference: ref,
        description: `Payment received ${c}`,
        source: "Bank feed",
        postings: [
          { accountId: "1110", debit: amt, credit: 0 },
          { accountId: "1200", debit: 0, credit: amt, memo: c },
        ],
      });
    } else if (kind < 0.9) {
      const v = vendors[Math.floor(rnd() * vendors.length)]!;
      out.push({
        id: ref,
        date,
        reference: ref,
        description: `${v} bill`,
        source: "AP",
        postings: [
          {
            accountId: v.includes("Cloud") || v === "AWS" ? "5200" : "5300",
            debit: amt / 4,
            credit: 0,
          },
          { accountId: "2100", debit: 0, credit: amt / 4, memo: v },
        ],
      });
    } else {
      out.push({
        id: ref,
        date,
        reference: ref,
        description: "Payroll run",
        source: "Payroll",
        postings: [
          { accountId: "5100", debit: amt * 3, credit: 0 },
          { accountId: "1120", debit: 0, credit: amt * 3 },
        ],
      });
    }
  }
  return out;
}

export default function ProLedgerExplorerExample() {
  const entries = React.useMemo(() => generate(50_000), []);
  return (
    <div className="bg-crm-bg p-4">
      <ProLedgerExplorer
        accounts={accounts}
        entries={entries}
        defaultGroupBy="month"
        height={480}
      />
    </div>
  );
}
