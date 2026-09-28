import * as React from "react";
import { SubscriptionStatus, type SubscriptionState } from "@/components/crm/subscription-status";

const now = new Date("2026-09-28T10:00:00Z");
const accounts: {
  name: string;
  status: SubscriptionState;
  periodEnd: string;
  cancelAtPeriodEnd?: boolean;
  retryCount?: number;
}[] = [
  { name: "Northwind Logistics", status: "active", periodEnd: "2026-11-01" },
  { name: "Acme Robotics", status: "trialing", periodEnd: "2026-09-30" },
  { name: "Globex Health", status: "past_due", periodEnd: "2026-10-05", retryCount: 2 },
  { name: "Initech", status: "active", periodEnd: "2026-10-15", cancelAtPeriodEnd: true },
  { name: "Umbrella Retail", status: "paused", periodEnd: "2026-12-01" },
  { name: "Hooli", status: "unpaid", periodEnd: "2026-09-12" },
  { name: "Stark Components", status: "canceled", periodEnd: "2026-08-31" },
];

export default function Example() {
  const [filter, setFilter] = React.useState<"all" | "attention">("all");
  const rows = accounts.filter(
    (a) =>
      filter === "all" ||
      ["past_due", "unpaid", "trialing"].includes(a.status) ||
      a.cancelAtPeriodEnd,
  );
  return (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <div className="flex gap-3 text-xs">
        {(["all", "attention"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={filter === f ? "text-crm-fg underline" : "text-crm-soft"}
          >
            {f === "all" ? "All accounts" : "Needs attention"}
          </button>
        ))}
      </div>
      {rows.map((a) => (
        <div
          key={a.name}
          className="flex flex-col gap-1 rounded-crm border border-crm-border bg-crm-card px-3 py-2"
        >
          <span className="text-xs font-medium text-crm-fg">{a.name}</span>
          <SubscriptionStatus
            {...a}
            now={now}
            action={
              a.status === "past_due" ? (
                <button type="button" className="text-xs text-crm-fg underline">
                  Update card
                </button>
              ) : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}
