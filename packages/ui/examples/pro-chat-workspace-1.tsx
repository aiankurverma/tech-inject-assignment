import { useMemo } from "react";
import {
  ProChatWorkspace,
  type ChatChannel,
  type ChatMessage,
  type ChatUser,
} from "@/components/crm/pro-chat-workspace";

const users: ChatUser[] = [
  { id: "u-me", name: "Priya Sharma", title: "Account Executive", online: true },
  { id: "u-1", name: "Marcus Chen", title: "Sales Engineer", online: true },
  { id: "u-2", name: "Elena Rossi", title: "Head of RevOps", online: true },
  { id: "u-3", name: "Tom Becker", title: "Customer Success", online: false },
  { id: "u-4", name: "Aisha Khan", title: "Solutions Architect", online: true },
  { id: "u-5", name: "Diego Alvarez", title: "SDR Lead", online: false },
  { id: "u-6", name: "Hannah Lee", title: "Legal Counsel", online: true },
];

const HOUR = 3_600_000;
const now = Date.now();

const channels: ChatChannel[] = [
  {
    id: "deals",
    name: "deals-enterprise",
    topic: "Enterprise pipeline, Q4 commits",
    lastReadAt: now - 3 * HOUR,
  },
  {
    id: "acme",
    name: "acct-acme-corp",
    kind: "private",
    topic: "Acme renewal war room",
    lastReadAt: now - 20 * HOUR,
  },
  { id: "cs", name: "customer-success", topic: "Escalations and health scores", lastReadAt: now },
  { id: "rand", name: "random", muted: true, lastReadAt: now - 48 * HOUR },
  { id: "dm-elena", name: "Elena Rossi", kind: "direct", lastReadAt: now - HOUR },
  { id: "dm-marcus", name: "Marcus Chen", kind: "direct", lastReadAt: now },
];

const lines = [
  "Pushed the Acme order form to legal, redlines expected by Thursday.",
  "Can someone confirm the SSO requirement for the Northwind pilot?",
  "Forecast call moved to 3pm, updated the invite.",
  "Globex asked for a 3-year term with a 7% uplift cap.",
  "Security questionnaire is done, attached the final version.",
  "Champion at Initech just changed roles, need a new exec sponsor.",
  "Pricing approval for Umbrella went through, 18% discount.",
  "Demo environment is reset and seeded with their data.",
  "Procurement wants net-60, finance says net-45 max.",
  "Closed-won: Stark Industries, 240 seats!",
  "Who owns the Hooli expansion now that Diego moved teams?",
  "Reminder: CRM hygiene sweep before end of quarter.",
];

// Deterministic PRNG so the demo is stable between renders.
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function generate(): ChatMessage[] {
  const rand = rng(42);
  const out: ChatMessage[] = [];
  const perChannel: Record<string, number> = {
    deals: 12000,
    acme: 1800,
    cs: 900,
    rand: 600,
    "dm-elena": 300,
    "dm-marcus": 120,
  };
  for (const [channelId, count] of Object.entries(perChannel)) {
    let t = now - count * 0.12 * HOUR;
    for (let i = 0; i < count; i++) {
      t += rand() * 0.24 * HOUR;
      if (t > now - 60_000) t = now - (count - i) * 30_000;
      const author = users[Math.floor(rand() * users.length)]!;
      const r = rand();
      out.push({
        id: `${channelId}-${i}`,
        channelId,
        authorId: author.id,
        createdAt: Math.round(t),
        text: lines[Math.floor(rand() * lines.length)]!,
        reactions:
          r < 0.12 ? { "👍": ["u-1", "u-2"], ...(r < 0.04 ? { "🎉": ["u-me"] } : {}) } : undefined,
        attachments:
          r > 0.97
            ? [{ id: `f-${i}`, name: "Order_Form_v3.pdf", size: 482_133, type: "application/pdf" }]
            : undefined,
      });
    }
  }
  // A lively thread on a recent deals message.
  const parent = out.find((m) => m.id === "deals-11990")!;
  parent.text = "Stark Industries wants to start the rollout Monday. Who can own onboarding?";
  for (let i = 0; i < 6; i++) {
    out.push({
      id: `thr-${i}`,
      channelId: "deals",
      threadId: parent.id,
      authorId: users[(i % 5) + 1]!.id,
      createdAt: parent.createdAt + (i + 1) * 90_000,
      text: [
        "I can take it.",
        "Kickoff deck is in the shared drive.",
        "Adding their admin to the channel.",
        "SSO config needs their IdP metadata.",
        "Sent the request.",
        "Done, all set for Monday.",
      ][i]!,
    });
  }
  return out;
}

export default function Example() {
  const messages = useMemo(generate, []);
  return (
    <div className="w-full p-4">
      <ProChatWorkspace
        workspaceName="Northwind Sales"
        users={users}
        channels={channels}
        currentUserId="u-me"
        defaultMessages={messages}
        defaultChannelId="deals"
        onSend={() => new Promise<void>((resolve) => setTimeout(resolve, 400))}
      />
    </div>
  );
}
