import * as React from "react";
import { Briefcase, CalendarPlus, NotebookPen, UserPlus } from "lucide-react";
import { Fab } from "@/components/crm/fab";

const deals = [
  ["Northwind Traders", "Proposal", "$48,000"],
  ["Globex Corp", "Negotiation", "$126,500"],
  ["Initech", "Discovery", "$18,200"],
  ["Umbrella Health", "Qualified", "$72,900"],
  ["Stark Logistics", "Proposal", "$34,750"],
  ["Wayne Retail", "Closed won", "$210,000"],
  ["Hooli Cloud", "Discovery", "$9,600"],
  ["Pied Piper", "Negotiation", "$58,300"],
  ["Soylent Foods", "Qualified", "$21,400"],
  ["Cyberdyne", "Proposal", "$95,000"],
];

export default function Example() {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [last, setLast] = React.useState("Scroll the list: the button collapses to an icon.");
  const act = (msg: string) => () => setLast(msg);
  return (
    <div className="relative flex h-[420px] w-[360px] max-w-full flex-col overflow-hidden rounded-xl border border-crm-border bg-crm-bg font-crm">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 pb-6">
        <p className="mb-2 crm-eyebrow text-crm-subtle">Open deals</p>
        <ul className="flex flex-col gap-2">
          {deals.map(([name, stage, amount]) => (
            <li key={name} className="rounded-crm border border-crm-border bg-crm-card px-3 py-2.5">
              <p className="text-sm text-crm-fg">{name}</p>
              <p className="text-xs text-crm-soft">
                {stage} · <span className="tabular-nums">{amount}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex h-[76px] shrink-0 items-center border-t border-crm-border bg-crm-card pr-40 pl-3">
        <p role="status" className="text-xs text-crm-subtle">
          {last}
        </p>
      </div>
      <Fab
        label="Create"
        strategy="absolute"
        extended="auto"
        scrollContainer={scrollRef}
        actions={[
          {
            id: "deal",
            label: "New deal",
            icon: <Briefcase />,
            shortcut: "D",
            onSelect: act("Opened: New deal"),
          },
          {
            id: "contact",
            label: "New contact",
            icon: <UserPlus />,
            shortcut: "C",
            onSelect: act("Opened: New contact"),
          },
          {
            id: "meeting",
            label: "Schedule meeting",
            icon: <CalendarPlus />,
            onSelect: act("Opened: Schedule meeting"),
          },
          {
            id: "note",
            label: "Log note",
            icon: <NotebookPen />,
            disabled: true,
            onSelect: act("Opened: Log note"),
          },
        ]}
      />
    </div>
  );
}
