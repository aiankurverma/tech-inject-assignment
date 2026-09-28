import * as React from "react";
import { ReShowings, type Showing } from "@/components/crm/re-showings";

const now = new Date(2026, 8, 28, 13, 0);
const at = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m).toISOString();

const seed: Showing[] = [
  {
    id: "s1",
    address: "418 Alder Street",
    start: at(28, 9),
    durationMin: 30,
    buyer: "Aisha Rahman",
    agent: "Dana Brooks",
    status: "confirmed",
    access: "Lockbox 4471 on side gate",
  },
  {
    id: "s2",
    address: "22 Pearl Loft #604",
    start: at(28, 10),
    durationMin: 30,
    buyer: "Aisha Rahman",
    agent: "Dana Brooks",
    status: "completed",
    interest: 4,
    feedback: "Loved the light, HOA fee is a concern",
  },
  {
    id: "s3",
    address: "1377 Hawthorne Blvd",
    start: at(28, 15),
    durationMin: 45,
    buyer: "The Nguyen family",
    agent: "Ivy Chen",
    status: "confirmed",
    access: "Call listing agent 30 min ahead",
  },
  {
    id: "s4",
    address: "9031 SE Division St",
    start: at(28, 15, 30),
    durationMin: 30,
    buyer: "Beth Carson",
    agent: "Ivy Chen",
    status: "requested",
  },
  {
    id: "s5",
    address: "5 Cedar Hills Dr",
    start: at(29, 11),
    durationMin: 30,
    buyer: "Hannah & Luis Ortega",
    agent: "Dana Brooks",
    status: "requested",
  },
  {
    id: "s6",
    address: "77 Willamette Ct",
    start: at(29, 11, 40),
    durationMin: 30,
    buyer: "Hannah & Luis Ortega",
    agent: "Dana Brooks",
    status: "confirmed",
    access: "Supra key box",
  },
];

export default function Example() {
  const [showings, setShowings] = React.useState(seed);
  return (
    <ReShowings
      className="w-full max-w-[760px]"
      showings={showings}
      onShowingsChange={setShowings}
      now={now}
    />
  );
}
