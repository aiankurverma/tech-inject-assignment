import * as React from "react";
import { ReportBuilder, type ReportRow } from "@/components/crm/report-builder";

const owners = ["Maya Chen", "Omar Haddad", "Priya Nair", "Sam Rivera", "Lena Vogel"];
const sources = ["Inbound", "Outbound", "Partner", "Event"];
const regions = ["North America", "EMEA", "APAC"];

// Deterministic sample: 180 closed deals across 2025-2026.
const rows: ReportRow[] = Array.from({ length: 180 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280;
  return {
    owner: owners[i % owners.length],
    source: sources[(i * 7) % sources.length],
    region: regions[(i * 5) % regions.length],
    closedAt: new Date(2025, (i * 3) % 21, 1 + (i % 27)).toISOString(),
    amount: Math.round(4000 + (seed / 233280) * 90000),
    cycleDays: 14 + ((i * 13) % 90),
  };
});

export default function Example() {
  return (
    <ReportBuilder
      className="max-w-3xl"
      title="Closed won revenue"
      rows={rows}
      dimensions={[
        { key: "owner", label: "Owner" },
        { key: "source", label: "Lead source" },
        { key: "region", label: "Region" },
        { key: "closedAt", label: "Close date", date: true },
      ]}
      measures={[
        { key: "amount", label: "Amount", currency: true },
        { key: "cycleDays", label: "Sales cycle (days)" },
      ]}
    />
  );
}
