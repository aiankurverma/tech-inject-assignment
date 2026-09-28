import * as React from "react";
import { SequenceEditor, type SequenceStep } from "@/components/crm/sequence-editor";

const initial: SequenceStep[] = [
  {
    id: "1",
    channel: "email",
    waitDays: 0,
    subject: "{{company}} + faster quote approvals",
    body: "Hi {{first_name}},\n\nNoticed {{company}} is hiring 6 AEs this quarter. Teams that size usually lose ~2 days per deal waiting on discount approvals.\n\nWorth a 15-min look?\n\n{{sender_name}}",
  },
  { id: "2", channel: "linkedin", waitDays: 2, body: "Connect with a note referencing the email." },
  {
    id: "3",
    channel: "call",
    waitDays: 2,
    body: "Open with the hiring news. Ask who owns deal desk today. Voicemail: mention {{title}} peers at Northwind.",
  },
  {
    id: "4",
    channel: "email",
    waitDays: 3,
    subject: "",
    body: "{{first_name}}, bumping this. Happy to send the 1-page ROI model for {{compnay}}.",
  },
];

export default function Example() {
  const [steps, setSteps] = React.useState(initial);
  return (
    <SequenceEditor
      className="max-w-4xl"
      steps={steps}
      onStepsChange={setSteps}
      startDate={new Date(2026, 9, 2)}
    />
  );
}
