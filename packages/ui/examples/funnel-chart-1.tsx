import * as React from "react";
import { FunnelChart, type FunnelStage } from "@/components/crm/funnel-chart";

const stages: FunnelStage[] = [
  { key: "lead", label: "Leads", count: 4820 },
  { key: "mql", label: "Marketing qualified", count: 1310, benchmark: 0.25 },
  { key: "sql", label: "Sales qualified", count: 612, value: 9180000, benchmark: 0.4 },
  { key: "demo", label: "Demo held", count: 344, value: 5160000, benchmark: 0.6 },
  { key: "proposal", label: "Proposal sent", count: 131, value: 2410000, benchmark: 0.5 },
  { key: "won", label: "Closed won", count: 58, value: 1044000, benchmark: 0.35 },
];

export default function Example() {
  const [measure, setMeasure] = React.useState<"count" | "value">("count");
  const [picked, setPicked] = React.useState<string | null>(null);
  return (
    <div className="flex w-[640px] max-w-full flex-col gap-3 font-crm">
      <div className="flex gap-1 text-xs">
        {(["count", "value"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={measure === m}
            onClick={() => setMeasure(m)}
            className="rounded-full border border-crm-border px-2.5 py-1 text-crm-soft aria-pressed:bg-crm-muted aria-pressed:text-crm-fg"
          >
            {m === "count" ? "By records" : "By pipeline $"}
          </button>
        ))}
      </div>
      <FunnelChart
        label="Q3 inbound funnel"
        stages={measure === "value" ? stages.slice(2) : stages}
        measure={measure}
        onStageClick={(s) => setPicked(s.label)}
      />
      {picked ? <p className="text-xs text-crm-subtle">Opening records in “{picked}”…</p> : null}
    </div>
  );
}
