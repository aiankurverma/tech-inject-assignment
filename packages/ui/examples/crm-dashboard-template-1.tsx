import { CrmDashboardTemplate } from "@/components/crm/crm-dashboard-template";
import type { PipelineDeal, PipelineStage } from "@/components/crm/pro-pipeline-board";

const NOW = new Date(2026, 8, 29, 10, 0);
const DAY = 86_400_000;

const stages: PipelineStage[] = [
  { id: "lead", title: "Qualified lead", probability: 0.1, rotDays: 14 },
  { id: "discovery", title: "Discovery", probability: 0.25, rotDays: 21 },
  { id: "proposal", title: "Proposal sent", probability: 0.55, rotDays: 18 },
  { id: "negotiation", title: "Negotiation", probability: 0.8, rotDays: 25 },
];
const owners = [
  { id: "u1", name: "Priya Raman" },
  { id: "u2", name: "Marcus Webb" },
  { id: "u3", name: "Sofia Lindqvist" },
];
const companies = ["Northwind", "Helios Energy", "Brightline", "Quanta Robotics", "Juniper Bank"];

// Small deterministic generator: 40 deals spread over the stages.
const deals: PipelineDeal[] = Array.from({ length: 40 }, (_, i) => ({
  id: `D-${1000 + i}`,
  title: `${companies[i % companies.length]} expansion`,
  company: companies[i % companies.length] ?? "Northwind",
  amount: 5_000 + ((i * 7919) % 90) * 1_000,
  stageId: stages[(i * 3) % stages.length]?.id ?? "lead",
  ownerId: owners[i % owners.length]?.id ?? "u1",
  rank: i * 1024,
  stageEnteredAt: new Date(+NOW - ((i * 5) % 30) * DAY).toISOString(),
  closeDate: new Date(+NOW + (10 + ((i * 11) % 80)) * DAY).toISOString().slice(0, 10),
}));

// Six-month sparkline: linear growth with a small wobble.
const trend = (start: number, step: number) =>
  Array.from({ length: 6 }, (_, i) => start + i * step + (i % 2 ? step / 3 : 0));

export default function Example() {
  return (
    <CrmDashboardTemplate
      trialDays={14}
      kpis={[
        { label: "Open pipeline", value: "$1.42M", delta: 8.4, trend: trend(0.9, 0.1) },
        { label: "Won this month", value: "$286k", delta: 12.1, trend: trend(0.2, 0.02) },
        { label: "Avg win probability", value: "38%", delta: -2.3, trend: trend(40, -0.4) },
        { label: "Avg sales cycle", value: "41 days", delta: -6, invert: true },
      ]}
      pipeline={{ title: "Q4 pipeline", stages, owners, defaultDeals: deals, now: NOW }}
      onNewDeal={() => alert("Open the new deal form")}
    />
  );
}
