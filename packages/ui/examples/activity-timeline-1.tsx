import { ActivityTimeline, type Activity } from "@/components/crm/activity-timeline";

const items: Activity[] = [
  {
    id: "1",
    type: "email",
    actor: { name: "Maya Chen" },
    text: "emailed Rachel Green",
    detail: "Sharing the revised proposal with the 3-year pricing we discussed.",
    time: "10:42 AM",
  },
  {
    id: "2",
    type: "call",
    actor: { name: "Leo Park" },
    text: "logged a 24 min call",
    time: "9:15 AM",
  },
  {
    id: "3",
    type: "meeting",
    actor: { name: "Maya Chen" },
    text: "scheduled Security review",
    time: "Yesterday, 4:00 PM",
  },
  {
    id: "4",
    type: "note",
    actor: { name: "Sam Ortiz" },
    text: "added a note",
    detail: "Procurement wants SOC 2 report before signing.",
    time: "Yesterday, 11:20 AM",
  },
  { id: "5", type: "task", actor: { name: "Leo Park" }, text: "completed Send NDA", time: "Mon" },
];

export default function Example() {
  return (
    <ActivityTimeline
      className="w-[440px]"
      items={items}
      groups={[
        { label: "Today", ids: ["1", "2"] },
        { label: "Earlier", ids: ["3", "4", "5"] },
      ]}
    />
  );
}
