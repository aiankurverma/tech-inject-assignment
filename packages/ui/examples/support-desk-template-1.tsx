import * as React from "react";
import { SupportDeskTemplate } from "@/components/crm/support-desk-template";
import type { Ticket, TicketMessage } from "@/components/crm/pro-ticket-console";

const AGENTS = ["Priya Nair", "Marco Silva", "Hana Kim"];
const SUBJECTS = [
  "SSO login loops back to the sign-in page",
  "Invoice shows duplicate seat charges",
  "Webhook deliveries failing with 502",
  "Cannot invite teammates",
  "Export to CSV times out",
];
const STATUSES: Ticket["status"][] = ["open", "open", "pending", "solved"];
const PRIOS: Ticket["priority"][] = ["urgent", "high", "normal", "low"];
const NOW = Date.UTC(2026, 8, 29, 12);

// Small deterministic generator: 30 tickets.
function makeTickets(n: number): Ticket[] {
  return Array.from({ length: n }, (_, i) => {
    const name = ["Ava Patel", "Noah Chen", "Mia Rossi", "Liam Byrne"][i % 4] ?? "Ava Patel";
    const created = NOW - ((i * 37) % 72) * 3_600_000;
    return {
      id: String(4800 + n - i),
      subject: SUBJECTS[i % SUBJECTS.length] ?? "Question",
      preview: "Hi team, we are still seeing this after following the docs…",
      requester: {
        name,
        email: `${name.toLowerCase().replace(" ", ".")}@example.com`,
        company: ["Northwind", "Brightline", "Kestrel Bank"][i % 3],
        plan: ["Starter", "Growth", "Enterprise"][i % 3],
      },
      status: STATUSES[i % STATUSES.length] ?? "open",
      priority: PRIOS[(i * 3) % PRIOS.length] ?? "normal",
      assignee: i % 4 === 0 ? null : (AGENTS[i % AGENTS.length] ?? null),
      tags: [["billing", "sso", "api", "export"][i % 4] ?? "api"],
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(created + 1_800_000).toISOString(),
      unread: i % 5 === 0,
    };
  });
}

async function loadThread(t: Ticket): Promise<TicketMessage[]> {
  await new Promise((r) => setTimeout(r, 250));
  return [
    {
      id: `${t.id}-1`,
      author: t.requester.name,
      role: "customer",
      body: `${t.subject}. Can you take a look today?`,
      at: t.createdAt,
    },
  ];
}

export default function Example() {
  const [tickets, setTickets] = React.useState(() => makeTickets(30));
  return (
    <SupportDeskTemplate
      kpis={[
        { label: "Open tickets", value: "128", delta: -6, invert: true },
        { label: "First response", value: "42m", delta: -12, invert: true },
        { label: "SLA met", value: "96.4%", delta: 1.2 },
        { label: "CSAT", value: "4.7", delta: 0.4 },
      ]}
      console={{
        tickets,
        onTicketsChange: setTickets,
        currentUser: "Priya Nair",
        agents: AGENTS,
        loadThread,
        onReply: () => new Promise((r) => setTimeout(r, 300)),
        slaPolicy: { urgent: 30, high: 120 },
        now: new Date(NOW),
        layoutId: "support-desk-template",
      }}
    />
  );
}
