import * as React from "react";
import { EmailThread, type EmailMessage } from "@/components/crm/email-thread";

const jane = { name: "Jane Cooper", email: "jane@acme.com" };
const priya = { name: "Priya Sharma", email: "priya@kitbase.io" };
const legal = { name: "Wade Warren", email: "wade.warren@acme.com" };

const messages: EmailMessage[] = [
  {
    id: "1",
    from: priya,
    to: [jane],
    sentAt: "2026-08-25T09:14",
    outbound: true,
    body: "Hi Jane,\n\nThanks for the time on Friday. Attached is the proposal for 250 seats on the Growth plan with annual billing.\n\nBest,\nPriya",
    attachments: [{ name: "Acme_Proposal_v2.pdf", size: "412 KB" }],
  },
  {
    id: "2",
    from: jane,
    to: [priya],
    cc: [legal],
    sentAt: "2026-08-26T15:02",
    body: "Priya, looping in Wade from legal. Can we get the DPA and your SOC 2 report?\n\nOn Mon, Aug 25, Priya Sharma wrote:\n> Thanks for the time on Friday. Attached is the proposal...",
  },
  {
    id: "3",
    from: priya,
    to: [jane, legal],
    sentAt: "2026-08-26T17:45",
    outbound: true,
    body: "Of course. DPA and the SOC 2 Type II bridge letter are attached. The full report is in our trust portal under NDA.\n\n> Can we get the DPA and your SOC 2 report?",
    attachments: [
      { name: "Kitbase_DPA_2026.pdf", size: "188 KB" },
      { name: "SOC2_bridge_letter.pdf", size: "96 KB" },
    ],
  },
  {
    id: "4",
    from: legal,
    to: [priya],
    cc: [jane],
    sentAt: "2026-08-29T11:20",
    body: "We need the liability cap raised to 2x annual fees and a 30-day termination for convenience clause. Redlines attached.",
    attachments: [{ name: "MSA_redlines_acme.docx", size: "64 KB" }],
  },
  {
    id: "5",
    from: jane,
    to: [priya],
    sentAt: "2026-09-02T08:31",
    unread: true,
    body: "Hi Priya, finance approved the budget. If you can accept Wade's redlines we can sign before the 15th.\n\nJane",
  },
];

export default function Example() {
  const [action, setAction] = React.useState("");
  return (
    <div className="flex max-w-2xl flex-col gap-2">
      <EmailThread
        subject="Acme × Kitbase: Growth plan proposal"
        messages={messages}
        onReply={(m) => setAction(`Replying to ${m.from.name}`)}
        onForward={(m) => setAction(`Forwarding message from ${m.from.name}`)}
      />
      <p className="text-xs text-crm-muted-fg" aria-live="polite">
        {action}
      </p>
    </div>
  );
}
