import * as React from "react";
import { PipelineStageBar } from "@/components/crm/pipeline-stage-bar";

const stages = [
  { id: "lead", label: "Lead" },
  { id: "qualified", label: "Qualified" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "closed", label: "Closed" },
];

export default function Example() {
  const [stage, setStage] = React.useState("proposal");
  return (
    <div className="flex w-[640px] flex-col gap-4">
      <PipelineStageBar stages={stages} current={stage} onStageChange={setStage} />
      <PipelineStageBar stages={stages} current="closed" outcome="won" />
      <PipelineStageBar stages={stages} current="closed" outcome="lost" />
    </div>
  );
}
