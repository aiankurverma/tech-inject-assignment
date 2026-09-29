import * as React from "react";
import { addDays, format } from "date-fns";
import {
  ProUsageMeteringDashboard,
  type UsageMeter,
  type UsageRecord,
} from "@/components/crm/pro-usage-metering-dashboard";

// Deterministic PRNG so the demo looks the same on every render.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const METERS: UsageMeter[] = [
  {
    id: "api",
    name: "API requests",
    unit: "req",
    limit: 50_000_000,
    included: 10_000_000,
    unitPrice: 0.4,
    per: 1_000_000,
    alertThresholds: [0.5, 0.8, 1],
  },
  {
    id: "storage",
    name: "Storage",
    unit: "GB-day",
    limit: 60_000,
    included: 15_000,
    unitPrice: 0.023,
    alertThresholds: [0.75, 0.9],
  },
  {
    id: "egress",
    name: "Egress",
    unit: "GB",
    limit: 12_000,
    included: 1_000,
    unitPrice: 0.09,
    alertThresholds: [0.8],
  },
  {
    id: "ai",
    name: "AI tokens",
    unit: "tok",
    limit: 400_000_000,
    included: 50_000_000,
    unitPrice: 2,
    per: 1_000_000,
    alertThresholds: [0.6, 0.9],
  },
  { id: "seats", name: "Active seats", unit: "seat-day", included: 1_500, unitPrice: 0.5 },
];

const REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "ap-south-1", "sa-east-1"];
const PROJECTS = [
  "checkout-api",
  "search",
  "mobile-bff",
  "analytics",
  "billing",
  "notifications",
  "ml-inference",
  "web",
];
const CUSTOMERS = Array.from({ length: 1200 }, (_, i) => `acct_${(10_000 + i * 37).toString(36)}`);

// Per-meter mean daily volume (spread across ~50 events/day each).
const DAILY: Record<string, number> = {
  api: 1_450_000,
  storage: 1_700,
  egress: 330,
  ai: 11_000_000,
  seats: 64,
};

function generate(asOf: Date): UsageRecord[] {
  const rand = mulberry32(42);
  const out: UsageRecord[] = [];
  const start = addDays(asOf, -120);
  for (let d = 0; d <= 120; d++) {
    const day = addDays(start, d);
    const date = format(day, "yyyy-MM-dd");
    const weekday = day.getDay();
    const season = weekday === 0 || weekday === 6 ? 0.62 : 1;
    const growth = 1 + d / 260; // ~45% growth over the window
    for (const m of METERS) {
      const events = 48;
      const base = (DAILY[m.id]! * season * growth) / events;
      for (let e = 0; e < events; e++) {
        const spike = m.id === "ai" && d > 108 ? 1.8 : 1; // recent AI launch
        out.push({
          meterId: m.id,
          date,
          quantity: Math.round(base * (0.35 + rand() * 1.3) * spike * 100) / 100,
          dimensions: {
            region: REGIONS[Math.floor(rand() ** 1.6 * REGIONS.length)]!,
            project: PROJECTS[Math.floor(rand() ** 1.3 * PROJECTS.length)]!,
            customer: CUSTOMERS[Math.floor(rand() ** 2.2 * CUSTOMERS.length)]!,
          },
        });
      }
    }
  }
  return out; // ~29k records
}

export default function Example() {
  const asOf = React.useMemo(() => new Date(2026, 8, 19), []);
  const records = React.useMemo(() => generate(asOf), [asOf]);
  const [thresholds, setThresholds] = React.useState<Record<string, number[]>>({});

  return (
    <div className="min-h-screen bg-crm-bg p-4 font-crm">
      <ProUsageMeteringDashboard
        meters={METERS}
        records={records}
        asOf={asOf}
        baseFee={499}
        thresholds={thresholds}
        onThresholdsChange={setThresholds}
        dimensions={["project", "region", "customer"]}
      />
    </div>
  );
}
