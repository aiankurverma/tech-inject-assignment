import * as React from "react";
import {
  ProResourceScheduler,
  type SchedulerEvent,
  type SchedulerResource,
} from "@/components/crm/pro-resource-scheduler";

const REGIONS = ["North London", "Manchester", "Leeds", "Bristol", "Glasgow", "Birmingham"];
const ROLES = ["HVAC engineer", "Electrician", "Plumber", "Solar installer", "Gas safe engineer"];
const COLORS = ["#4124fb", "#16c89e", "#fbbf24", "#f97373", "#38bdf8"];
const FIRST = ["Aisha", "Ben", "Chloe", "Dev", "Ella", "Farid", "Grace", "Harry", "Imani", "Jack"];
const LAST = ["Walker", "Shah", "Evans", "Murphy", "Khan", "Hughes", "Price", "Lewis", "Bell"];
const JOBS = [
  "Boiler service",
  "EV charger install",
  "Fault diagnosis",
  "Annual gas check",
  "Heat pump survey",
  "Consumer unit swap",
  "Leak repair",
  "Panel inspection",
];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function build() {
  const r = rng(7);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]!;
  const resources: SchedulerResource[] = Array.from({ length: 1500 }, (_, i) => {
    const role = ROLES[i % ROLES.length]!;
    return {
      id: `tech-${i + 1}`,
      name: `${pick(FIRST)} ${pick(LAST)}`,
      subtitle: `${role} · ${pick(REGIONS)}`,
      color: COLORS[i % COLORS.length],
      disabled: i % 97 === 13,
    };
  });

  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const events: SchedulerEvent[] = [];
  let n = 0;
  for (const res of resources) {
    if (res.disabled) continue;
    for (let d = 0; d < 6; d++) {
      let hour = 7 + Math.floor(r() * 3);
      const jobs = 1 + Math.floor(r() * 2);
      for (let j = 0; j < jobs && hour < 18; j++) {
        const start = new Date(monday);
        start.setDate(monday.getDate() + d);
        start.setHours(hour, r() < 0.5 ? 0 : 30);
        const len = (1 + Math.floor(r() * 4)) * 60 * 60_000;
        // ~3% overlap the previous job to exercise conflict detection.
        const overlap = r() < 0.03 ? -45 * 60_000 : 0;
        const s = new Date(start.getTime() + overlap);
        events.push({
          id: `job-${++n}`,
          resourceId: res.id,
          title: pick(JOBS),
          start: s.toISOString(),
          end: new Date(s.getTime() + len).toISOString(),
          locked: r() < 0.05,
          meta: { Customer: `${pick(LAST)} residence`, Ref: `WO-${20000 + n}` },
        });
        hour += Math.ceil(len / 3_600_000) + 1;
      }
    }
  }
  // Recurring commitments.
  for (let i = 0; i < 40; i++) {
    const start = new Date(monday);
    start.setHours(8, 0);
    events.push({
      id: `standup-${i}`,
      resourceId: resources[i * 7]!.id,
      title: "Team huddle",
      start: start.toISOString(),
      end: new Date(start.getTime() + 30 * 60_000).toISOString(),
      color: "#a4a4a4",
      recurrence: { freq: "weekly", byWeekday: [1, 3, 5], until: "2027-12-31T00:00:00Z" },
    });
  }
  return { resources, events };
}

export default function Example() {
  const [{ resources, events: initial }] = React.useState(build);
  const [events, setEvents] = React.useState(initial);
  const [log, setLog] = React.useState<string[]>([]);
  return (
    <div className="w-full space-y-2 p-2">
      <ProResourceScheduler
        resources={resources}
        events={events}
        onEventsChange={setEvents}
        onChange={(c) => setLog((l) => [`${c.type}: ${c.event.title}`, ...l].slice(0, 4))}
        defaultView="week"
        defaultTimeZone="Europe/London"
        timeZones={["Europe/London", "Europe/Berlin", "America/New_York", "Asia/Kolkata", "UTC"]}
        newEventTitle="Emergency call-out"
      />
      <p className="text-xs text-crm-muted-fg">
        {events.length.toLocaleString()} bookings across {resources.length.toLocaleString()}{" "}
        engineers
        {log.length ? ` · last: ${log[0]}` : ""}
      </p>
    </div>
  );
}
