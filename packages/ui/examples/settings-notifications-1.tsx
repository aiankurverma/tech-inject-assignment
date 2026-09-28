import {
  SettingsNotifications,
  type NotificationEvent,
} from "@/components/crm/settings-notifications";

const events: NotificationEvent[] = [
  { key: "deal.assigned", label: "Deal assigned to me", group: "Deals" },
  {
    key: "deal.stage",
    label: "Deal changed stage",
    group: "Deals",
    description: "Only deals you own or follow",
  },
  { key: "deal.rotting", label: "Deal is rotting", group: "Deals" },
  {
    key: "task.due",
    label: "Task due soon",
    group: "Tasks",
    description: "1 hour before the due time",
  },
  { key: "mention", label: "Mentioned in a note", group: "Collaboration" },
  { key: "ticket.sla", label: "SLA about to breach", group: "Support" },
  {
    key: "security.login",
    label: "New sign-in to your account",
    group: "Security",
    required: ["email"],
  },
];

export default function Example() {
  return (
    <SettingsNotifications
      className="max-w-4xl"
      events={events}
      defaultValue={{
        matrix: {
          "deal.assigned": ["email", "inApp", "push"],
          "deal.stage": ["inApp"],
          "task.due": ["inApp", "push"],
          mention: ["email", "inApp", "slack"],
          "ticket.sla": ["inApp", "slack"],
        },
        digest: "daily",
        quietHours: { enabled: true, start: "21:00", end: "07:30", timezone: "Asia/Kolkata" },
        pausedAll: false,
      }}
      onSave={() => new Promise((r) => setTimeout(r, 600))}
    />
  );
}
