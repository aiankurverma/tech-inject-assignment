import * as React from "react";
import { AlertTriangle, CreditCard } from "lucide-react";
import { NotificationCenter, type CenterNotification } from "@/components/crm/notification-center";

const now = new Date(2026, 8, 28, 15, 0);
const ago = (min: number) => new Date(+now - min * 60_000).toISOString();

const seed: CenterNotification[] = [
  {
    id: "n1",
    actor: { name: "Priya Nair" },
    text: "mentioned you on Northwind — Expansion",
    quote: "@Maya can you confirm the 48-seat pricing before Friday?",
    createdAt: ago(4),
    category: "mention",
    unread: true,
    context: "Deals",
  },
  {
    id: "n2",
    actor: { name: "Leo Martins" },
    text: "assigned you Billing export fails for EU accounts",
    createdAt: ago(55),
    category: "assignment",
    unread: true,
    context: "Support · P2",
  },
  {
    id: "n3",
    icon: <AlertTriangle />,
    text: "Contoso Retail moved to Closed lost ($84,000)",
    createdAt: ago(190),
    category: "deal",
    unread: true,
    context: "Pipeline",
  },
  {
    id: "n4",
    actor: { name: "Ana Ruiz" },
    text: "replied to your comment on LVMH renewal",
    createdAt: ago(60 * 20),
    category: "mention",
    context: "Deals",
  },
  {
    id: "n5",
    icon: <CreditCard />,
    text: "Invoice INV-2291 for Globex is 14 days overdue",
    createdAt: ago(60 * 30),
    category: "system",
    context: "Billing",
  },
  {
    id: "n6",
    actor: { name: "Sam Okafor" },
    text: "assigned you 3 leads from the September webinar list",
    createdAt: ago(60 * 24 * 3),
    category: "assignment",
    context: "Leads",
  },
  {
    id: "n7",
    actor: { name: "Priya Nair" },
    text: "closed won Initech — Platform ($126,500)",
    createdAt: ago(60 * 24 * 9),
    category: "deal",
    archived: true,
    context: "Pipeline",
  },
];

export default function Example() {
  const [items, setItems] = React.useState(seed);
  return (
    <NotificationCenter
      className="w-full max-w-[640px]"
      items={items}
      onItemsChange={setItems}
      now={now}
    />
  );
}
