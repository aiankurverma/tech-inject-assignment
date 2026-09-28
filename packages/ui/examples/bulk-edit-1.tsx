import * as React from "react";
import { BulkEdit, type BulkRecord } from "@/components/crm/bulk-edit";

const records: BulkRecord[] = [
  {
    id: "d1",
    name: "Globex renewal",
    values: { stage: "proposal", amount: 84000, owner: "Maya", tags: ["enterprise"] },
  },
  {
    id: "d2",
    name: "Initech expansion",
    values: { stage: "negotiation", amount: 26500, owner: "Omar", tags: [] },
  },
  {
    id: "d3",
    name: "Umbrella pilot",
    values: { stage: "discovery", amount: 12000, owner: "Maya", tags: ["pilot"] },
  },
  {
    id: "d4",
    name: "Hooli platform",
    values: { stage: "proposal", amount: 142000, owner: "Priya", tags: ["enterprise", "q4"] },
  },
  {
    id: "d5",
    name: "Stark add-on",
    values: { stage: "won", amount: 9800, owner: "Sam", tags: [] },
    lockedReason: "Closed won, finance lock",
  },
  {
    id: "d6",
    name: "Wayne services",
    values: { stage: "discovery", amount: 31000, owner: "Omar", tags: ["services"] },
  },
  {
    id: "d7",
    name: "Soylent upgrade",
    values: { stage: "proposal", amount: 18750, owner: "Priya", tags: [] },
  },
  {
    id: "d8",
    name: "Tyrell seats",
    values: { stage: "negotiation", amount: 57300, owner: "Sam", tags: ["q4"] },
    lockedReason: "Owned by EMEA team",
  },
];

export default function Example() {
  const [log, setLog] = React.useState("");
  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <BulkEdit
        records={records}
        fields={[
          { key: "amount", label: "Amount", type: "currency", required: true },
          {
            key: "stage",
            label: "Stage",
            type: "select",
            required: true,
            options: [
              { value: "discovery", label: "Discovery" },
              { value: "proposal", label: "Proposal" },
              { value: "negotiation", label: "Negotiation" },
              { value: "won", label: "Closed won" },
            ],
          },
          { key: "owner", label: "Owner", type: "text" },
          { key: "tags", label: "Tags", type: "tags" },
        ]}
        onApply={async (changes) => {
          await new Promise((r) => setTimeout(r, 700));
          setLog(`Updated ${changes.length} deals`);
        }}
        onCancel={() => setLog("Cancelled")}
      />
      {log ? <p className="font-crm text-xs text-crm-soft">{log}</p> : null}
    </div>
  );
}
