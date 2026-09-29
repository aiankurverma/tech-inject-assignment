import * as React from "react";
import {
  ProTicketConsole,
  type Ticket,
  type TicketMacro,
  type TicketMessage,
} from "@/components/crm/pro-ticket-console";

const AGENTS = ["Priya Nair", "Marco Silva", "Hana Kim", "Omar Haddad", "Lena Vogel", "Tom Reed"];
const FIRST = ["Ava", "Noah", "Mia", "Liam", "Zara", "Ethan", "Isla", "Arjun", "Sofia", "Kenji"];
const LAST = ["Patel", "Garcia", "Chen", "Okafor", "Novak", "Rossi", "Tanaka", "Byrne", "Silva"];
const COMPANIES = [
  "Northwind",
  "Acme Logistics",
  "Brightline",
  "Kestrel Bank",
  "Fable Health",
  "Orbital",
];
const PLANS = ["Starter", "Growth", "Enterprise"];
const SUBJECTS = [
  "SSO login loops back to the sign-in page",
  "Invoice shows duplicate seat charges",
  "Webhook deliveries failing with 502",
  "Export to CSV times out on large reports",
  "Cannot invite teammates from the admin panel",
  "API rate limit hit after plan upgrade",
  "Mobile app crashes when opening attachments",
  "Need to change billing contact",
  "Data residency question for EU workspace",
  "Dashboard widgets show stale numbers",
];
const TAGS = ["billing", "sso", "api", "bug", "mobile", "export", "vip", "gdpr", "onboarding"];
const STATUSES: Ticket["status"][] = ["open", "open", "open", "pending", "on-hold", "solved"];
const PRIOS: Ticket["priority"][] = ["urgent", "high", "normal", "normal", "low"];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function makeTickets(n: number): Ticket[] {
  const r = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]!;
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const company = pick(COMPANIES);
    const created = now - Math.floor(r() * 5 * 24 * 3_600_000);
    const viewers = r() < 0.04 ? [pick(AGENTS)] : [];
    return {
      id: String(48000 + n - i),
      subject: pick(SUBJECTS),
      preview: "Hi team, we are still seeing this after following the steps in your docs…",
      requester: {
        name,
        email: `${name.toLowerCase().replace(" ", ".")}@${company.toLowerCase().replace(/\s/g, "")}.com`,
        company,
        plan: pick(PLANS),
      },
      status: pick(STATUSES),
      priority: pick(PRIOS),
      assignee: r() < 0.3 ? null : pick(AGENTS),
      tags: [pick(TAGS), ...(r() < 0.3 ? [pick(TAGS)] : [])],
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(created + Math.floor(r() * 3_600_000)).toISOString(),
      unread: r() < 0.2,
      viewers,
      replying: viewers.length && r() < 0.3 ? viewers : [],
    };
  });
}

const MACROS: TicketMacro[] = [
  {
    id: "need-info",
    name: "Ask for HAR file",
    patch: { status: "pending", addTags: ["needs-info"] },
    reply:
      "Hi {{name}},\n\nThanks for the report. Could you send a HAR file captured while reproducing this? That lets us trace the exact request.",
  },
  {
    id: "escalate",
    name: "Escalate to engineering",
    patch: { priority: "high", addTags: ["escalated"], assignee: "Omar Haddad" },
  },
  {
    id: "billing",
    name: "Route to billing",
    patch: { assignee: "Lena Vogel", addTags: ["billing"] },
    reply:
      "Hi {{name}}, I've looped in our billing team who will follow up within one business day.",
  },
];

async function loadThread(t: Ticket): Promise<TicketMessage[]> {
  await new Promise((r) => setTimeout(r, 350));
  const at = new Date(t.createdAt).getTime();
  return [
    {
      id: `${t.id}-1`,
      author: t.requester.name,
      role: "customer",
      body: `${t.subject}.\n\nThis is blocking ${t.requester.company}'s rollout, can you take a look today?`,
      at: new Date(at).toISOString(),
    },
    {
      id: `${t.id}-2`,
      author: "Hana Kim",
      role: "internal",
      body: "Same symptom as #47112. Engineering has a fix behind a flag.",
      at: new Date(at + 40 * 60_000).toISOString(),
    },
  ];
}

export default function Example() {
  const [tickets, setTickets] = React.useState(() => makeTickets(20_000));
  return (
    <div className="w-full p-2">
      <ProTicketConsole
        tickets={tickets}
        onTicketsChange={setTickets}
        currentUser="Priya Nair"
        agents={AGENTS}
        macros={MACROS}
        loadThread={loadThread}
        onReply={() => new Promise((r) => setTimeout(r, 300))}
        businessHours={{
          timeZone: "Europe/London",
          start: "08:00",
          end: "20:00",
          days: [1, 2, 3, 4, 5, 6],
        }}
        slaPolicy={{ urgent: 30, high: 120 }}
        layoutId="example-ticket-console"
      />
    </div>
  );
}
