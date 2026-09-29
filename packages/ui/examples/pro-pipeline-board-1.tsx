import * as React from "react";
import {
  ProPipelineBoard,
  type DealMove,
  type PipelineDeal,
  type PipelineOwner,
  type PipelineStage,
} from "@/components/crm/pro-pipeline-board";

const NOW = new Date(2026, 8, 29, 10, 0);
const DAY = 86_400_000;

const stages: PipelineStage[] = [
  { id: "lead", title: "Qualified lead", probability: 0.1, rotDays: 14 },
  { id: "discovery", title: "Discovery", probability: 0.2, rotDays: 21, wipLimit: 2600 },
  { id: "demo", title: "Demo scheduled", probability: 0.35, rotDays: 14, wipLimit: 2200 },
  { id: "proposal", title: "Proposal sent", probability: 0.55, rotDays: 18, wipLimit: 1800 },
  { id: "negotiation", title: "Negotiation", probability: 0.75, rotDays: 25, wipLimit: 1200 },
  { id: "commit", title: "Verbal commit", probability: 0.9, rotDays: 10, wipLimit: 700 },
];

const owners: PipelineOwner[] = [
  { id: "u1", name: "Priya Raman" },
  { id: "u2", name: "Marcus Webb" },
  { id: "u3", name: "Sofia Lindqvist" },
  { id: "u4", name: "Kenji Watanabe" },
  { id: "u5", name: "Amara Okafor" },
  { id: "u6", name: "Diego Herrera" },
];

const companies = [
  "Northwind Logistics",
  "Helios Energy",
  "Brightline Health",
  "Quanta Robotics",
  "Everlane Retail",
  "Atlas Freight",
  "Juniper Bank",
  "Monarch Insurance",
  "Tidewater Foods",
  "Orbit Telecom",
  "Cobalt Mining",
  "Summit Pharma",
  "Lumen Studios",
  "Vantage Realty",
  "Nimbus Cloud",
  "Keystone Manufacturing",
  "Harbor Analytics",
  "Pioneer Education",
  "Redwood Hotels",
  "Sterling Legal",
];
const products = [
  "Enterprise licence",
  "Platform expansion",
  "Annual renewal",
  "Data warehouse add-on",
  "Security bundle",
  "Pilot to production",
  "Multi-region rollout",
  "Support upgrade",
];

// Deterministic PRNG so the demo is stable between renders and screenshots.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeDeals(count: number): PipelineDeal[] {
  const rnd = mulberry32(42);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)] as T;
  // Funnel shape: more deals early in the pipeline.
  const weights = [0.28, 0.22, 0.18, 0.14, 0.11, 0.07];
  const deals: PipelineDeal[] = [];
  for (let i = 0; i < count; i++) {
    let r = rnd();
    let s = 0;
    while (s < weights.length - 1 && r > (weights[s] as number)) r -= weights[s++] as number;
    const company = pick(companies);
    const amount = Math.round((8_000 + rnd() ** 3 * 480_000) / 500) * 500;
    deals.push({
      id: `D-${10_000 + i}`,
      title: `${company.split(" ")[0]} – ${pick(products)}`,
      company,
      amount,
      stageId: (stages[s] as PipelineStage).id,
      ownerId: pick(owners).id,
      rank: i * 1024,
      stageEnteredAt: new Date(+NOW - Math.floor(rnd() ** 2 * 45) * DAY).toISOString(),
      closeDate: new Date(+NOW + Math.floor(5 + rnd() * 120) * DAY).toISOString().slice(0, 10),
    });
  }
  return deals;
}

/** Fake API: 400ms latency; deals over $350k cannot enter Verbal commit without approval. */
function saveMove(move: DealMove) {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      if (move.toStageId === "commit" && move.next.amount > 350_000)
        reject(new Error("Deals over $350k need VP approval before Verbal commit."));
      else resolve(move);
    }, 400),
  );
}

export default function ProPipelineBoardExample() {
  const [deals, setDeals] = React.useState(() => makeDeals(12_000));
  const [opened, setOpened] = React.useState<PipelineDeal | null>(null);

  return (
    <div className="flex flex-col gap-2 bg-crm-bg p-4">
      <ProPipelineBoard
        title="FY27 new business pipeline"
        stages={stages}
        owners={owners}
        deals={deals}
        onDealsChange={setDeals}
        onMoveDeal={saveMove}
        onOpenDeal={setOpened}
        now={NOW}
        height={520}
        laneHeight={260}
      />
      <p className="font-crm text-xs text-crm-muted-fg" aria-live="polite">
        {opened
          ? `Opened ${opened.id}: ${opened.title} (${opened.company})`
          : "12,000 deals. Drag a card, or focus one and press Space. Moves over $350k into Verbal commit are rejected by the fake API and roll back."}
      </p>
    </div>
  );
}
