import { NpDashboard, type Gift } from "@/components/crm/np-dashboard";

const funds = ["Annual Fund", "Food Pantry", "Youth Literacy", "Capital: New Shelter Wing"];

// Deterministic sample: ~3 fiscal years of gifts from 400 donors with seasonal December peaks.
function buildGifts(): Gift[] {
  let seed = 23;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const out: Gift[] = [];
  const start = Date.UTC(2024, 6, 1);
  const end = Date.UTC(2026, 8, 28);
  for (let t = start; t <= end; t += 86_400_000) {
    const month = new Date(t).getUTCMonth();
    const perDay = Math.floor(rnd() * (month === 11 ? 14 : 5));
    for (let i = 0; i < perDay; i++) {
      const big = rnd() < 0.03;
      out.push({
        donorId: `d${Math.floor(rnd() * 400)}`,
        date: new Date(t).toISOString().slice(0, 10),
        amount: big ? 2500 + Math.round(rnd() * 20000) : 25 + Math.round(rnd() * 275),
        fund: funds[Math.floor(rnd() * funds.length)] ?? "Annual Fund",
        recurring: rnd() < 0.2,
      });
    }
  }
  return out;
}

const gifts = buildGifts();

export default function Example() {
  return (
    <NpDashboard
      className="w-full max-w-[1100px]"
      gifts={gifts}
      goal={1_500_000}
      fiscalStartMonth={7}
      now={new Date("2026-09-28")}
    />
  );
}
