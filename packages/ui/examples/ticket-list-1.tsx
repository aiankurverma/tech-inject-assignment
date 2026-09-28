import * as React from "react";
import { TicketList, type TicketRow } from "@/components/crm/ticket-list";

const hAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const initial: TicketRow[] = [
  {
    id: "t1",
    number: "#4821",
    subject: "ERP sync dropping work orders since 09:00",
    requester: "Pepper Potts",
    company: "Stark Industries",
    priority: "urgent",
    status: "open",
    channel: "email",
    createdAt: hAgo(0.7),
    updatedAt: hAgo(0.2),
    replies: 2,
  },
  {
    id: "t2",
    number: "#4819",
    subject: "SSO login loop on Safari 18",
    requester: "Maria Hill",
    company: "Stark Industries",
    priority: "high",
    status: "open",
    assignee: "Sam Ortiz",
    channel: "chat",
    createdAt: hAgo(5),
    firstRespondedAt: hAgo(4.5),
    updatedAt: hAgo(1),
    replies: 5,
  },
  {
    id: "t3",
    number: "#4816",
    subject: "Invoice shows wrong VAT rate (DE)",
    requester: "Hannah Becker",
    company: "Nordlicht GmbH",
    priority: "normal",
    status: "new",
    channel: "web",
    createdAt: hAgo(9),
    updatedAt: hAgo(9),
    replies: 0,
  },
  {
    id: "t4",
    number: "#4810",
    subject: "How do I bulk-import contacts?",
    requester: "Grace Liu",
    company: "Sproutly",
    priority: "low",
    status: "pending",
    assignee: "Ana Silva",
    channel: "email",
    createdAt: hAgo(30),
    firstRespondedAt: hAgo(20),
    updatedAt: hAgo(18),
    replies: 3,
  },
  {
    id: "t5",
    number: "#4807",
    subject: "API returns 429 during nightly sync",
    requester: "Ravi Menon",
    company: "QuantaFin",
    priority: "high",
    status: "open",
    assignee: "Ana Silva",
    channel: "email",
    createdAt: hAgo(22),
    firstRespondedAt: hAgo(20),
    updatedAt: hAgo(3),
    replies: 7,
  },
  {
    id: "t6",
    number: "#4799",
    subject: "Request: dark mode for mobile app",
    requester: "Oliver Grant",
    company: "Meridian Health",
    priority: "low",
    status: "on-hold",
    channel: "web",
    createdAt: hAgo(70),
    firstRespondedAt: hAgo(60),
    updatedAt: hAgo(50),
    replies: 1,
  },
  {
    id: "t7",
    number: "#4790",
    subject: "Password reset email not arriving",
    requester: "Tomás Rivera",
    company: "Kestrel Logistics",
    priority: "normal",
    status: "solved",
    assignee: "Sam Ortiz",
    channel: "chat",
    createdAt: hAgo(80),
    firstRespondedAt: hAgo(79),
    updatedAt: hAgo(75),
    replies: 4,
  },
];

export default function Example() {
  const [tickets, setTickets] = React.useState(initial);
  return (
    <TicketList
      className="w-full max-w-[1150px]"
      tickets={tickets}
      currentUser="Ana Silva"
      onBulkUpdate={(ids, patch) =>
        setTickets((ts) => ts.map((t) => (ids.includes(t.id) ? { ...t, ...patch } : t)))
      }
    />
  );
}
