import { ActivityDashboard, type ActivityRecord } from "@/components/crm/activity-dashboard";

const reps = [
  { id: "a", name: "Sofia Mendes", weeklyTarget: { call: 60, email: 120, meeting: 8 } },
  { id: "b", name: "Tom Becker", weeklyTarget: { call: 60, email: 120, meeting: 8 } },
  { id: "c", name: "Aisha Khan", weeklyTarget: { call: 45, email: 150, meeting: 10 } },
  { id: "d", name: "Ravi Patel", weeklyTarget: { call: 40, email: 100, meeting: 6 } },
];

// Deterministic 60 days of activity so the current and prior periods both have data.
const records: ActivityRecord[] = [];
const base = Date.UTC(2026, 8, 25);
for (let i = 0; i < 60; i++) {
  const d = new Date(base - i * 86_400_000);
  const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
  const date = d.toISOString().slice(0, 10);
  reps.forEach((r, k) => {
    const f = weekend ? 0.1 : 1 + ((i * 7 + k * 3) % 5) / 10 - (i > 30 ? 0.15 : 0);
    records.push({ date, repId: r.id, type: "call", count: Math.round((10 - k * 1.5) * f) });
    records.push({ date, repId: r.id, type: "email", count: Math.round((22 + k * 3) * f) });
    records.push({ date, repId: r.id, type: "meeting", count: Math.round((1.5 + (k % 2)) * f) });
  });
}

export default function Example() {
  return (
    <ActivityDashboard
      className="w-full max-w-[960px]"
      records={records}
      reps={reps}
      asOf="2026-09-25"
    />
  );
}
