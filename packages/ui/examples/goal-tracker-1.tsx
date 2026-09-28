import * as React from "react";
import { GoalTracker, type Goal } from "@/components/crm/goal-tracker";

const initial: Goal[] = [
  {
    id: "g1",
    title: "Close $2.4M new ARR",
    team: "Sales",
    owner: { name: "Priya Raman" },
    unit: "currency",
    target: 2_400_000,
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    checkIns: [
      { date: "2026-07-31", value: 690_000, note: "Two enterprise deals slipped" },
      { date: "2026-08-31", value: 1_520_000 },
      { date: "2026-09-22", value: 2_210_000, note: "Globex signed" },
    ],
  },
  {
    id: "g2",
    title: "Book 180 qualified meetings",
    team: "Sales",
    owner: { name: "Tom Becker" },
    unit: "number",
    target: 180,
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    checkIns: [
      { date: "2026-08-15", value: 61 },
      { date: "2026-09-20", value: 104, note: "SDR team down one hire" },
    ],
  },
  {
    id: "g3",
    title: "Reduce logo churn to 1.5%",
    team: "Customer Success",
    owner: { name: "Aisha Khan" },
    unit: "percent",
    start: 2.4,
    target: 1.5,
    startDate: "2026-07-01",
    endDate: "2026-12-31",
    checkIns: [
      { date: "2026-08-01", value: 2.2 },
      { date: "2026-09-01", value: 2.0, note: "Health playbook live" },
    ],
  },
  {
    id: "g4",
    title: "Onboard 40 accounts in under 14 days",
    team: "Customer Success",
    owner: { name: "Lena Fischer" },
    unit: "number",
    target: 40,
    startDate: "2026-07-01",
    endDate: "2026-12-31",
    checkIns: [{ date: "2026-09-15", value: 43, note: "Hit early" }],
  },
  {
    id: "g5",
    title: "Generate 3,000 MQLs",
    team: "Marketing",
    owner: { name: "Diego Alvarez" },
    unit: "number",
    target: 3_000,
    startDate: "2026-07-01",
    endDate: "2026-12-31",
    checkIns: [
      { date: "2026-08-31", value: 980 },
      { date: "2026-09-24", value: 1_390 },
    ],
  },
];

export default function Example() {
  const [goals, setGoals] = React.useState(initial);
  return (
    <GoalTracker
      className="w-full max-w-[900px]"
      goals={goals}
      asOf="2026-09-25"
      onCheckIn={(id, value) =>
        setGoals((gs) =>
          gs.map((g) =>
            g.id === id
              ? {
                  ...g,
                  checkIns: [...g.checkIns, { date: "2026-09-25", value, note: "Logged just now" }],
                }
              : g,
          ),
        )
      }
    />
  );
}
