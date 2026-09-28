import * as React from "react";
import { Archive, Inbox, Send } from "lucide-react";
import { ShellInbox, type InboxThread } from "@/components/crm/shell-inbox";

const initial: InboxThread[] = [
  {
    id: "t1",
    folder: "inbox",
    from: "Priya Raman",
    subject: "Re: Renewal pricing for FY26",
    preview: "We can sign this week if the 3-year term keeps the 12% discount.",
    at: "2026-09-28T09:42:00",
    unread: true,
    starred: true,
  },
  {
    id: "t2",
    folder: "inbox",
    from: "Marcus Lee",
    subject: "Security questionnaire",
    preview: "Attached the SIG Lite. Our CISO needs answers by Friday.",
    at: "2026-09-28T08:05:00",
    unread: true,
  },
  {
    id: "t3",
    folder: "inbox",
    from: "Helena Novak",
    subject: "Demo follow-up",
    preview: "Thanks for the walkthrough — could you share the sandbox access?",
    at: "2026-09-27T16:20:00",
  },
  {
    id: "t4",
    folder: "inbox",
    from: "Billing Alerts",
    subject: "Payment failed for INV-2041",
    preview: "The card on file was declined. Retry scheduled in 3 days.",
    at: "2026-09-24T11:00:00",
    unread: true,
  },
  {
    id: "t5",
    folder: "sent",
    from: "You",
    subject: "Proposal: Acme x Northwind",
    preview: "Please find the proposal attached, valid until Oct 15.",
    at: "2026-09-26T10:10:00",
  },
  {
    id: "t6",
    folder: "archive",
    from: "Daniel Okafor",
    subject: "Signed MSA",
    preview: "Countersigned copy attached for your records.",
    at: "2026-09-02T14:30:00",
  },
];

export default function Example() {
  const [threads, setThreads] = React.useState(initial);
  return (
    <ShellInbox
      className="w-[980px]"
      now={new Date("2026-09-28T12:00:00")}
      threads={threads}
      onOpen={(t) =>
        setThreads((all) => all.map((x) => (x.id === t.id ? { ...x, unread: false } : x)))
      }
      folders={[
        { id: "inbox", label: "Inbox", icon: <Inbox /> },
        { id: "sent", label: "Sent", icon: <Send /> },
        { id: "archive", label: "Archive", icon: <Archive /> },
      ]}
      renderThread={(t) => (
        <div className="flex flex-col gap-3 p-6">
          <h2 className="text-lg font-semibold">{t.subject}</h2>
          <p className="text-xs text-crm-soft">From {t.from}</p>
          <p className="text-sm leading-6 text-crm-muted-fg">{t.preview}</p>
        </div>
      )}
    />
  );
}
