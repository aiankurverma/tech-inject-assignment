import { ReAgentDashboard, type ReTransaction } from "@/components/crm/re-agent-dashboard";

const transactions: ReTransaction[] = [
  {
    id: "t1",
    address: "77 Willamette Ct",
    side: "listing",
    price: 892000,
    rate: 0.025,
    status: "closed",
    closeDate: "2026-07-19",
    daysToContract: 12,
  },
  {
    id: "t2",
    address: "310 NW 23rd Ave",
    side: "listing",
    price: 1310000,
    rate: 0.025,
    status: "closed",
    closeDate: "2026-07-02",
    daysToContract: 34,
  },
  {
    id: "t3",
    address: "14 Oak Knoll Rd",
    side: "buyer",
    price: 574000,
    rate: 0.025,
    status: "closed",
    closeDate: "2026-03-11",
    daysToContract: 21,
  },
  {
    id: "t4",
    address: "208 Burnside #12",
    side: "buyer",
    price: 389000,
    rate: 0.0275,
    status: "closed",
    closeDate: "2026-09-08",
    daysToContract: 9,
  },
  {
    id: "t5",
    address: "61 Mt Tabor Pl",
    side: "listing",
    price: 745000,
    rate: 0.03,
    status: "closed",
    closeDate: "2026-09-22",
    daysToContract: 6,
  },
  {
    id: "t6",
    address: "9031 SE Division St",
    side: "buyer",
    price: 525000,
    rate: 0.025,
    status: "pending",
    closeDate: "2026-10-12",
    daysToContract: 18,
  },
  {
    id: "t7",
    address: "1377 Hawthorne Blvd",
    side: "listing",
    price: 1195000,
    rate: 0.025,
    status: "pending",
    closeDate: "2026-10-03",
    daysToContract: 88,
  },
];

export default function Example() {
  return (
    <ReAgentDashboard
      className="w-full max-w-[1100px]"
      agent="Dana Brooks"
      transactions={transactions}
      gciGoal={180000}
      split={0.7}
      cap={18000}
      now={new Date(2026, 8, 28)}
    />
  );
}
