import * as React from "react";
import { Filter, Plus, Upload } from "lucide-react";
import { Button } from "@/components/crm/button";
import { SpotlightTour, type SpotlightStep } from "@/components/crm/spotlight-tour";

const steps: SpotlightStep[] = [
  {
    id: "import",
    target: "#tour-import",
    title: "Bring in your contacts",
    body: "Upload a CSV from your old CRM or spreadsheet. We map columns automatically and flag duplicates before anything is saved.",
    placement: "bottom",
  },
  {
    id: "filters",
    target: "#tour-filters",
    title: "Save the views you use daily",
    body: "Combine filters like “Owner is me” and “Last touch > 14 days” and save them as a view for your team.",
    placement: "bottom",
  },
  {
    id: "pipeline",
    target: "#tour-pipeline",
    title: "Your pipeline at a glance",
    body: "Weighted value updates as deals move between stages. Drag cards to change stage.",
    placement: "top",
  },
  {
    id: "done",
    title: "You're all set",
    body: "Replay this tour any time from Help → Product tour.",
  },
];

const stages = [
  { name: "Discovery", count: 14, value: 182_000 },
  { name: "Proposal", count: 8, value: 264_500 },
  { name: "Negotiation", count: 5, value: 311_200 },
  { name: "Commit", count: 3, value: 402_000 },
];
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
});

export default function Example() {
  const [open, setOpen] = React.useState(false);
  const [result, setResult] = React.useState<string>("Not started");
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-4 rounded-xl border border-crm-border bg-crm-bg p-4 font-crm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-semibold text-crm-fg">Contacts</h2>
        <Button id="tour-filters" size="md">
          <Filter /> Filters
        </Button>
        <Button id="tour-import" size="md">
          <Upload /> Import
        </Button>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus /> Start tour
        </Button>
      </div>
      <div id="tour-pipeline" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stages.map((s) => (
          <div key={s.name} className="rounded-xl border border-crm-border bg-crm-card p-3">
            <p className="text-xs text-crm-subtle">{s.name}</p>
            <p className="mt-1 text-sm font-semibold text-crm-fg tabular-nums">
              {usd.format(s.value)}
            </p>
            <p className="text-[11px] text-crm-subtle">{s.count} deals</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-crm-subtle" aria-live="polite">
        Tour status: {result}
      </p>
      <SpotlightTour
        steps={steps}
        open={open}
        onOpenChange={setOpen}
        onComplete={() => setResult("Completed")}
        onSkip={(i) => setResult(`Skipped at step ${i + 1} of ${steps.length}`)}
      />
    </div>
  );
}
