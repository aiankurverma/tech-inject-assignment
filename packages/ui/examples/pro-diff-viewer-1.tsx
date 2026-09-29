import * as React from "react";
import {
  ProVersionHistory,
  type DiffComment,
  type DocVersion,
} from "@/components/crm/pro-diff-viewer";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

const v1 = `# Billing plans served to checkout and the pricing page
currency: USD
trial_days: 14
plans:
  - id: starter
    name: Starter
    price_monthly: 29
    price_yearly: 290
    seats_included: 3
    features: [contacts, deals, email_sync]
  - id: growth
    name: Growth
    price_monthly: 79
    price_yearly: 790
    seats_included: 10
    features: [contacts, deals, email_sync, sequences, reports]
  - id: scale
    name: Scale
    price_monthly: 199
    price_yearly: 1990
    seats_included: 25
    features: [contacts, deals, email_sync, sequences, reports, sso, audit_log]
overage:
  per_seat_monthly: 12
  grace_period_days: 7
tax:
  collect_vat: true
  reverse_charge_eu: true
`;

const v2 = v1
  .replace("trial_days: 14", "trial_days: 21")
  .replace("per_seat_monthly: 12", "per_seat_monthly: 10");
const v3 = v2
  .replace("price_monthly: 79", "price_monthly: 89")
  .replace("price_yearly: 790", "price_yearly: 890")
  .replace(
    "features: [contacts, deals, email_sync, sequences, reports]",
    "features: [contacts, deals, email_sync, sequences, reports, forecasting]",
  );
const v4 = v3.replace(
  "overage:",
  `  - id: enterprise
    name: Enterprise
    price_monthly: null # sales-led
    seats_included: 100
    features: [everything, sandbox, dedicated_csm]
overage:`,
);
const v5 = v4
  .replace("grace_period_days: 7", "grace_period_days: 10")
  .replace("collect_vat: true", "collect_vat: true\n  collect_gst_in: true");

const initialVersions: DocVersion[] = [
  {
    id: "v1",
    name: "Launch pricing",
    createdAt: hoursAgo(26 * 24),
    author: { name: "Maya Chen" },
    content: v1,
    message: "Initial plans for GA",
  },
  {
    id: "v2",
    createdAt: hoursAgo(9 * 24),
    author: { name: "Rahul Mehta" },
    content: v2,
    message: "Longer trial, cheaper overage seats",
  },
  {
    id: "v3",
    name: "Growth repricing",
    createdAt: hoursAgo(50),
    author: { name: "Maya Chen" },
    content: v3,
    message: "Growth +$10, adds forecasting",
  },
  {
    id: "v4",
    createdAt: hoursAgo(28),
    author: { name: "Jonas Weber" },
    content: v4,
    message: "Enterprise tier (sales-led)",
  },
  {
    id: "v5",
    createdAt: hoursAgo(2),
    author: { name: "Aisha Khan" },
    content: v5,
    message: "India GST, longer grace period",
  },
];

export default function Example() {
  const [versions, setVersions] = React.useState(initialVersions);
  const [comments, setComments] = React.useState<DiffComment[]>([
    {
      id: "c1",
      side: "new",
      line: 29,
      author: { name: "Rahul Mehta" },
      body: "Finance asked for 10 days to match the invoice terms. Approved.",
      createdAt: hoursAgo(1),
    },
  ]);

  return (
    <div className="bg-crm-bg p-4">
      <ProVersionHistory
        versions={versions}
        language="yaml"
        height={480}
        comments={comments}
        onAddComment={async ({ side, line, body }) => {
          await new Promise((r) => setTimeout(r, 400));
          setComments((cs) => [
            ...cs,
            {
              id: crypto.randomUUID(),
              side,
              line,
              body,
              author: { name: "You" },
              createdAt: new Date(),
            },
          ]);
        }}
        onRename={(v, name) =>
          setVersions((vs) =>
            vs.map((x) => (x.id === v.id ? { ...x, name: name || undefined } : x)),
          )
        }
        onRestore={async (v) => {
          await new Promise((r) => setTimeout(r, 700));
          setVersions((vs) => [
            ...vs,
            {
              id: `v${vs.length + 1}`,
              createdAt: new Date(),
              author: { name: "You" },
              content: v.content,
              message: `Restored "${v.name ?? v.id}"`,
            },
          ]);
        }}
      />
    </div>
  );
}
