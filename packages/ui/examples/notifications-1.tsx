import { useState } from "react";
import { Bell, TrendingDown } from "lucide-react";
import { IconButton } from "@/components/crm/button";
import { NotificationsPopover, type Notification } from "@/components/crm/notifications";

const initial: Notification[] = [
  {
    id: "1",
    actor: { name: "Mark Darnalds" },
    text: "mentioned you on Microsoft",
    quote: "Can you join the pilot review on Friday?",
    time: "2m ago",
    context: "Microsoft",
    unread: true,
  },
  {
    id: "2",
    actor: { name: "Sarah Nguyen" },
    text: "moved LVMH to Renewal",
    time: "18m ago",
    context: "LVMH",
    unread: true,
  },
  {
    id: "3",
    icon: <TrendingDown className="text-crm-danger" />,
    text: "Win probability for Slack dropped to 23%",
    time: "1h ago",
    context: "Slack",
    unread: true,
  },
  {
    id: "4",
    actor: { name: "Noah Lee" },
    text: "logged a demo with Stripe",
    time: "Yesterday",
    context: "Stripe",
  },
];

export default function Example() {
  const [items, setItems] = useState(initial);
  return (
    <NotificationsPopover
      defaultOpen
      items={items}
      onMarkAllRead={() => setItems((i) => i.map((n) => ({ ...n, unread: false })))}
      trigger={
        <IconButton label="Notifications" dot={items.some((n) => n.unread)}>
          <Bell />
        </IconButton>
      }
    />
  );
}
