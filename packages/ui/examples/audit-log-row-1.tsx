import * as React from "react";
import { AuditLogRow, type AuditEntry } from "@/components/crm/audit-log-row";

const min = (n: number) => new Date(Date.now() - n * 60_000);

const initial: AuditEntry[] = [
  {
    id: "a1",
    at: min(4),
    actor: { name: "Priya Nair" },
    action: "updated",
    source: "Web app",
    ip: "10.2.14.7",
    changes: [
      { field: "Amount", type: "currency", currency: "USD", from: 72000, to: 86400 },
      { field: "Stage", from: "Proposal", to: "Negotiation" },
      { field: "Close date", type: "date", from: "2026-11-30", to: "2026-10-31" },
      {
        field: "Competitors",
        type: "list",
        from: ["Salesforce", "Pipedrive"],
        to: ["Salesforce", "HubSpot"],
      },
      {
        field: "Next step",
        type: "longtext",
        from: null,
        to: "Legal review of MSA section 9 (liability cap) with Dana on Thursday.",
      },
    ],
  },
  {
    id: "a2",
    at: min(95),
    actor: { name: "Stage sync", kind: "automation" },
    action: "updated",
    source: "Workflow: Probability by stage",
    changes: [{ field: "Probability", type: "number", from: 40, to: 60 }],
  },
  {
    id: "a3",
    at: min(60 * 26),
    actor: { name: "Stripe", kind: "integration" },
    action: "updated",
    source: "Stripe webhook",
    changes: [
      { field: "Bank account", from: "DE89 3704 0044", to: "DE12 5001 0517", sensitive: true },
    ],
  },
  {
    id: "a4",
    at: min(60 * 24 * 9),
    actor: { name: "Alex Santos" },
    action: "created",
    source: "Import (CSV)",
    changes: [],
  },
];

export default function Example() {
  const [entries, setEntries] = React.useState(initial);
  return (
    <div className="max-w-3xl rounded-xl border border-crm-border bg-crm-card">
      {entries.map((e) => (
        <AuditLogRow
          key={e.id}
          entry={e}
          onRevert={(entry, c) =>
            setEntries((list) => [
              {
                id: `r-${entry.id}-${c.field}`,
                at: new Date(),
                actor: { name: "Alex Santos" },
                action: "updated",
                source: `Reverted change from ${entry.actor.name}`,
                changes: [{ ...c, from: c.to, to: c.from }],
              },
              ...list,
            ])
          }
        />
      ))}
    </div>
  );
}
