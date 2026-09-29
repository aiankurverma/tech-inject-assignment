import * as React from "react";
import { ProPivotTable, type PivotConfig, type PivotField } from "@/components/crm/pro-pivot-table";

interface Deal {
  id: string;
  region: string;
  country: string;
  segment: string;
  product: string;
  owner: string;
  quarter: string;
  month: string;
  stage: string;
  amount: number;
  seats: number;
  accountId: string;
}

const GEO: Record<string, string[]> = {
  "North America": ["United States", "Canada", "Mexico"],
  EMEA: ["United Kingdom", "Germany", "France", "Netherlands", "UAE"],
  APAC: ["India", "Japan", "Australia", "Singapore"],
  LATAM: ["Brazil", "Chile", "Colombia"],
};
const SEGMENTS = ["SMB", "Mid-Market", "Enterprise"];
const PRODUCTS = ["CRM Core", "Marketing Hub", "Service Desk", "Analytics", "CPQ"];
const OWNERS = [
  "Ava Chen",
  "Noah Patel",
  "Mia Rossi",
  "Liam Okafor",
  "Zoe Martin",
  "Arjun Rao",
  "Emma Weber",
  "Lucas Silva",
];
const STAGES = ["Won", "Won", "Won", "Lost", "Open"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deterministic PRNG so the example renders identically on every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateDeals(n: number): Deal[] {
  const rnd = mulberry32(42);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
  const regions = Object.keys(GEO);
  return Array.from({ length: n }, (_, i) => {
    const region = pick(regions);
    const segment = pick(SEGMENTS);
    const m = Math.floor(rnd() * 12);
    const base = segment === "Enterprise" ? 90000 : segment === "Mid-Market" ? 24000 : 5000;
    return {
      id: `D-${100000 + i}`,
      region,
      country: pick(GEO[region]!),
      segment,
      product: pick(PRODUCTS),
      owner: pick(OWNERS),
      quarter: `2026 Q${Math.floor(m / 3) + 1}`,
      month: MONTHS[m]!,
      stage: pick(STAGES),
      amount: Math.round(base * (0.4 + rnd() * 1.8)),
      seats: Math.max(1, Math.round((base / 900) * rnd())),
      accountId: `A-${Math.floor(rnd() * 3200)}`,
    };
  });
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const monthOrder = (a: string, b: string) => MONTHS.indexOf(a) - MONTHS.indexOf(b);

const fields: PivotField<Deal>[] = [
  { key: "region", label: "Region", kind: "dimension" },
  { key: "country", label: "Country", kind: "dimension" },
  { key: "segment", label: "Segment", kind: "dimension" },
  { key: "product", label: "Product", kind: "dimension" },
  { key: "owner", label: "Owner", kind: "dimension" },
  { key: "quarter", label: "Quarter", kind: "dimension" },
  { key: "month", label: "Month", kind: "dimension", sort: monthOrder },
  { key: "stage", label: "Stage", kind: "dimension" },
  { key: "amount", label: "Amount", kind: "measure", format: (v) => usd.format(v) },
  { key: "seats", label: "Seats", kind: "measure" },
  { key: "accountId", label: "Accounts", kind: "both" },
];

const defaultConfig: PivotConfig = {
  rows: ["region", "country"],
  cols: ["quarter"],
  values: [
    { field: "amount", agg: "sum" },
    { field: "accountId", agg: "distinct" },
  ],
  filters: { stage: ["Lost", "Open"] },
};

export default function Example() {
  const data = React.useMemo(() => generateDeals(25000), []);
  return (
    <div className="w-full max-w-7xl">
      <ProPivotTable
        data={data}
        fields={fields}
        defaultConfig={defaultConfig}
        defaultHeatmap
        height={560}
        csvFileName="bookings-by-region.csv"
      />
    </div>
  );
}
