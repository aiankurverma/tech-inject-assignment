import * as React from "react";
import {
  ProNotificationInbox,
  type InboxNotification,
  type InboxTypeMeta,
} from "@/components/crm/pro-notification-inbox";

const typeMeta: Record<string, InboxTypeMeta> = {
  mention: { label: "Mention", tone: "text-crm-primary border-crm-primary/40" },
  deal: { label: "Deal", tone: "text-crm-success border-crm-success/40" },
  task: { label: "Task", tone: "text-crm-warning border-crm-warning/40" },
  billing: { label: "Billing", tone: "text-crm-danger border-crm-danger/40" },
  system: { label: "System" },
};

const people = [
  "Priya Sharma",
  "Wade Warren",
  "Esther Howard",
  "Arjun Mehta",
  "Cody Fisher",
  "Neha Kapoor",
  "Jane Cooper",
  "Rahul Verma",
];
const accounts = [
  "Acme Corp",
  "Globex",
  "Initech",
  "Umbrella",
  "Hooli",
  "Stark Industries",
  "Wayne Enterprises",
  "Soylent",
];

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length]!;
}

function make(i: number, at: number): InboxNotification {
  const type = pick(Object.keys(typeMeta), (i * 7) % 11);
  const who = pick(people, i * 3);
  const acct = pick(accounts, i * 5);
  const titles: Record<string, string> = {
    mention: `${who} mentioned you in ${acct} notes`,
    deal: `${acct} moved to ${pick(["Proposal", "Negotiation", "Closed won", "Discovery"], i)}`,
    task: `Follow-up with ${acct} is due`,
    billing: `Invoice INV-${10240 + i} for ${acct} is overdue`,
    system: `Weekly pipeline export is ready`,
  };
  const bodies: Record<string, string> = {
    mention: `"Can you confirm the security questionnaire before Friday's review?"`,
    deal: `Amount ₹${((((i * 37) % 90) + 10) * 10000).toLocaleString("en-IN")} · owner ${who}`,
    task: `Assigned by ${who}. Reminder set for 10:00.`,
    billing: `Net 30 terms expired ${1 + (i % 9)} days ago.`,
    system: "Download expires in 7 days.",
  };
  return {
    id: `n${i}`,
    type,
    title: titles[type]!,
    body: bodies[type],
    actor: type === "system" ? undefined : { name: who },
    createdAt: new Date(at).toISOString(),
    readAt: i % 4 === 0 || i < 3 ? null : new Date(at + 60_000).toISOString(),
    archivedAt: i % 13 === 0 ? new Date(at + 120_000).toISOString() : null,
    snoozedUntil: i % 29 === 0 ? new Date(Date.now() + 86_400_000).toISOString() : null,
  };
}

// 12,000 notifications spread across the last ~90 days.
const NOW = Date.now();
const SEED: InboxNotification[] = Array.from({ length: 12_000 }, (_, i) =>
  make(i, NOW - i * 11 * 60_000 - (i % 7) * 37_000),
);

export default function Example() {
  const next = React.useRef(SEED.length);
  // Simulated websocket: a new notification every 6 seconds.
  const subscribe = React.useCallback((emit: (n: InboxNotification) => void) => {
    const t = setInterval(() => {
      const i = next.current++;
      emit({ ...make(i, Date.now()), readAt: null, archivedAt: null, snoozedUntil: null });
    }, 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-crm-bg p-6">
      <ProNotificationInbox
        className="mx-auto max-w-2xl"
        items={SEED}
        typeMeta={typeMeta}
        subscribe={subscribe}
        onAction={async () => {
          // Replace with your API call; a rejection rolls back the optimistic update.
          await new Promise((r) => setTimeout(r, 150));
        }}
        height={720}
      />
    </div>
  );
}
