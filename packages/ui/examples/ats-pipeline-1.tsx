import * as React from "react";
import { AtsPipeline, type AtsCandidateCard } from "@/components/crm/ats-pipeline";

const now = new Date(2026, 8, 28, 9, 0);
const d = (days: number) => new Date(+now - days * 86_400_000).toISOString();

const seed: AtsCandidateCard[] = [
  {
    id: "c1",
    name: "Riya Sharma",
    currentTitle: "Backend Engineer, Razorpay",
    stageId: "applied",
    enteredStageAt: d(1),
    source: "Careers page",
  },
  {
    id: "c2",
    name: "Daniel Okoro",
    currentTitle: "SWE II, Shopify",
    stageId: "applied",
    enteredStageAt: d(6),
    source: "LinkedIn",
  },
  {
    id: "c3",
    name: "Mei Tanaka",
    currentTitle: "Senior Engineer, Mercari",
    stageId: "screen",
    enteredStageAt: d(2),
    source: "Referral",
    rating: 3.5,
  },
  {
    id: "c4",
    name: "Lucas Almeida",
    currentTitle: "Platform Engineer, Nubank",
    stageId: "screen",
    enteredStageAt: d(9),
    source: "Sourced",
    rating: 2.8,
  },
  {
    id: "c5",
    name: "Sara Lindqvist",
    currentTitle: "Staff Engineer, Klarna",
    stageId: "onsite",
    enteredStageAt: d(4),
    source: "Agency",
    rating: 3.6,
  },
  {
    id: "c6",
    name: "Omar Haddad",
    currentTitle: "Tech Lead, Careem",
    stageId: "offer",
    enteredStageAt: d(3),
    source: "Referral",
    rating: 3.9,
  },
  {
    id: "c7",
    name: "Chloe Martin",
    currentTitle: "Engineer, Doctolib",
    stageId: "screen",
    enteredStageAt: d(5),
    source: "LinkedIn",
    rejected: { reason: "Compensation mismatch" },
  },
];

export default function Example() {
  const [candidates, setCandidates] = React.useState(seed);
  return (
    <AtsPipeline
      className="w-full"
      now={now}
      job={{ title: "Senior Backend Engineer", department: "Engineering · Payments", openings: 2 }}
      stages={[
        { id: "applied", title: "Applied", slaDays: 3 },
        { id: "screen", title: "Phone screen", slaDays: 5 },
        { id: "onsite", title: "Onsite", slaDays: 7 },
        { id: "offer", title: "Offer", slaDays: 5 },
        { id: "hired", title: "Hired" },
      ]}
      candidates={candidates}
      onCandidatesChange={setCandidates}
    />
  );
}
