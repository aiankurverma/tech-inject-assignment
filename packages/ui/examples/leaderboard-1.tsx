import * as React from "react";
import { Leaderboard, type LeaderboardRep } from "@/components/crm/leaderboard";

const reps: LeaderboardRep[] = [
  {
    id: "r1",
    name: "Priya Sharma",
    team: "Enterprise",
    revenue: 412_500,
    quota: 380_000,
    deals: 6,
    previousRank: 2,
  },
  {
    id: "r2",
    name: "Marcus Webb",
    team: "Enterprise",
    revenue: 388_000,
    quota: 420_000,
    deals: 5,
    previousRank: 1,
  },
  {
    id: "r3",
    name: "Aisha Khan",
    team: "Mid-market",
    revenue: 214_300,
    quota: 180_000,
    deals: 11,
    previousRank: 5,
  },
  {
    id: "r4",
    name: "Diego Alvarez",
    team: "Mid-market",
    revenue: 198_900,
    quota: 200_000,
    deals: 9,
    previousRank: 3,
  },
  {
    id: "r5",
    name: "Hannah Lee",
    team: "SMB",
    revenue: 142_750,
    quota: 120_000,
    deals: 23,
    previousRank: 4,
  },
  {
    id: "r6",
    name: "Tom Becker",
    team: "SMB",
    revenue: 96_400,
    quota: 120_000,
    deals: 17,
    previousRank: 6,
  },
  {
    id: "r7",
    name: "Rahul Verma",
    team: "Mid-market",
    revenue: 88_000,
    quota: 180_000,
    deals: 4,
    previousRank: 8,
  },
  {
    id: "r8",
    name: "Sofia Rossi",
    team: "SMB",
    revenue: 61_200,
    quota: 120_000,
    deals: 12,
    previousRank: 7,
  },
];

export default function Example() {
  const [sel, setSel] = React.useState<LeaderboardRep | null>(null);
  return (
    <div className="max-w-md rounded-crm border border-crm-border bg-crm-card p-4">
      <h3 className="mb-2 text-sm font-medium text-crm-fg">Q3 leaderboard</h3>
      <Leaderboard reps={reps} currentUserId="r7" limit={5} onSelect={setSel} />
      {sel ? (
        <p className="mt-2 text-xs text-crm-muted-fg">Opening {sel.name}&apos;s pipeline…</p>
      ) : null}
    </div>
  );
}
