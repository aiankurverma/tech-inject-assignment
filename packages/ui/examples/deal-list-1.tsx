import * as React from "react";
import { DealList, type DealRow } from "@/components/crm/deal-list";
import { Button } from "@/components/crm/button";

const deals: DealRow[] = [
  {
    id: "1",
    name: "Enterprise renewal",
    company: "LVMH",
    amount: 530111,
    stage: "Proposal",
    probability: 50,
    closeDate: "2026-10-14",
    owner: "Maya Chen",
    status: "open",
  },
  {
    id: "2",
    name: "Multi-year MSA",
    company: "Wayne Enterprises",
    amount: 890000,
    stage: "Negotiation",
    probability: 75,
    closeDate: "2026-11-03",
    owner: "Maya Chen",
    status: "open",
  },
  {
    id: "3",
    name: "Analytics add-on",
    company: "Stark Industries",
    amount: 48000,
    stage: "Proposal",
    probability: 50,
    closeDate: "2026-09-02",
    owner: "Leo Park",
    status: "open",
  },
  {
    id: "4",
    name: "Data platform pilot",
    company: "Initech",
    amount: 64500,
    stage: "Discovery",
    probability: 25,
    closeDate: "2026-11-29",
    owner: "Priya Nair",
    status: "open",
  },
  {
    id: "5",
    name: "Pilot → production",
    company: "Dinosaur Labs",
    amount: 42000,
    stage: "Commit",
    probability: 90,
    closeDate: "2026-10-09",
    owner: "Leo Park",
    status: "open",
  },
  {
    id: "6",
    name: "Berlin office rollout",
    company: "Siemens",
    amount: 76000,
    currency: "EUR",
    stage: "Discovery",
    probability: 25,
    closeDate: "2026-12-01",
    owner: "Jonas Weber",
    status: "open",
  },
  {
    id: "7",
    name: "Q2 upsell",
    company: "Globex",
    amount: 27500,
    stage: "Closed",
    probability: 100,
    closeDate: "2026-06-30",
    owner: "Priya Nair",
    status: "won",
  },
  {
    id: "8",
    name: "Security review",
    company: "Umbrella Corp",
    amount: 120000,
    stage: "Closed",
    probability: 0,
    closeDate: "2026-07-18",
    owner: "Maya Chen",
    status: "lost",
  },
];

export default function Example() {
  const [msg, setMsg] = React.useState("");
  return (
    <div className="flex w-full max-w-[1100px] flex-col gap-2">
      <DealList
        deals={deals}
        today="2026-09-28"
        stageColors={{
          Discovery: "blue",
          Proposal: "purple",
          Negotiation: "amber",
          Commit: "green",
        }}
        onOpenDeal={(d) => setMsg(`Opened ${d.name}`)}
        bulkActions={(ids) => (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMsg(`Reassign ${ids.length} deals`)}
            >
              Reassign
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMsg(`Exported ${ids.length} deals`)}
            >
              Export CSV
            </Button>
          </>
        )}
      />
      {msg ? <p className="text-xs text-crm-subtle">{msg}</p> : null}
    </div>
  );
}
