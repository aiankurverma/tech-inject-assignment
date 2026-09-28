import * as React from "react";
import { InlineEdit } from "@/components/crm/inline-edit";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-3 border-b border-crm-border py-2 last:border-b-0">
      <dt className="text-xs text-crm-subtle">{label}</dt>
      <dd className="min-w-0 pr-2">{children}</dd>
    </div>
  );
}

export default function Example() {
  const [name, setName] = React.useState("Acme Robotics renewal");
  const [amount, setAmount] = React.useState("48000");
  const [stage, setStage] = React.useState("proposal");
  return (
    <div className="w-[400px] max-w-full rounded-crm border border-crm-border bg-crm-card p-4 font-crm text-crm-fg">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide text-crm-soft uppercase">Deal details</p>
        <p className="text-xs text-crm-subtle">Click a value to edit</p>
      </div>
      <dl>
        <Row label="Deal name">
          <InlineEdit
            label="Deal name"
            value={name}
            validate={(v) => (v.trim() ? undefined : "Name is required")}
            onSave={setName}
          />
        </Row>
        <Row label="Amount">
          <InlineEdit
            label="Amount"
            type="number"
            value={amount}
            renderValue={(v) => `$${Number(v).toLocaleString()}`}
            onSave={(v) => new Promise<void>((r) => setTimeout(() => (setAmount(v), r()), 600))}
          />
        </Row>
        <Row label="Stage">
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
        </Row>
      </dl>
    </div>
  );
}
