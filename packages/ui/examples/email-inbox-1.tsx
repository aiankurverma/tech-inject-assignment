import { EmailInbox, type EmailThread } from "@/components/crm/email-inbox";

const me = { name: "Maya Chen", email: "maya@kitbase.io" };
const dana = { name: "Dana Whitfield", email: "dana@northwind.com" };
const priya = { name: "Priya Nair", email: "priya@globex.co.uk" };

const threads: EmailThread[] = [
  {
    id: "th1",
    subject: "Re: Renewal — 2-year option",
    folder: "inbox",
    unread: true,
    starred: true,
    hasAttachment: true,
    linkedRecord: "Deal · Northwind renewal",
    messages: [
      {
        id: "m1",
        from: me,
        at: "2026-09-26T16:00:00Z",
        body: "Hi Dana,\nAttached is the revised proposal with a 2-year term.\nBest, Maya",
      },
      {
        id: "m2",
        from: dana,
        at: "2026-09-28T09:14:00Z",
        body: "Thanks Maya — procurement is asking whether the uplift cap applies to add-ons too.\nCan we discuss Thursday?",
      },
    ],
  },
  {
    id: "th2",
    subject: "Security review follow-ups",
    folder: "inbox",
    unread: true,
    linkedRecord: "Deal · Globex pilot",
    messages: [
      {
        id: "m3",
        from: priya,
        at: "2026-09-27T11:30:00Z",
        body: "Our InfoSec team has 6 follow-up questions on EU data residency.",
      },
    ],
  },
  {
    id: "th3",
    subject: "Invoice INV-2026-0418",
    folder: "inbox",
    messages: [
      {
        id: "m4",
        from: { name: "Northwind AP", email: "ap@northwind.com" },
        at: "2026-09-20T08:00:00Z",
        body: "Partial payment sent via wire, ref WF-88213.",
      },
    ],
  },
  {
    id: "th4",
    subject: "Intro: Kitbase <> Umbrella",
    folder: "sent",
    messages: [
      {
        id: "m5",
        from: me,
        at: "2026-09-25T14:20:00Z",
        body: "Great to meet you at SaaStr — sharing the deck we discussed.",
      },
    ],
  },
  {
    id: "th5",
    subject: "Webinar recording",
    folder: "archived",
    messages: [
      {
        id: "m6",
        from: { name: "Events", email: "events@kitbase.io" },
        at: "2026-09-10T10:00:00Z",
        body: "Recording link inside.",
      },
    ],
  },
];

export default function Example() {
  return (
    <div className="w-full max-w-[1040px]">
      <EmailInbox
        defaultThreads={threads}
        me={me}
        onReply={(id, d) => console.log("reply", id, d)}
      />
    </div>
  );
}
