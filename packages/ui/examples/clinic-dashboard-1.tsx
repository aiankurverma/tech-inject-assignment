import {
  ClinicDashboard,
  type ClinicDashboardProvider,
  type ClinicVisit,
} from "@/components/crm/clinic-dashboard";

const providers: ClinicDashboardProvider[] = [
  { id: "chu", name: "Dr. Alan Chu", specialty: "Internal medicine", capacityMinPerDay: 420 },
  { id: "shah", name: "Dr. Priya Shah", specialty: "Pediatrics", capacityMinPerDay: 360 },
  { id: "diaz", name: "Kim Diaz, NP", specialty: "Urgent care", capacityMinPerDay: 480 },
];

// Deterministic 28 days of visits ending 2026-09-28.
const statuses: ClinicVisit["status"][] = [
  "completed",
  "completed",
  "completed",
  "completed",
  "no-show",
  "completed",
  "canceled",
  "completed",
];
const visits: ClinicVisit[] = [];
for (let d = 0; d < 28; d++) {
  const date = new Date(2026, 8, 28 - d);
  if (date.getDay() === 0) continue;
  for (let i = 0; i < 18; i++) {
    const provider = providers[i % 3]!;
    const hour = 8 + ((i * 7 + d) % 10);
    const status = statuses[(i + d) % statuses.length]!;
    const charges = 9500 + ((i * 1300 + d * 700) % 16000);
    visits.push({
      id: `v${d}-${i}`,
      providerId: provider.id,
      start: new Date(2026, 8, 28 - d, hour, (i % 4) * 15).toISOString(),
      durationMin: [15, 20, 30, 45][i % 4]!,
      status,
      waitMin: status === "completed" ? 6 + ((i * 5 + d * 3) % 22) - (d < 7 ? 3 : 0) : undefined,
      chargesCents: status === "completed" ? charges : undefined,
      collectedCents:
        status === "completed" ? Math.round(charges * (0.72 + ((i + d) % 5) * 0.05)) : undefined,
    });
  }
}

export default function Example() {
  return (
    <ClinicDashboard
      className="w-[1040px]"
      providers={providers}
      visits={visits}
      now={new Date("2026-09-28T11:15:00")}
      tasks={[
        { id: "t1", kind: "lab", label: "Review A1c — Maria Gonzalez", due: "2026-09-28T10:00:00" },
        {
          id: "t2",
          kind: "prior-auth",
          label: "MRI lumbar — Robert Hayes",
          due: "2026-09-28T15:00:00",
        },
        {
          id: "t3",
          kind: "refill",
          label: "Albuterol inhaler — Aiko Tanaka",
          due: "2026-09-28T12:00:00",
        },
        {
          id: "t4",
          kind: "callback",
          label: "Discuss imaging — Chris Novak",
          due: "2026-09-28T16:30:00",
        },
      ]}
    />
  );
}
