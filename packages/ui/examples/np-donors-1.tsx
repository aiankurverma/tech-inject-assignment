import { NpDonors, type Donor } from "@/components/crm/np-donors";

const monthly = (from: string, count: number, amount: number, fund: string) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date(`${from}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + i);
    return { date: d.toISOString().slice(0, 10), amount, fund, recurring: true };
  });

const donors: Donor[] = [
  {
    id: "d1",
    name: "Eleanor Whitaker",
    email: "eleanor@whitakerfamily.org",
    receiptSent: true,
    gifts: [
      { date: "2024-12-18", amount: 5000, fund: "Annual Fund" },
      { date: "2025-06-02", amount: 2500, fund: "Scholarship Endowment" },
      { date: "2026-03-14", amount: 7500, fund: "Capital: New Shelter Wing" },
    ],
  },
  {
    id: "d2",
    name: "Rahul Mehta",
    email: "rahul.mehta@gmail.com",
    gifts: monthly("2025-10-05", 12, 50, "Food Pantry"),
  },
  {
    id: "d3",
    name: "Grace & Samuel Okafor",
    email: "okafor.family@outlook.com",
    gifts: [
      { date: "2024-11-29", amount: 250, fund: "Giving Tuesday" },
      { date: "2025-11-28", amount: 300, fund: "Giving Tuesday" },
    ],
  },
  {
    id: "d4",
    name: "Brightside Credit Union",
    email: "community@brightsidecu.com",
    receiptSent: true,
    gifts: [
      { date: "2025-04-10", amount: 15000, fund: "Youth Literacy" },
      { date: "2026-04-12", amount: 15000, fund: "Youth Literacy" },
    ],
  },
  {
    id: "d5",
    name: "Tomás Rivera",
    email: "trivera@proton.me",
    gifts: [{ date: "2026-08-22", amount: 100, fund: "Annual Fund" }],
  },
  {
    id: "d6",
    name: "Margaret Lindqvist",
    email: "m.lindqvist@yahoo.com",
    gifts: [
      { date: "2022-12-20", amount: 1000, fund: "Annual Fund" },
      { date: "2023-12-19", amount: 1200, fund: "Annual Fund" },
      { date: "2024-12-22", amount: 1500, fund: "Annual Fund" },
    ],
  },
  {
    id: "d7",
    name: "Jae-won Park",
    email: "jaewon.park@icloud.com",
    gifts: [
      { date: "2025-05-03", amount: 75, fund: "Spring 5K" },
      { date: "2026-05-02", amount: 120, fund: "Spring 5K" },
    ],
  },
];

export default function Example() {
  return (
    <NpDonors className="w-full max-w-[1100px]" donors={donors} now={new Date("2026-09-28")} />
  );
}
