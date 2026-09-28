import * as React from "react";
import {
  OnboardingChecklist,
  type ChecklistItem,
  type ChecklistItemStatus,
} from "@/components/crm/onboarding-checklist";

const items: ChecklistItem[] = [
  {
    id: "mailbox",
    group: "Connect",
    title: "Connect your mailbox",
    description: "Sync Gmail or Outlook so emails are logged against contacts automatically.",
    minutes: 2,
    actionLabel: "Connect Gmail",
    required: true,
  },
  {
    id: "calendar",
    group: "Connect",
    title: "Sync your calendar",
    description: "Customer meetings appear on the deal timeline with attendees linked.",
    minutes: 1,
    actionLabel: "Connect calendar",
  },
  {
    id: "import",
    group: "Data",
    title: "Import contacts",
    description:
      "Upload a CSV from HubSpot, Salesforce or a spreadsheet. Duplicates are merged by email.",
    minutes: 5,
    actionLabel: "Upload CSV",
    required: true,
  },
  {
    id: "pipeline",
    group: "Data",
    title: "Customise pipeline stages",
    description: "Match stages to how your team sells: Discovery, Demo, Proposal, Negotiation.",
    minutes: 4,
    dependsOn: ["import"],
  },
  {
    id: "invite",
    group: "Team",
    title: "Invite your team",
    description: "4 of 10 seats left on the Growth plan.",
    minutes: 2,
    actionLabel: "Invite teammates",
    dependsOn: ["pipeline"],
  },
];

export default function Example() {
  const [status, setStatus] = React.useState<Record<string, ChecklistItemStatus>>({
    mailbox: "done",
  });
  const [last, setLast] = React.useState<string | null>(null);
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <OnboardingChecklist
        items={items}
        status={status}
        onStatusChange={setStatus}
        onAction={(id) => setLast(id)}
        onDismiss={() => setLast("dismissed")}
        title="Set up Northwind CRM"
      />
      <p className="text-xs text-crm-subtle" aria-live="polite">
        {last ? `Last action: ${last}` : "Press a step's button to open it."}
      </p>
    </div>
  );
}
