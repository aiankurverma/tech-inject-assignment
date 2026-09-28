import * as React from "react";
import { AtsCandidate, type AtsCandidateRecord } from "@/components/crm/ats-candidate";

const seed: AtsCandidateRecord = {
  id: "c5",
  name: "Sara Lindqvist",
  email: "sara.lindqvist@example.com",
  phone: "+46 70 123 45 67",
  location: "Stockholm, Sweden (open to remote)",
  currentTitle: "Staff Engineer",
  currentCompany: "Klarna",
  job: "Senior Backend Engineer",
  stages: ["Applied", "Phone screen", "Onsite", "Offer", "Hired"],
  stageIndex: 2,
  expectedSalary: 168000,
  band: { min: 140000, max: 175000 },
  noticeDays: 60,
  skills: ["Go", "PostgreSQL", "Kafka", "Payments", "Distributed systems"],
  status: "active",
  pendingFeedback: ["Omar Haddad"],
  scorecards: [
    {
      id: "s1",
      interviewer: "Priya Nair",
      round: "Phone screen",
      submittedAt: "2026-09-18",
      recommendation: "strong-yes",
      scores: { "System design": 4, Coding: 3, Communication: 4, Ownership: 4 },
      notes: "Led the ledger migration end to end; very clear about trade-offs.",
    },
    {
      id: "s2",
      interviewer: "Leo Martins",
      round: "Onsite · coding",
      submittedAt: "2026-09-25",
      recommendation: "yes",
      scores: { Coding: 3, "System design": 3, Communication: 3 },
    },
    {
      id: "s3",
      interviewer: "Ana Ruiz",
      round: "Onsite · values",
      submittedAt: "2026-09-25",
      recommendation: "no",
      scores: { Communication: 2, Ownership: 3 },
      notes: "Prefers fully async teams; worth probing collaboration expectations.",
    },
  ],
  notes: [
    {
      id: "n1",
      author: "Maya Chen",
      at: "2026-09-26T14:10:00",
      text: "Competing offer expected in about two weeks. Move fast if the panel is positive.",
    },
  ],
};

export default function Example() {
  const [candidate, setCandidate] = React.useState(seed);
  return (
    <AtsCandidate
      className="w-full max-w-[900px]"
      candidate={candidate}
      onCandidateChange={setCandidate}
      currentUser="Maya Chen"
      now={new Date(2026, 8, 28)}
    />
  );
}
