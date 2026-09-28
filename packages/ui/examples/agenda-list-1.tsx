import * as React from "react";
import { AgendaList, type AgendaMeeting } from "@/components/crm/agenda-list";

const now = new Date(2026, 8, 2, 9, 52);
const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m);

const meetings: AgendaMeeting[] = [
  { id: "m0", title: "Daily standup", start: at(2, 9), end: at(2, 9, 15), kind: "video" },
  {
    id: "m1",
    title: "Acme Corp QBR",
    start: at(2, 10),
    end: at(2, 11),
    kind: "video",
    related: "Acme Corp · $240k renewal",
    attendees: [
      { name: "Jane Cooper" },
      { name: "Wade Warren" },
      { name: "Esther Howard" },
      { name: "Cody Fisher" },
    ],
  },
  {
    id: "m2",
    title: "Globex pricing call",
    start: at(2, 10, 30),
    end: at(2, 11),
    kind: "call",
    related: "Globex · Negotiation",
    status: "tentative",
  },
  {
    id: "m3",
    title: "Lunch with Initech champion",
    start: at(2, 12, 30),
    end: at(2, 13, 30),
    kind: "in-person",
    location: "Blue Tokai, CP",
  },
  {
    id: "m4",
    title: "Hooli discovery",
    start: at(2, 15),
    end: at(2, 15, 45),
    kind: "video",
    status: "cancelled",
  },
  {
    id: "m5",
    title: "Umbrella security review",
    start: at(3, 11),
    end: at(3, 12),
    kind: "video",
    related: "Umbrella · Security",
    attendees: [{ name: "Robert Fox" }, { name: "Kristin Watson" }],
  },
  { id: "m6", title: "Weekly forecast call", start: at(5, 16), end: at(5, 16, 30), kind: "video" },
];

export default function Example() {
  const [joined, setJoined] = React.useState<string | null>(null);
  return (
    <div className="flex max-w-xl flex-col gap-2">
      <AgendaList meetings={meetings} now={now} onJoin={(m) => setJoined(m.title)} />
      {joined ? <p className="text-xs text-crm-muted-fg">Joining {joined}…</p> : null}
    </div>
  );
}
