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
    id: "app",
    group: "Core",
    name: "Web app",
    description: "app.kitbase.io",
    state: "operational",
    history: history({ 41: 12, 3: 4 }),
  },
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
  {
    id: "hooks",
    group: "Integrations",
    name: "Webhooks",
    state: "operational",
    history: history({ 52: 20 }, 30),
  },
  {
    id: "dial",
    group: "Integrations",
    name: "Power dialer",
    state: "maintenance",
    history: history({}),
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
                status: "investigating",
                at: "2026-09-28T07:05:00Z",
                message: "We're seeing sync delays of up to 40 minutes for Outlook users.",
              },
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
            title: "Webhook deliveries retried",
            impact: "minor",
            serviceIds: ["hooks"],
            updates: [
              {
                status: "investigating",
                at: "2026-08-07T14:02:00Z",
                message: "Some webhook deliveries are returning 502.",
              },
              {
                status: "monitoring",
                at: "2026-08-07T14:20:00Z",
                message: "Load balancer rolled back; retries succeeding.",
              },
              {
                status: "resolved",
                at: "2026-08-07T14:22:00Z",
                message: "All queued deliveries sent. No events lost.",
              },
            ],
          },
        ]}
      />
    </div>
  );
}
