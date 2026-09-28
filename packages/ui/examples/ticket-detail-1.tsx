import { TicketDetail, type TicketRecord } from "@/components/crm/ticket-detail";

const hAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const ticket: TicketRecord = {
  id: "t5",
  number: "#4807",
  subject: "API returns 429 during nightly sync",
  requester: {
    name: "Ravi Menon",
    email: "ravi@quantafin.in",
    company: "QuantaFin",
    plan: "Business – annual",
  },
  priority: "high",
  status: "open",
  assignee: "Ana Silva",
  channel: "email",
  tags: ["api", "rate-limit", "integration"],
  createdAt: hAgo(20),
  messages: [
    {
      id: "m1",
      author: "Ravi Menon",
      kind: "customer",
      body: "Since Tuesday our 02:00 IST sync fails with HTTP 429 after ~1,200 requests. Nothing changed on our side. Logs attached.",
      at: hAgo(20),
      attachments: [{ name: "sync-2026-09-27.log", size: 482_133 }],
    },
    {
      id: "m2",
      author: "Ana Silva",
      kind: "agent",
      body: "Hi Ravi — thanks for the logs. I can see the burst hitting our per-minute limit. Looking into whether your plan's limit changed.",
      at: hAgo(18),
    },
    {
      id: "m3",
      author: "Ana Silva",
      kind: "note",
      body: "Their workspace was migrated to the new limiter on Monday. Engineering (Jon) confirms Business plan = 600 rpm now. Suggest batching endpoint.",
      at: hAgo(4),
    },
  ],
};

const macros = [
  {
    id: "mc1",
    label: "Suggest batch endpoint",
    body: "Hi {{requester}}, you can cut request volume ~20× by switching to POST /v2/batch (up to 100 records per call). Docs: https://docs.example.com/batch",
    setStatus: "pending" as const,
  },
  {
    id: "mc2",
    label: "Close – resolved",
    body: "Glad that's sorted, {{requester}}! I'll mark this solved; just reply to reopen.",
    setStatus: "solved" as const,
  },
];

export default function Example() {
  return (
    <TicketDetail
      className="w-full max-w-[1100px]"
      ticket={ticket}
      agents={["Ana Silva", "Sam Ortiz", "Jon Bell"]}
      currentUser="Ana Silva"
      macros={macros}
    />
  );
}
