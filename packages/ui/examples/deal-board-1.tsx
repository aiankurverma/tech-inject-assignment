import * as React from "react";
import { DealBoard, type BoardDeal, type BoardStage } from "@/components/crm/deal-board";

const stages: BoardStage[] = [
  { id: "qualified", label: "Qualified", probability: 10, color: "#8b8b8b" },
  { id: "discovery", label: "Discovery", probability: 25, color: "#3b82f6" },
  { id: "proposal", label: "Proposal", probability: 50, color: "#6346ff", limit: 4 },
  { id: "negotiation", label: "Negotiation", probability: 75, color: "#f59e0b" },
  { id: "commit", label: "Commit", probability: 90, color: "#22c55e" },
];

const deals: BoardDeal[] = [
  {
    id: "d1",
    stageId: "qualified",
    title: "Warehouse scanners",
    company: "Northwind Traders",
    amount: 18400,
    closeDate: "Dec 12",
    owner: { name: "Priya Nair" },
  },
  {
    id: "d2",
    stageId: "qualified",
    title: "Support desk – 40 seats",
    company: "Globex",
    amount: 32000,
    closeDate: "Jan 08",
    owner: { name: "Leo Park" },
  },
  {
    id: "d3",
    stageId: "discovery",
    title: "Data platform pilot",
    company: "Initech",
    amount: 64500,
    closeDate: "Nov 29",
    owner: { name: "Maya Chen" },
    tag: { label: "Inbound", color: "blue" },
  },
  {
    id: "d4",
    stageId: "discovery",
    title: "EMEA expansion",
    company: "Umbrella Corp",
    amount: 210000,
    closeDate: "Feb 14",
    owner: { name: "Priya Nair" },
  },
  {
    id: "d5",
    stageId: "proposal",
    title: "Enterprise renewal",
    company: "LVMH",
    amount: 530111,
    closeDate: "Oct 14",
    owner: { name: "Maya Chen" },
    tag: { label: "Hot", color: "red" },
  },
  {
    id: "d6",
    stageId: "proposal",
    title: "Analytics add-on",
    company: "Stark Industries",
    amount: 48000,
    closeDate: "Oct 02",
    overdue: true,
    owner: { name: "Leo Park" },
  },
  {
    id: "d7",
    stageId: "negotiation",
    title: "Multi-year MSA",
    company: "Wayne Enterprises",
    amount: 890000,
    closeDate: "Nov 03",
    owner: { name: "Maya Chen" },
    tag: { label: "Legal", color: "purple" },
  },
  {
    id: "d8",
    stageId: "commit",
    title: "Pilot → production",
    company: "Dinosaur Labs",
    amount: 42000,
    closeDate: "Oct 09",
    owner: { name: "Leo Park" },
  },
];

export default function Example() {
  const [log, setLog] = React.useState<string[]>([]);
  return (
    <div className="flex w-full max-w-[1200px] flex-col gap-2">
      <DealBoard
        stages={stages}
        defaultDeals={deals}
        currency="USD"
        onDealMove={(id, to) => setLog((l) => [`${id} → ${to}`, ...l].slice(0, 3))}
        onAddDeal={(stage) => setLog((l) => [`add deal in ${stage}`, ...l].slice(0, 3))}
      />
      {log.length ? <p className="text-xs text-crm-subtle">Recent: {log.join(" · ")}</p> : null}
    </div>
  );
}
