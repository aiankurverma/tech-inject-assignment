import * as React from "react";
import {
  ProForecastDashboard,
  type ForecastCategory,
  type ForecastDeal,
  type QuotaFn,
} from "@/components/crm/pro-forecast-dashboard";

// Deterministic PRNG so the demo is stable between renders.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AS_OF = new Date(2026, 8, 29);
const FY_START = 1; // fiscal year starts in February
const OWNERS = [
  "Priya Raman",
  "Marcus Hale",
  "Lena Vogel",
  "Tomás Ortega",
  "Aiko Tanaka",
  "Sam Okafor",
  "Nina Petrova",
  "Diego Alvarez",
  "Hannah Cole",
  "Omar Haddad",
  "Grace Kim",
  "Luca Bianchi",
];
const PREFIX = [
  "Helix",
  "Northwind",
  "Brightline",
  "Oakridge",
  "Summit",
  "Bluefin",
  "Crescent",
  "Ironwood",
  "Lumen",
  "Pioneer",
  "Redwood",
  "Silverline",
  "Tidal",
  "Vantage",
  "Westport",
  "Zenith",
  "Atlas",
  "Beacon",
  "Cobalt",
  "Evergreen",
];
const SUFFIX = [
  "Freight",
  "Health",
  "Capital",
  "Labs",
  "Systems",
  "Foods",
  "Energy",
  "Retail",
  "Robotics",
  "Media",
  "Logistics",
  "Bank",
];
const PRODUCTS = ["Platform", "Expansion", "Renewal", "Pilot", "Enterprise", "Add-on seats"];
const STAGE_BY_CAT: Record<ForecastCategory, string[]> = {
  closed: ["Closed won"],
  commit: ["Negotiation", "Contract sent"],
  best: ["Proposal", "Solution review"],
  pipeline: ["Discovery", "Qualification"],
  lost: ["Closed lost"],
};

function generate(n: number): ForecastDeal[] {
  const rnd = mulberry32(20260929);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
  const fyStart = new Date(2026, FY_START, 1);
  const out: ForecastDeal[] = [];
  for (let i = 0; i < n; i++) {
    const close = new Date(fyStart.getTime() + rnd() * 365 * 864e5);
    const past = close < AS_OF;
    const r = rnd();
    const category: ForecastCategory = past
      ? r < 0.62
        ? "closed"
        : r < 0.9
          ? "lost"
          : "commit"
      : r < 0.22
        ? "commit"
        : r < 0.47
          ? "best"
          : r < 0.95
            ? "pipeline"
            : "lost";
    const amount = Math.round((4000 + Math.pow(rnd(), 2.4) * 180000) / 500) * 500;
    const account = `${pick(PREFIX)} ${pick(SUFFIX)}`;

    // Last week's call: most deals unchanged, some moved.
    let prior: ForecastDeal["prior"] = { amount, closeDate: close, category };
    const m = rnd();
    if (m < 0.04) prior = null;
    else if (m < 0.09)
      prior = { amount, closeDate: new Date(close.getTime() - 40 * 864e5), category: "commit" };
    else if (m < 0.13)
      prior = { amount, closeDate: new Date(close.getTime() + 45 * 864e5), category };
    else if (m < 0.18)
      prior = { amount: Math.round(amount * (0.7 + rnd() * 0.6)), closeDate: close, category };
    else if (m < 0.22 && category === "commit")
      prior = { amount, closeDate: close, category: "best" };
    else if (category === "lost" && m < 0.4)
      prior = { amount, closeDate: close, category: "commit" };

    out.push({
      id: `D-${(100000 + i).toString()}`,
      name: `${account} — ${pick(PRODUCTS)}`,
      account,
      owner: pick(OWNERS),
      stage: pick(STAGE_BY_CAT[category]),
      amount,
      closeDate: close,
      category,
      prior,
    });
  }
  return out;
}

// Annual quota $320M, back-weighted by quarter.
const QUARTER_WEIGHT = [0.21, 0.24, 0.25, 0.3];
const ANNUAL = 320_000_000;
const quota: QuotaFn = (start, g) => {
  const q = Math.floor(((start.getMonth() - FY_START + 12) % 12) / 3);
  if (g === "year") return ANNUAL;
  if (g === "quarter") return ANNUAL * QUARTER_WEIGHT[q]!;
  return (ANNUAL * QUARTER_WEIGHT[q]!) / 3;
};

export default function Example() {
  const deals = React.useMemo(() => generate(10_000), []);
  const [selected, setSelected] = React.useState<ForecastDeal | null>(null);
  return (
    <div className="flex w-full max-w-6xl flex-col gap-3">
      <ProForecastDashboard
        title="Global sales forecast"
        deals={deals}
        quota={quota}
        asOf={AS_OF}
        fiscalYearStartMonth={FY_START}
        snapshotLabel="Mon 22 Sep call"
        onDealClick={setSelected}
      />
      {selected && (
        <p className="text-xs text-crm-muted-fg" aria-live="polite">
          Opened {selected.name} ({selected.owner})
        </p>
      )}
    </div>
  );
}
