import { SaasRenewals, type SaasRenewal } from "@/components/crm/saas-renewals";

const renewals: SaasRenewal[] = [
  {
    id: "r1",
    account: "Lumen Analytics",
    owner: "Sam Patel",
    renewalDate: "2026-09-20",
    currentArr: 42000,
    upliftPct: -10,
    forecast: "at-risk",
    note: "Champion left in August; exec sponsor meeting booked.",
  },
  {
    id: "r2",
    account: "Acme Robotics",
    owner: "Nora Diaz",
    renewalDate: "2026-10-15",
    currentArr: 186000,
    upliftPct: 7,
    forecast: "commit",
    autoRenew: true,
    noticeDays: 30,
  },
  {
    id: "r3",
    account: "Fernbrook Legal",
    owner: "Nora Diaz",
    renewalDate: "2026-11-02",
    currentArr: 28800,
    upliftPct: 12,
    forecast: "likely",
    note: "Adding 15 seats for litigation team.",
  },
  {
    id: "r4",
    account: "Quill & Co",
    owner: "Ivan Rossi",
    renewalDate: "2026-11-18",
    currentArr: 5400,
    upliftPct: 0,
    forecast: "churning",
    note: "Moving to in-house tool.",
  },
  {
    id: "r5",
    account: "Meridian Freight",
    owner: "Sam Patel",
    renewalDate: "2026-12-20",
    currentArr: 124000,
    upliftPct: 5,
    forecast: "likely",
    autoRenew: true,
    noticeDays: 60,
  },
  {
    id: "r6",
    account: "Northgate Schools",
    owner: "Ivan Rossi",
    renewalDate: "2027-02-28",
    currentArr: 36000,
    upliftPct: 4,
    forecast: "commit",
  },
];

export default function Example() {
  return <SaasRenewals className="w-[1040px]" renewals={renewals} today={new Date(2026, 8, 28)} />;
}
