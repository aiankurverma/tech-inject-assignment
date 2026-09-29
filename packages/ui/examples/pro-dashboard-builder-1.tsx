import * as React from "react";
import {
  ProDashboardBuilder,
  type DashboardConfig,
  type DashboardField,
} from "@/components/crm/pro-dashboard-builder";

type Invoice = {
  id: string;
  account: string;
  plan: string;
  region: string;
  status: string;
  mrr: number;
  seats: number;
  issuedAt: string;
};

const PLANS = ["Starter", "Growth", "Scale", "Enterprise"];
const REGIONS = ["North America", "EMEA", "APAC", "LATAM"];
const STATUSES = ["paid", "open", "overdue", "refunded"];
const NAMES = [
  "Acme",
  "Globex",
  "Initech",
  "Umbrella",
  "Hooli",
  "Stark",
  "Wayne",
  "Tyrell",
  "Soylent",
  "Vandelay",
];
const SUFFIX = ["Labs", "Cloud", "Health", "Logistics", "Media", "Systems", "Bank", "Retail"];

// Deterministic PRNG so the example renders the same 10,000 invoices every time.
function rng(seed: number) {
  return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
const pick = (arr: readonly string[], x: number) =>
  arr[Math.min(arr.length - 1, Math.floor(x * arr.length))] ?? arr[0]!;
function makeInvoices(n: number): Invoice[] {
  const r = rng(42);
  const start = Date.UTC(2024, 0, 1);
  return Array.from({ length: n }, (_, i) => {
    const plan = pick(PLANS, r() ** 1.6);
    const base =
      ({ Starter: 49, Growth: 299, Scale: 1200, Enterprise: 5400 } as Record<string, number>)[
        plan
      ] ?? 49;
    const day = Math.floor((i / n) * 630 + r() * 30);
    return {
      id: `INV-${(100000 + i).toString()}`,
      account: `${pick(NAMES, r())} ${pick(SUFFIX, r())}`,
      plan,
      region: pick(REGIONS, r()),
      status: pick(STATUSES, r() < 0.78 ? 0 : r() < 0.6 ? 0.3 : r() < 0.7 ? 0.6 : 0.9),
      mrr: Math.round(base * (0.7 + r() * 0.9) * (1 + day / 900)),
      seats: Math.max(1, Math.round((base / 40) * r())),
      issuedAt: new Date(start + day * 86400000).toISOString().slice(0, 10),
    };
  });
}

const fields: DashboardField[] = [
  { name: "account", label: "Account", type: "string" },
  { name: "plan", label: "Plan", type: "string", options: PLANS },
  { name: "region", label: "Region", type: "string", options: REGIONS },
  { name: "status", label: "Status", type: "string", options: STATUSES },
  { name: "mrr", label: "MRR", type: "number" },
  { name: "seats", label: "Seats", type: "number" },
  { name: "issuedAt", label: "Issued", type: "date" },
  { name: "id", label: "Invoice", type: "string" },
];

const paid = { combinator: "and", rules: [{ field: "status", operator: "=", value: "paid" }] };

const initial: DashboardConfig = {
  version: 1,
  name: "Revenue analytics",
  rows: [
    {
      id: "r1",
      size: 24,
      widgets: [
        { id: "k1", size: 25 },
        { id: "k2", size: 25 },
        { id: "k3", size: 25 },
        { id: "k4", size: 25 },
      ],
    },
    {
      id: "r2",
      size: 38,
      widgets: [
        { id: "l1", size: 62 },
        { id: "b1", size: 38 },
      ],
    },
    { id: "r3", size: 38, widgets: [{ id: "t1", size: 100 }] },
  ],
  widgets: {
    k1: {
      id: "k1",
      type: "kpi",
      title: "Collected MRR",
      metric: "mrr",
      agg: "sum",
      format: "currency",
      query: paid,
    },
    k2: {
      id: "k2",
      type: "kpi",
      title: "Avg. invoice",
      metric: "mrr",
      agg: "avg",
      format: "currency",
      query: paid,
    },
    k3: {
      id: "k3",
      type: "kpi",
      title: "Overdue invoices",
      agg: "count",
      format: "number",
      query: { combinator: "and", rules: [{ field: "status", operator: "=", value: "overdue" }] },
    },
    k4: {
      id: "k4",
      type: "kpi",
      title: "Enterprise seats",
      metric: "seats",
      agg: "sum",
      format: "number",
      query: { combinator: "and", rules: [{ field: "plan", operator: "=", value: "Enterprise" }] },
    },
    l1: {
      id: "l1",
      type: "line",
      title: "MRR by month",
      metric: "mrr",
      agg: "sum",
      groupBy: "issuedAt",
      format: "currency",
      query: paid,
    },
    b1: {
      id: "b1",
      type: "bar",
      title: "MRR by region",
      metric: "mrr",
      agg: "sum",
      groupBy: "region",
      format: "currency",
      query: paid,
    },
    t1: {
      id: "t1",
      type: "table",
      title: "Overdue and open invoices",
      metric: "mrr",
      agg: "sum",
      format: "currency",
      columns: ["id", "account", "plan", "status", "mrr", "issuedAt"],
      query: {
        combinator: "or",
        rules: [{ field: "status", operator: "in", value: "overdue,open" }],
      },
    },
  },
};

export default function Example() {
  const data = React.useMemo(() => makeInvoices(10_000), []);
  const [saved, setSaved] = React.useState<string | null>(null);
  return (
    <div className="space-y-2 p-4">
      <ProDashboardBuilder
        data={data}
        fields={fields}
        defaultValue={initial}
        rowHeight={250}
        onSave={async (config) => {
          await new Promise((r) => setTimeout(r, 400));
          setSaved(`${config.rows.length} rows · ${Object.keys(config.widgets).length} widgets`);
        }}
      />
      {saved && <p className="text-xs text-crm-muted-fg">Last saved layout: {saved}</p>}
    </div>
  );
}
