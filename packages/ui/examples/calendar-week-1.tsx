import * as React from "react";
import { CalendarWeek, type CalendarEvent } from "@/components/crm/calendar-week";

const now = new Date(2026, 8, 29, 11, 20);
const at = (month: number, day: number, h: number, m = 0) =>
  new Date(2026, month, day, h, m).toISOString();

const seed: CalendarEvent[] = [
  { id: "e1", title: "Pipeline review", start: at(8, 28, 9), end: at(8, 28, 10), tone: "primary" },
  {
    id: "e2",
    title: "Discovery · Northwind",
    start: at(8, 29, 10),
    end: at(8, 29, 11),
    location: "Zoom",
    tone: "success",
  },
  {
    id: "e3",
    title: "Demo · Contoso Retail",
    start: at(8, 29, 10, 30),
    end: at(8, 29, 11, 30),
    location: "Google Meet",
    tone: "warning",
  },
  {
    id: "e4",
    title: "1:1 with Priya",
    start: at(8, 29, 10, 45),
    end: at(8, 29, 11, 15),
    tone: "neutral",
  },
  {
    id: "e5",
    title: "Renewal call · LVMH",
    start: at(8, 30, 14),
    end: at(8, 30, 15),
    tone: "danger",
  },
  { id: "e6", title: "QBR prep", start: at(9, 1, 13), end: at(9, 1, 15, 30), tone: "primary" },
  {
    id: "e7",
    title: "SaaStr offsite",
    start: at(9, 2, 0),
    end: at(9, 2, 23),
    allDay: true,
    tone: "success",
  },
  { id: "e8", title: "Forecast call", start: at(9, 2, 16), end: at(9, 2, 16, 30), tone: "warning" },
];

export default function Example() {
  const [events, setEvents] = React.useState(seed);
  const [picked, setPicked] = React.useState<string>("Click an event or an empty slot");
  return (
    <div className="flex w-full max-w-[960px] flex-col gap-2">
      <CalendarWeek
        events={events}
        now={now}
        defaultWeek={now}
        onEventClick={(e) => setPicked(`Opened: ${e.title}`)}
        onSlotClick={(start) => {
          setEvents((ev) => [
            ...ev,
            {
              id: `new-${ev.length}`,
              title: "New meeting",
              start: start.toISOString(),
              end: new Date(+start + 30 * 60_000).toISOString(),
            },
          ]);
          setPicked(`Created meeting at ${start.toLocaleString("en-US")}`);
        }}
      />
      <p className="font-crm text-xs text-crm-subtle">{picked}</p>
    </div>
  );
}
