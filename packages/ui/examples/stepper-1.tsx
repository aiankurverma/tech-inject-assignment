import * as React from "react";
import { Stepper } from "@/components/crm/stepper";

const steps = [
  { title: "Upload", description: "CSV or XLSX" },
  { title: "Map fields", description: "Match columns" },
  { title: "Review", description: "Fix duplicates" },
  { title: "Import" },
];

export default function Example() {
  const [current, setCurrent] = React.useState(2);
  return (
    <div className="flex w-[560px] flex-col gap-10">
      <Stepper steps={steps} current={current} onStepClick={setCurrent} />
      <Stepper
        orientation="vertical"
        current={1}
        steps={[
          { title: "Connect mailbox", description: "Gmail or Outlook" },
          { title: "Invite your team", description: "2 of 5 seats used" },
          { title: "Create your first pipeline" },
        ]}
      />
    </div>
  );
}
