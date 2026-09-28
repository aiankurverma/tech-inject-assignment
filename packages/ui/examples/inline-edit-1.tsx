import * as React from "react";
import { InlineEdit } from "@/components/crm/inline-edit";

export default function Example() {
  const [name, setName] = React.useState("Acme Robotics renewal");
  const [amount, setAmount] = React.useState("48000");
  const [stage, setStage] = React.useState("proposal");
  return (
    <div className="flex max-w-sm flex-col gap-3 font-crm">
      <InlineEdit
        label="Deal name"
        value={name}
        validate={(v) => (v.trim() ? undefined : "Name is required")}
        onSave={setName}
      />
      <InlineEdit
        label="Amount"
        type="number"
        value={amount}
        renderValue={(v) => `$${Number(v).toLocaleString()}`}
        onSave={(v) => new Promise<void>((r) => setTimeout(() => (setAmount(v), r()), 600))}
      />
      <InlineEdit
        label="Stage"
        type="select"
        value={stage}
        onSave={setStage}
        options={[
          { value: "qualified", label: "Qualified" },
          { value: "proposal", label: "Proposal" },
          { value: "won", label: "Closed won" },
        ]}
      />
    </div>
  );
}
