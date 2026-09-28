import { SaasDashboard, type SaasDashboardPeriod } from "@/components/crm/saas-dashboard";

const periods: Record<string, SaasDashboardPeriod> = {
  sep: {
    label: "Sep 2026",
    startingMrr: 412000,
    startingCustomers: 318,
    salesMarketingSpend: 96000,
    grossMargin: 0.81,
    mrrTrend: [352, 366, 371, 384, 396, 405, 412, 427],
    movements: [
      { account: "Northgate Schools", type: "new", amount: 6200, date: "2026-09-03" },
      { account: "Pioneer Dental Group", type: "new", amount: 3900, date: "2026-09-11" },
      { account: "Veritas Insurance", type: "new", amount: 8800, date: "2026-09-19" },
      { account: "Acme Robotics", type: "expansion", amount: 4100, date: "2026-09-08" },
      { account: "Fernbrook Legal", type: "expansion", amount: 1250, date: "2026-09-15" },
      { account: "Orchard Health", type: "reactivation", amount: 1800, date: "2026-09-22" },
      { account: "Lumen Analytics", type: "contraction", amount: -1400, date: "2026-09-20" },
      { account: "Harbor Coffee", type: "churn", amount: -600, date: "2026-09-05" },
      { account: "Quill & Co", type: "churn", amount: -450, date: "2026-09-27" },
      { account: "Brightpath Tutoring", type: "churn", amount: -2100, date: "2026-09-30" },
    ],
  },
  aug: {
    label: "Aug 2026",
    startingMrr: 405000,
    startingCustomers: 312,
    salesMarketingSpend: 91000,
    grossMargin: 0.8,
    mrrTrend: [340, 352, 366, 371, 384, 396, 405, 412],
    movements: [
      { account: "Kestrel Aviation", type: "new", amount: 5400, date: "2026-08-06" },
      { account: "Summit Credit Union", type: "new", amount: 4700, date: "2026-08-21" },
      { account: "Meridian Freight", type: "expansion", amount: 2300, date: "2026-08-14" },
      { account: "Tidepool Studios", type: "contraction", amount: -200, date: "2026-08-09" },
      { account: "Old Mill Bakery", type: "churn", amount: -1900, date: "2026-08-28" },
      { account: "Clearwater Realty", type: "churn", amount: -3300, date: "2026-08-31" },
    ],
  },
};

export default function Example() {
  return <SaasDashboard className="w-[1100px]" periods={periods} />;
}
