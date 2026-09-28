import { AgencyDashboard, type AgencyDashboardPeriod } from "@/components/crm/agency-dashboard";

const team = (scale: number) => [
  {
    name: "Priya Shah",
    role: "Strategy lead",
    capacity: 152 * scale,
    billableHours: 128 * scale,
    nonBillableHours: 30 * scale,
  },
  {
    name: "Leo Grant",
    role: "Designer",
    capacity: 152 * scale,
    billableHours: 118 * scale,
    nonBillableHours: 18 * scale,
  },
  {
    name: "Ama Owusu",
    role: "Researcher",
    capacity: 120 * scale,
    billableHours: 64 * scale,
    nonBillableHours: 22 * scale,
  },
  {
    name: "Jin Park",
    role: "Engineer",
    capacity: 152 * scale,
    billableHours: 131 * scale,
    nonBillableHours: 12 * scale,
  },
  {
    name: "Dana Ortiz",
    role: "Account director",
    capacity: 152 * scale,
    billableHours: 76 * scale,
    nonBillableHours: 60 * scale,
  },
];

const periods: Record<string, AgencyDashboardPeriod> = {
  month: {
    label: "September 2026",
    revenue: 94200,
    previousRevenue: 88100,
    deliveryCost: 58400,
    previousDeliveryCost: 56300,
    backlog: 212000,
    revenueTrend: [71, 76, 80, 79, 85, 88, 94],
    team: team(1),
    clients: [
      { client: "Helio Health", revenue: 31200 },
      { client: "Northwind Outfitters", revenue: 24600 },
      { client: "Brightline Fintech", revenue: 16800 },
      { client: "Cedar & Pine Hotels", revenue: 13100 },
      { client: "Kinfolk Coffee Co.", revenue: 8500 },
    ],
  },
  quarter: {
    label: "Q3 2026",
    revenue: 268900,
    previousRevenue: 241500,
    deliveryCost: 171300,
    previousDeliveryCost: 160200,
    backlog: 212000,
    revenueTrend: [210, 225, 231, 244, 252, 261, 269],
    team: team(3),
    clients: [
      { client: "Helio Health", revenue: 76300 },
      { client: "Northwind Outfitters", revenue: 72100 },
      { client: "Brightline Fintech", revenue: 51200 },
      { client: "Cedar & Pine Hotels", revenue: 43800 },
      { client: "Kinfolk Coffee Co.", revenue: 25500 },
    ],
  },
};

export default function Example() {
  return <AgencyDashboard className="w-[1080px]" periods={periods} />;
}
