import { FsDashboard, type ServiceVisit } from "@/components/crm/fs-dashboard";

const techs = ["Rosa Delgado", "Kwame Mensah", "Liam O'Connor", "Mei Chen", "Samir Haddad"];
const regions = ["North", "Downtown", "South"];
const types = ["HVAC", "Plumbing", "Refrigeration", "Electrical", "Maintenance"];

// Deterministic sample: 60 visits over the last 5 days.
function buildVisits(): ServiceVisit[] {
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const now = Date.UTC(2026, 8, 28, 15);
  return Array.from({ length: 60 }, (_, i) => {
    const created = now - rnd() * 5 * 86_400_000;
    const response = (0.5 + rnd() * 30) * 3_600_000;
    const arrived = created + response < now ? created + response : undefined;
    const completed = arrived && rnd() > 0.25 ? arrived + 90 * 60_000 : undefined;
    const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)] as T;
    return {
      id: `WO-${2200 + i}`,
      region: pick(regions),
      technician: pick(techs),
      jobType: pick(types),
      createdAt: new Date(created).toISOString(),
      arrivedAt: arrived ? new Date(arrived).toISOString() : undefined,
      completedAt: completed ? new Date(completed).toISOString() : undefined,
      slaHours: pick([4, 24, 24, 72]),
      returnVisit: completed ? rnd() < 0.18 : undefined,
      revenue: completed ? Math.round(180 + rnd() * 900) : 0,
    };
  });
}

const visits = buildVisits();

export default function Example() {
  return (
    <FsDashboard
      className="w-full max-w-[1080px]"
      visits={visits}
      now={new Date("2026-09-28T15:00:00Z")}
    />
  );
}
