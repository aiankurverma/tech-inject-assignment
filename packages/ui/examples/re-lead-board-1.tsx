import * as React from "react";
import { ReLeadBoard, type ReLead } from "@/components/crm/re-lead-board";

const now = new Date(2026, 8, 28, 10, 0);
const h = (hours: number) => new Date(+now - hours * 3_600_000).toISOString();

const seed: ReLead[] = [
  {
    id: "r1",
    name: "Hannah & Luis Ortega",
    kind: "buyer",
    value: 650000,
    area: "Sellwood",
    source: "Zillow",
    stage: "new",
    agent: "Dana Brooks",
    createdAt: h(3),
  },
  {
    id: "r2",
    name: "Kevin Park",
    kind: "seller",
    value: 820000,
    area: "Laurelhurst",
    source: "Sign call",
    stage: "new",
    agent: "Marcus Lee",
    createdAt: h(0.3),
  },
  {
    id: "r3",
    name: "Aisha Rahman",
    kind: "buyer",
    value: 480000,
    area: "Pearl District",
    source: "Website",
    stage: "contacted",
    agent: "Dana Brooks",
    createdAt: h(50),
    firstContactAt: h(49.5),
    nextFollowUp: "2026-09-27",
    preApproved: true,
  },
  {
    id: "r4",
    name: "The Nguyen family",
    kind: "buyer",
    value: 910000,
    area: "Lake Oswego",
    source: "Referral",
    stage: "touring",
    agent: "Ivy Chen",
    createdAt: h(240),
    firstContactAt: h(239),
    nextFollowUp: "2026-09-30",
    preApproved: true,
  },
  {
    id: "r5",
    name: "Greg Holloway",
    kind: "seller",
    value: 1195000,
    area: "Hawthorne",
    source: "Open house",
    stage: "offer",
    agent: "Ivy Chen",
    createdAt: h(600),
    firstContactAt: h(598),
  },
  {
    id: "r6",
    name: "Beth Carson",
    kind: "buyer",
    value: 525000,
    area: "Division",
    source: "Zillow",
    stage: "contract",
    agent: "Dana Brooks",
    createdAt: h(900),
    firstContactAt: h(899),
    nextFollowUp: "2026-10-12",
    preApproved: true,
  },
  {
    id: "r7",
    name: "Tom & Jess Wilder",
    kind: "buyer",
    value: 892000,
    area: "Lake Oswego",
    source: "Referral",
    stage: "closed",
    agent: "Marcus Lee",
    createdAt: h(1500),
    firstContactAt: h(1499),
  },
];

export default function Example() {
  const [leads, setLeads] = React.useState(seed);
  return <ReLeadBoard className="w-full" leads={leads} onLeadsChange={setLeads} now={now} />;
}
