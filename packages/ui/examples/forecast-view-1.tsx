import * as React from "react";
import { ForecastView } from "@/components/crm/forecast-view";

const reps = [
  {
    id: "r1",
    name: "Priya Raman",
    team: "Enterprise",
    quota: 900_000,
    closedWon: 412_000,
    commit: 280_000,
    bestCase: 190_000,
    pipeline: 410_000,
  },
  {
    id: "r2",
    name: "Marcus Oyelaran",
    team: "Enterprise",
    quota: 900_000,
    closedWon: 655_000,
    commit: 190_000,
    bestCase: 120_000,
    pipeline: 260_000,
  },
  {
    id: "r3",
    name: "Hana Kobayashi",
    team: "Mid-market",
    quota: 450_000,
    closedWon: 148_000,
    commit: 92_000,
    bestCase: 60_000,
    pipeline: 310_000,
  },
  {
    id: "r4",
    name: "Diego Alvarez",
    team: "Mid-market",
    quota: 450_000,
    closedWon: 301_000,
    commit: 110_000,
    bestCase: 85_000,
    pipeline: 140_000,
  },
  {
    id: "r5",
    name: "Lena Fischer",
    team: "SMB",
    quota: 240_000,
    closedWon: 96_000,
    commit: 38_000,
    bestCase: 22_000,
    pipeline: 64_000,
  },
];

export default function Example() {
  const [overrides, setOverrides] = React.useState<Record<string, number>>({ r3: 310_000 });
  return (
    <ForecastView
      className="w-full max-w-[960px]"
      period="Q3 FY26"
      reps={reps}
      overrides={overrides}
      onOverridesChange={setOverrides}
    />
  );
}
