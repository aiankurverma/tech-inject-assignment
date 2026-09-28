import { Avatar } from "@/components/crm/avatar";
import { BookingPage } from "@/components/crm/booking-page";

const now = new Date("2026-09-28T08:00:00Z");

/** Weekday slots 15:00–21:00 UTC every 30 min for the next 3 weeks, minus a few booked ones. */
function buildSlots() {
  const taken = new Set([
    "2026-09-29T16:00:00.000Z",
    "2026-09-30T15:30:00.000Z",
    "2026-10-01T19:00:00.000Z",
  ]);
  const out: string[] = [];
  for (let d = 0; d < 21; d++) {
    const day = new Date(Date.UTC(2026, 8, 28 + d));
    const wd = day.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    for (let m = 15 * 60; m < 21 * 60; m += 30) {
      const iso = new Date(day.getTime() + m * 60_000).toISOString();
      if (!taken.has(iso)) out.push(iso);
    }
  }
  return out;
}

export default function Example() {
  return (
    <div className="w-full max-w-4xl">
      <BookingPage
        now={now}
        defaultTimeZone="America/New_York"
        host={{
          name: "Priya Raman",
          title: "Account Executive, Mid-market",
          avatar: <Avatar name="Priya Raman" size="md" />,
        }}
        eventTypes={[
          {
            id: "intro",
            name: "Intro call",
            minutes: 20,
            location: "Google Meet",
            description: "Quick fit check and pricing overview.",
          },
          {
            id: "demo",
            name: "Product demo",
            minutes: 45,
            location: "Zoom",
            description: "Tailored walkthrough for your sales process. Bring your team.",
          },
        ]}
        slots={buildSlots()}
        onBook={async (d) => {
          await new Promise((r) => setTimeout(r, 800));
          console.log("booked", d);
        }}
      />
    </div>
  );
}
