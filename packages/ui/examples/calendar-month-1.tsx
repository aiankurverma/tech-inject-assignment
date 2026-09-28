import * as React from "react";
import { CalendarMonth, type CalendarEvent } from "@/components/crm/calendar-month";

const events: CalendarEvent[] = [
  { id: "e1", title: "Acme QBR", start: "2026-09-02T10:00" },
  { id: "e2", title: "Globex demo", start: "2026-09-02T14:30" },
  { id: "e3", title: "Pipeline review", start: "2026-09-02T16:00" },
  { id: "e4", title: "Initech security review", start: "2026-09-02T17:00" },
  {
    id: "e5",
    title: "SaaStr Europa",
    start: "2026-09-08",
    end: "2026-09-10",
    allDay: true,
    color: "purple",
  },
  { id: "e6", title: "Umbrella renewal due", start: "2026-09-15", allDay: true, color: "red" },
  { id: "e7", title: "Hooli discovery", start: "2026-09-16T11:00" },
  {
    id: "e8",
    title: "Q3 close",
    start: "2026-09-28",
    end: "2026-09-30",
    allDay: true,
    color: "amber",
  },
  { id: "e9", title: "Soylent onboarding", start: "2026-09-22T09:30" },
];

export default function Example() {
  const [selected, setSelected] = React.useState<Date | null>(null);
  const [opened, setOpened] = React.useState<string | null>(null);
  const count = selected
    ? events.filter((e) => new Date(e.start).toDateString() === selected.toDateString()).length
    : 0;
  return (
    <div className="flex max-w-3xl flex-col gap-2">
      <CalendarMonth
        events={events}
        defaultMonth={new Date(2026, 8, 1)}
        today={new Date(2026, 8, 2)}
        selectedDate={selected}
        onSelectDate={setSelected}
        onEventClick={(e) => setOpened(e.title)}
      />
      <p className="text-xs text-crm-muted-fg" aria-live="polite">
        {opened
          ? `Opened “${opened}”`
          : selected
            ? `${selected.toDateString()}: ${count} meetings starting`
            : "Pick a day or an event."}
      </p>
    </div>
  );
}
