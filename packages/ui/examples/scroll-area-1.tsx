import * as React from "react";
import { ScrollArea } from "@/components/crm/scroll-area";
import { Button } from "@/components/crm/button";

interface Msg {
  id: number;
  from: "agent" | "customer";
  name: string;
  text: string;
  at: string;
}

const seed: Msg[] = [
  {
    id: 1,
    from: "customer",
    name: "Dana (Globex)",
    text: "Our invoice INV-8812 shows 30 seats but we downgraded to 22.",
    at: "09:02",
  },
  {
    id: 2,
    from: "agent",
    name: "You",
    text: "Thanks Dana — checking the subscription history now.",
    at: "09:03",
  },
  {
    id: 3,
    from: "agent",
    name: "You",
    text: "I see the change on Sep 14, after the billing run on Sep 12.",
    at: "09:05",
  },
  {
    id: 4,
    from: "customer",
    name: "Dana (Globex)",
    text: "So can we get the 8 seats prorated?",
    at: "09:06",
  },
  {
    id: 5,
    from: "agent",
    name: "You",
    text: "Yes — I'll issue a credit note for the difference.",
    at: "09:07",
  },
  {
    id: 6,
    from: "customer",
    name: "Dana (Globex)",
    text: "Perfect. Please send it to ap@globex.com as well.",
    at: "09:09",
  },
];

const replies = [
  "Got it, thanks!",
  "Will the credit show on next month's invoice?",
  "Can you also update the PO number?",
];

export default function Example() {
  const [msgs, setMsgs] = React.useState(seed);
  const [loadedOlder, setLoadedOlder] = React.useState(false);

  return (
    <div className="w-full max-w-md space-y-2 font-crm">
      <ScrollArea
        label="Conversation with Globex"
        maxHeight={260}
        stickToBottom
        contentKey={msgs.length}
        className="rounded-crm border border-crm-border bg-crm-surface"
      >
        <ol className="space-y-2 p-3">
          {!loadedOlder && (
            <li className="text-center">
              <button
                type="button"
                onClick={() => setLoadedOlder(true)}
                className="cursor-pointer text-xs text-crm-subtle underline"
              >
                Load earlier messages
              </button>
            </li>
          )}
          {loadedOlder && (
            <li className="crm-caption text-center">Ticket opened Sep 27 · SLA 4h</li>
          )}
          {msgs.map((m) => (
            <li key={m.id} className={m.from === "agent" ? "flex justify-end" : "flex"}>
              <div
                className={`max-w-[80%] rounded-crm px-3 py-2 text-sm ${
                  m.from === "agent" ? "bg-crm-primary/15 text-crm-fg" : "bg-crm-raised text-crm-fg"
                }`}
              >
                <p className="crm-caption mb-0.5">
                  {m.name} · {m.at}
                </p>
                {m.text}
              </div>
            </li>
          ))}
        </ol>
      </ScrollArea>
      <Button
        size="sm"
        onClick={() =>
          setMsgs((prev) => [
            ...prev,
            {
              id: prev.length + 1,
              from: "customer",
              name: "Dana (Globex)",
              text: replies[prev.length % replies.length] ?? "",
              at: "09:1" + (prev.length % 10),
            },
          ])
        }
      >
        Simulate customer reply
      </Button>
      <ScrollArea
        orientation="horizontal"
        label="Pipeline stages"
        className="rounded-crm border border-crm-border"
      >
        <div className="flex gap-2 p-2">
          {[
            "Lead",
            "Qualified",
            "Discovery",
            "Demo",
            "Proposal",
            "Negotiation",
            "Legal",
            "Closed won",
            "Closed lost",
          ].map((s) => (
            <span
              key={s}
              className="shrink-0 rounded-full bg-crm-raised px-3 py-1 text-xs text-crm-soft"
            >
              {s}
            </span>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
