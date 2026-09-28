import { NpCampaigns, type Campaign } from "@/components/crm/np-campaigns";

const campaigns: Campaign[] = [
  {
    id: "c1",
    name: "Fall Food Drive 2026",
    fund: "Food Pantry",
    goal: 120000,
    start: "2026-09-01",
    end: "2026-11-30",
    raisedBy: { online: 28400, event: 9100, mail: 6200, peer_to_peer: 4300 },
    donors: 612,
    expenses: 7800,
    matchCap: 25000,
  },
  {
    id: "c2",
    name: "New Shelter Wing",
    fund: "Capital Campaign",
    goal: 2500000,
    start: "2026-01-15",
    end: "2027-06-30",
    raisedBy: { major_gift: 910000, online: 64000, event: 182000 },
    donors: 238,
    expenses: 96000,
  },
  {
    id: "c3",
    name: "Back-to-School Backpacks",
    fund: "Youth Literacy",
    goal: 40000,
    start: "2026-07-01",
    end: "2026-09-15",
    raisedBy: { online: 31200, peer_to_peer: 12650 },
    donors: 904,
    expenses: 3100,
  },
  {
    id: "c4",
    name: "Giving Tuesday 2026",
    fund: "Annual Fund",
    goal: 75000,
    start: "2026-12-01",
    end: "2026-12-02",
    raisedBy: {},
    donors: 0,
    expenses: 2400,
    matchCap: 20000,
  },
  {
    id: "c5",
    name: "Spring 5K Fun Run",
    fund: "Community Programs",
    goal: 60000,
    start: "2026-03-01",
    end: "2026-05-02",
    raisedBy: { event: 21000, peer_to_peer: 26800, online: 3100 },
    donors: 1180,
    expenses: 18200,
  },
];

export default function Example() {
  return (
    <NpCampaigns
      className="w-full max-w-[1100px]"
      campaigns={campaigns}
      now={new Date("2026-09-28")}
    />
  );
}
