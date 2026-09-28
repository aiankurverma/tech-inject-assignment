import * as React from "react";
import { MergeDuplicates } from "@/components/crm/merge-duplicates";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function Example() {
  const [merged, setMerged] = React.useState<string | null>(null);
  return (
    <div className="flex w-full max-w-4xl flex-col gap-3">
      <MergeDuplicates
        recordLabel={(r) => `${String(r.values.name)} · ${r.id}`}
        fields={[
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "title", label: "Job title" },
          { key: "company", label: "Company" },
          { key: "owner", label: "Owner" },
          { key: "ltv", label: "Lifetime value", format: (v) => usd.format(Number(v)) },
        ]}
        records={[
          {
            id: "C-1042",
            createdAt: "2024-03-11T10:00:00Z",
            updatedAt: "2026-06-02T10:00:00Z",
            values: {
              name: "Jordan Blake",
              email: "jordan.blake@acme.com",
              phone: "",
              title: "Head of Ops",
              company: "Acme Corp",
              owner: "Maya Chen",
              ltv: 42000,
            },
            related: { deals: 2, notes: 14, emails: 63 },
          },
          {
            id: "C-2291",
            createdAt: "2025-11-20T10:00:00Z",
            updatedAt: "2026-09-18T10:00:00Z",
            values: {
              name: "Jordan Blake",
              email: "JBlake@acme.com",
              phone: "+1 415 555 0142",
              title: "VP Operations",
              company: "ACME Corporation",
              owner: "Omar Haddad",
              ltv: 42000,
            },
            related: { deals: 1, notes: 3 },
          },
        ]}
        onMerge={(r) => setMerged(`Merged ${r.mergedIds.join(", ")} into ${r.masterId}`)}
      />
      {merged ? <p className="font-crm text-xs text-crm-success">{merged}</p> : null}
    </div>
  );
}
