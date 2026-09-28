import { CalendarDays, CreditCard, Mail, MessageSquare, Phone, Webhook } from "lucide-react";
import { IconTile } from "@/components/crm/icon-tile";

const integrations = [
  {
    name: "Gmail",
    icon: <Mail />,
    status: "Connected",
    dot: "success" as const,
    synced: "Synced 2 min ago",
  },
  {
    name: "Google Calendar",
    icon: <CalendarDays />,
    status: "Connected",
    dot: "success" as const,
    synced: "Synced 5 min ago",
  },
  {
    name: "Stripe",
    icon: <CreditCard />,
    status: "Needs re-auth",
    dot: "warning" as const,
    synced: "Token expires in 2 days",
  },
  {
    name: "Slack",
    icon: <MessageSquare />,
    status: "Error",
    dot: "danger" as const,
    synced: "Last sync failed · 403",
  },
  { name: "Aircall", icon: <Phone />, status: "Not connected", inactive: true, synced: "—" },
  {
    name: "Webhooks",
    icon: <Webhook />,
    status: "3 endpoints",
    count: 128,
    synced: "128 failed deliveries",
  },
];

export default function Example() {
  return (
    <div className="flex w-[420px] flex-col gap-4 font-crm">
      <ul className="divide-y divide-crm-border rounded-crm border border-crm-border bg-crm-card">
        {integrations.map((i) => (
          <li key={i.name} className="flex items-center gap-3 px-3 py-2.5">
            <IconTile
              icon={i.icon}
              label={i.name}
              tone="auto"
              dot={i.dot}
              count={i.count}
              inactive={i.inactive}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-crm-fg">{i.name}</p>
              <p className="truncate text-xs text-crm-soft">{i.synced}</p>
            </div>
            <span className="text-xs text-crm-subtle">{i.status}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <IconTile label="Enterprise Pipeline" tone="auto" size="lg" />
        <IconTile label="SMB Pipeline" tone="auto" />
        <IconTile label="Partner Deals" tone="auto" size="sm" shape="circle" />
        <IconTile label="Renewals" tone="primary" size="xs" />
      </div>
    </div>
  );
}
