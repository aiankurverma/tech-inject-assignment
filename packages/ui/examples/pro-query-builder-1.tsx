import * as React from "react";
import {
  ProQueryBuilder,
  type QueryField,
  type RuleGroupType,
  type SavedSegment,
} from "@/components/crm/pro-query-builder";

const fields: QueryField[] = [
  {
    name: "company_name",
    label: "Company name",
    type: "text",
    group: "Company",
    placeholder: "Acme",
  },
  {
    name: "industry",
    label: "Industry",
    type: "select",
    group: "Company",
    options: ["SaaS", "Fintech", "Healthcare", "Retail", "Manufacturing", "Logistics"].map((v) => ({
      value: v.toLowerCase(),
      label: v,
    })),
  },
  { name: "employees", label: "Employees", type: "number", group: "Company", min: 1, max: 500000 },
  { name: "arr", label: "ARR (USD)", type: "number", group: "Revenue", min: 0 },
  {
    name: "plan",
    label: "Plan",
    type: "select",
    group: "Revenue",
    options: [
      { value: "free", label: "Free" },
      { value: "starter", label: "Starter" },
      { value: "growth", label: "Growth" },
      { value: "enterprise", label: "Enterprise" },
    ],
  },
  {
    name: "tags",
    label: "Tags",
    type: "multiselect",
    group: "Contact",
    options: ["champion", "churn-risk", "expansion", "beta", "partner"].map((v) => ({
      value: v,
      label: v,
    })),
  },
  { name: "last_seen_at", label: "Last seen", type: "date", group: "Activity" },
  { name: "signup_date", label: "Signup date", type: "date", group: "Activity" },
  { name: "email_opt_in", label: "Email opt-in", type: "boolean", group: "Contact" },
];

const initial: RuleGroupType = {
  id: "root",
  combinator: "and",
  rules: [
    { id: "r1", field: "plan", operator: "in", value: ["growth", "enterprise"] },
    { id: "r2", field: "arr", operator: "between", value: ["50000", "250000"] },
    {
      id: "g1",
      combinator: "or",
      rules: [
        { id: "r3", field: "last_seen_at", operator: "notInLast", value: "30 days" },
        { id: "r4", field: "tags", operator: "in", value: ["churn-risk"] },
      ],
    },
  ],
};

const savedSegments: SavedSegment[] = [
  {
    id: "seg-1",
    name: "Enterprise expansion targets",
    updatedAt: "2026-09-20T10:00:00Z",
    query: {
      combinator: "and",
      rules: [
        { field: "plan", operator: "=", value: "enterprise" },
        { field: "tags", operator: "in", value: ["expansion", "champion"] },
      ],
    },
  },
  {
    id: "seg-2",
    name: "New fintech signups",
    updatedAt: "2026-09-25T16:30:00Z",
    query: {
      combinator: "and",
      rules: [
        { field: "industry", operator: "=", value: "fintech" },
        { field: "signup_date", operator: "inLast", value: "14 days" },
      ],
    },
  },
];

export default function Example() {
  const [query, setQuery] = React.useState<RuleGroupType>(initial);
  const [applied, setApplied] = React.useState<string | null>(null);
  // Simulated debounced "matching accounts" count, as a server count endpoint would return.
  const [count, setCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const size = JSON.stringify(query).length;
      setCount(Math.max(0, 48210 - ((size * 97) % 41000)));
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="flex w-full max-w-6xl flex-col gap-2">
      <ProQueryBuilder
        fields={fields}
        query={query}
        onQueryChange={setQuery}
        defaultSegments={savedSegments}
        matchCount={count}
        matchCountLoading={loading}
        onApply={() => setApplied(new Date().toLocaleTimeString())}
      />
      {applied && <p className="text-xs text-crm-subtle">Segment applied at {applied}</p>}
    </div>
  );
}
