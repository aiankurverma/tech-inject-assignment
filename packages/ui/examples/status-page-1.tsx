import { StatusPage, type DayUptime, type StatusService } from "@/components/crm/status-page";

/** Deterministic 90-day history with a few outages at given days-ago offsets. */
function history(outages: Record<number, number>, noDataBefore = 0): DayUptime[] {
  const today = Date.UTC(2026, 8, 28);
  return Array.from({ length: 90 }, (_, i) => {
    const ago = 89 - i;
    const date = new Date(today - ago * 86_400_000).toISOString().slice(0, 10);
    if (ago >= 90 - noDataBefore) return { date };
    return { date, downMinutes: outages[ago] ?? 0 };
  });
}

const services: StatusService[] = [
  {
    id: "api",
    group: "Core",
    name: "REST & GraphQL API",
    state: "degraded",
    history: history({ 0: 38, 17: 95, 60: 6 }),
  },
  {
    id: "sync",
    group: "Integrations",
    name: "Gmail & Outlook sync",
    state: "partial",
    history: history({ 0: 180, 1: 22, 29: 300 }),
  },
];

export default function Example() {
  return (
    <div className="w-full max-w-3xl">
      <StatusPage
        services={services}
        updatedAt="2026-09-28T09:42:00Z"
        timeZone="UTC"
        onSubscribe={() => console.log("subscribe")}
        incidents={[
          {
            id: "inc-2",
            title: "Delayed email sync for Microsoft 365 mailboxes",
            impact: "major",
            serviceIds: ["sync", "api"],
            updates: [
              {
                status: "identified",
                at: "2026-09-28T08:10:00Z",
                message:
                  "Throttling from Microsoft Graph after a token refresh storm. Backing off and replaying queued messages.",
              },
            ],
          },
          {
            id: "inc-1",
            title: "Sync jobs retried after 502s",
            impact: "minor",
            serviceIds: ["sync"],
            updates: [
              {
                status: "investigating",
                at: "2026-08-07T14:02:00Z",
                message: "Some sync jobs are failing with 502 from the load balancer.",
              },
              {
                status: "resolved",
                at: "2026-08-07T14:22:00Z",
                message: "Load balancer rolled back; all queued jobs replayed. No data lost.",
              },
            ],
          },
        ]}
      />
    </div>
  );
}
