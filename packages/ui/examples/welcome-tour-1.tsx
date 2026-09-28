import * as React from "react";
import { Filter, Plus, Search } from "lucide-react";
import { WelcomeTour, type TourStep } from "@/components/crm/welcome-tour";
import { Button } from "@/components/crm/button";

const steps: TourStep[] = [
  {
    title: "Welcome to your pipeline",
    body: "Here's a 30-second tour of where deals live and how to move them forward.",
  },
  {
    target: "#tour-search",
    title: "Find anything",
    body: "Search contacts, companies and deals. Press ⌘K from anywhere.",
    placement: "bottom",
  },
  {
    target: "#tour-filter",
    title: "Save filtered views",
    body: "Filter by owner, stage or close date and save it as a view for your team.",
    placement: "bottom",
  },
  {
    target: "#tour-board",
    title: "Drag deals between stages",
    body: "Moving a card updates probability and the forecast instantly.",
    placement: "top",
  },
  {
    target: "#tour-new",
    title: "Create your first deal",
    body: "Add a deal with amount and close date to start forecasting.",
    placement: "left",
  },
];

const columns = [
  { stage: "Discovery", deals: ["Globex renewal · $18,400", "Initech pilot · $6,000"] },
  { stage: "Proposal", deals: ["Umbrella expansion · $42,000"] },
  { stage: "Negotiation", deals: ["Hooli enterprise · $120,000"] },
];

export default function Example() {
  const [open, setOpen] = React.useState(false);
  const [finished, setFinished] = React.useState(false);
  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 rounded-crm border border-crm-border bg-crm-bg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label id="tour-search" className="relative flex-1">
          <span className="sr-only">Search</span>
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-crm-subtle" />
          <input
            placeholder="Search deals"
            className="h-8 w-full rounded-crm border border-crm-border bg-crm-raised pl-8 text-xs text-crm-fg"
          />
        </label>
        <Button id="tour-filter">
          <Filter /> Filter
        </Button>
        <Button id="tour-new" variant="primary">
          <Plus /> New deal
        </Button>
      </div>
      <div id="tour-board" className="grid gap-3 sm:grid-cols-3">
        {columns.map((c) => (
          <div key={c.stage} className="flex flex-col gap-2 rounded-crm bg-crm-card p-3">
            <p className="crm-eyebrow text-crm-subtle uppercase">{c.stage}</p>
            {c.deals.map((d) => (
              <p key={d} className="rounded-lg bg-crm-raised p-2 text-xs text-crm-fg">
                {d}
              </p>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={() => setOpen(true)}>
          Start tour
        </Button>
        {finished ? <span className="text-xs text-crm-success">Tour completed</span> : null}
      </div>
      <WelcomeTour
        steps={steps}
        open={open}
        onOpenChange={setOpen}
        onComplete={() => setFinished(true)}
      />
    </div>
  );
}
