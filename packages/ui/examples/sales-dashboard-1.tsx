import { SalesDashboard, type SalesDeal } from "@/components/crm/sales-dashboard";

const reps = ["Aisha Khan", "Ben Carter", "Chen Wei", "Diego Alvarez"];
const accounts = ["Acme", "Globex", "Initech", "Umbrella", "Stark", "Wayne", "Hooli", "Vandelay"];
const stageIds = ["discovery", "demo", "proposal", "negotiation"];

// Deterministic sample book of ~60 deals across this and last quarter.
const deals: SalesDeal[] = Array.from({ length: 60 }, (_, i) => {
  const status = i % 5 === 0 ? "lost" : i % 3 === 0 ? "open" : "won";
  const month = 3 + (i % 6); // Apr–Sep 2026
  const created = new Date(2026, month - 2, 1 + (i % 25));
  const close = new Date(2026, month, 2 + ((i * 7) % 26));
  return {
    id: `D-${1000 + i}`,
    name: `${accounts[i % accounts.length]} — ${["Growth", "Enterprise", "Starter"][i % 3]} plan`,
    owner: reps[i % reps.length]!,
    amount: 8000 + ((i * 7919) % 62000),
    stage: stageIds[i % stageIds.length]!,
    status,
    createdAt: created.toISOString(),
    closeDate: (status === "open" ? new Date(2026, 9, 5 + i) : close).toISOString(),
  };
});

export default function Example() {
  return (
    <SalesDashboard
      className="w-[1040px]"
      now={new Date("2026-09-28")}
      deals={deals}
      reps={reps.map((name, i) => ({ name, quota: 180000 + i * 20000 }))}
      stages={[
        { id: "discovery", label: "Discovery", probability: 0.1 },
        { id: "demo", label: "Demo", probability: 0.3 },
        { id: "proposal", label: "Proposal", probability: 0.6 },
        { id: "negotiation", label: "Negotiation", probability: 0.8 },
      ]}
    />
  );
}
