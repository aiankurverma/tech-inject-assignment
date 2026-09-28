import { WinLossReport, type ClosedDeal } from "@/components/crm/win-loss-report";

const winReasons = [
  "Product fit",
  "Faster time-to-value",
  "Champion strength",
  "Integrations",
  "Pricing",
];
const lossReasons = [
  "Price",
  "Missing feature",
  "Chose competitor",
  "No decision",
  "Timing / budget freeze",
];
const competitors = ["Northwind CRM", "Acme Sales Cloud", "Pipely", undefined];
const segments = ["SMB", "Mid-market", "Enterprise"];
const accounts = [
  "Globex",
  "Initech",
  "Umbrella Health",
  "Stark Logistics",
  "Wayne Retail",
  "Hooli",
  "Vandelay Imports",
  "Soylent Foods",
  "Tyrell Bio",
  "Cyberdyne",
  "Wonka Labs",
  "Oscorp",
];

const deals: ClosedDeal[] = Array.from({ length: 72 }, (_, i) => {
  const won = (i * 7) % 10 < 4 + (i % 3 === 0 ? 1 : 0);
  return {
    id: `d${i}`,
    name: `${accounts[i % accounts.length]} — ${["Platform", "Expansion", "Pilot"][i % 3]}`,
    outcome: won ? "won" : "lost",
    amount: 8_000 + ((i * 3_701) % 90_000),
    closedAt: new Date(Date.UTC(2025, 9 + (i % 12), 3 + (i % 25))).toISOString(),
    reason:
      (won ? winReasons[i % winReasons.length] : lossReasons[(i * 3) % lossReasons.length]) ??
      "Other",
    competitor: competitors[i % competitors.length],
    segment: segments[i % segments.length],
    cycleDays: won ? 28 + (i % 40) : 45 + (i % 60),
  };
});

export default function Example() {
  return <WinLossReport className="w-full max-w-[960px]" deals={deals} />;
}
