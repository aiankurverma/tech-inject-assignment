import { SettingsWebhooks, type WebhookEndpoint } from "@/components/crm/settings-webhooks";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const endpoints: WebhookEndpoint[] = [
  {
    id: "wh_1",
    url: "https://api.northwind.io/hooks/crm",
    events: ["deal.created", "deal.stage_changed", "deal.won"],
    enabled: true,
    secret: "whsec_9f2kq8x1m4n7p0r3s6t5v2w1",
    deliveries: [
      { id: "d1", event: "deal.won", status: 200, duration: 184, at: ago(3), attempt: 1 },
      {
        id: "d2",
        event: "deal.stage_changed",
        status: 500,
        duration: 2210,
        at: ago(18),
        attempt: 3,
      },
      { id: "d3", event: "deal.created", status: 200, duration: 142, at: ago(44), attempt: 1 },
      {
        id: "d4",
        event: "deal.stage_changed",
        status: 0,
        duration: 10000,
        at: ago(90),
        attempt: 2,
      },
      { id: "d5", event: "deal.created", status: 204, duration: 97, at: ago(160), attempt: 1 },
    ],
  },
  {
    id: "wh_2",
    url: "https://hooks.zapier.com/hooks/catch/1234/abcd",
    events: ["contact.created"],
    enabled: false,
    secret: "whsec_a1b2c3d4e5f6g7h8i9j0k1l2",
    deliveries: [],
  },
];

export default function Example() {
  return (
    <SettingsWebhooks
      className="max-w-5xl"
      eventCatalog={{
        Contacts: ["contact.created", "contact.updated", "contact.deleted"],
        Deals: ["deal.created", "deal.stage_changed", "deal.won", "deal.lost"],
        Tickets: ["ticket.created", "ticket.sla_breached"],
      }}
      defaultEndpoints={endpoints}
      onRetry={async (_ep, d) => {
        await new Promise((r) => setTimeout(r, 700));
        return {
          ...d,
          id: `${d.id}-r${Date.now()}`,
          status: 200,
          duration: 160,
          at: new Date().toISOString(),
          attempt: d.attempt + 1,
        };
      }}
      onTest={async () => {
        await new Promise((r) => setTimeout(r, 500));
        return {
          id: `t${Date.now()}`,
          event: "ping",
          status: 200,
          duration: 120,
          at: new Date().toISOString(),
          attempt: 1,
        };
      }}
    />
  );
}
