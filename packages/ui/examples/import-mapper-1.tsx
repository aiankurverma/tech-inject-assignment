import * as React from "react";
import { ImportMapper, type ImportMapping } from "@/components/crm/import-mapper";

const headers = [
  "First Name",
  "Last Name",
  "E-mail Address",
  "Company",
  "Job Title",
  "Phone #",
  "Annual Revenue",
  "Created",
  "Notes",
];
const rows = [
  [
    "Priya",
    "Raman",
    "priya@northwind.io",
    "Northwind Logistics",
    "VP RevOps",
    "+31 20 555 0142",
    "$48,000,000",
    "2026-02-11",
    "Met at SaaStr",
  ],
  [
    "Marcus",
    "Lee",
    "marcus.lee@brightlinehealth",
    "Brightline Health",
    "Head of Ops",
    "(512) 555-0199",
    "$12,500,000",
    "2026-03-04",
    "",
  ],
  [
    "Lena",
    "Fischer",
    "lena@kestrel.ai",
    "Kestrel Robotics",
    "CTO",
    "+49 30 555 0110",
    "n/a",
    "last spring",
    "Warm intro via Aiko",
  ],
];

export default function Example() {
  const [result, setResult] = React.useState<ImportMapping | null>(null);
  return (
    <div className="flex max-w-4xl flex-col gap-3">
      <ImportMapper
        fileName="tradeshow-leads-sept.csv"
        totalRows={1284}
        headers={headers}
        rows={rows}
        fields={[
          { key: "first_name", label: "First name", required: true },
          { key: "last_name", label: "Last name", required: true },
          {
            key: "email",
            label: "Email",
            type: "email",
            required: true,
            aliases: ["e-mail address", "work email"],
          },
          { key: "company", label: "Company name", aliases: ["account", "organization"] },
          { key: "title", label: "Job title" },
          { key: "phone", label: "Phone", type: "phone" },
          { key: "annual_revenue", label: "Annual revenue", type: "currency" },
          { key: "created_at", label: "Created date", type: "date", aliases: ["created"] },
          { key: "owner", label: "Lead owner" },
        ]}
        onBack={() => setResult(null)}
        onConfirm={setResult}
      />
      {result ? (
        <p className="font-crm text-xs text-crm-soft">
          Importing {Object.values(result).filter(Boolean).length} columns into Leads…
        </p>
      ) : null}
    </div>
  );
}
