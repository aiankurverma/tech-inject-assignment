import { Download, Plus } from "lucide-react";
import { Heading } from "@/components/crm/heading";
import { Button } from "@/components/crm/button";

const risky = [
  { name: "Northwind Traders", amount: "$184k", stage: "Negotiation", days: 21 },
  { name: "Globex Corporation", amount: "$96k", stage: "Proposal", days: 34 },
  { name: "Initech", amount: "$52k", stage: "Discovery", days: 18 },
];

export default function Example() {
  return (
    <div className="flex w-[640px] max-w-full flex-col gap-6 font-crm text-crm-fg">
      <Heading
        level={1}
        size="display"
        eyebrow="Revenue · Q3 FY26"
        description="Committed and best-case pipeline across all regions, refreshed every 15 minutes from Salesforce."
        actions={
          <>
            <Button size="sm">
              <Download /> Export
            </Button>
            <Button size="sm" variant="primary">
              <Plus /> New forecast
            </Button>
          </>
        }
      >
        Forecast overview
      </Heading>

      <section className="rounded-crm border border-crm-border bg-crm-card shadow-crm-raised">
        <div className="border-b border-crm-border px-4 py-3">
          <Heading
            level={2}
            size="md"
            anchor
            meta="12 open"
            description="No activity in 14+ days, or close date already slipped."
          >
            Deals at risk
          </Heading>
        </div>
        <ul className="divide-y divide-crm-border">
          {risky.map((d) => (
            <li key={d.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="text-xs text-crm-subtle">
                  {d.stage} · idle {d.days}d
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums">{d.amount}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="min-w-0 rounded-crm border border-crm-border bg-crm-card p-4">
          <Heading level={3} size="sm" anchor>
            Billing & invoicing
          </Heading>
          <p className="mt-1 text-xs text-crm-subtle">3 invoices overdue · $41.2k outstanding</p>
        </section>
        <section className="min-w-0 rounded-crm border border-crm-border bg-crm-card p-4">
          <Heading level={3} size="sm" truncate>
            Enterprise renewal — Northwind Traders International Holdings (EMEA)
          </Heading>
          <p className="mt-1 text-xs text-crm-subtle">Renews Nov 30 · $420k ARR</p>
        </section>
      </div>

      <section className="rounded-crm border border-dashed border-crm-border px-4 py-3">
        <Heading level={4} tone="muted" meta="7 workspaces">
          Archived workspaces
        </Heading>
      </section>
    </div>
  );
}
