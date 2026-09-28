import { RevenueDashboard } from "@/components/crm/revenue-dashboard";

export default function Example() {
  return (
    <RevenueDashboard
      className="w-[1040px]"
      startingMrr={412000}
      movements={[
        {
          month: "2025-10",
          newMrr: 18400,
          expansion: 9200,
          contraction: 2100,
          churn: 6400,
          customers: 612,
        },
        {
          month: "2025-11",
          newMrr: 21100,
          expansion: 7800,
          contraction: 3300,
          churn: 5100,
          customers: 628,
        },
        {
          month: "2025-12",
          newMrr: 15600,
          expansion: 12400,
          contraction: 1800,
          churn: 9800,
          customers: 631,
        },
        {
          month: "2026-01",
          newMrr: 24800,
          expansion: 10100,
          contraction: 2600,
          churn: 4700,
          customers: 655,
        },
        {
          month: "2026-02",
          newMrr: 22300,
          expansion: 8900,
          contraction: 4100,
          churn: 6200,
          customers: 668,
        },
        {
          month: "2026-03",
          newMrr: 27500,
          expansion: 14300,
          contraction: 2200,
          churn: 5300,
          customers: 690,
        },
        {
          month: "2026-04",
          newMrr: 25900,
          expansion: 11600,
          contraction: 3800,
          churn: 7900,
          customers: 702,
        },
        {
          month: "2026-05",
          newMrr: 29100,
          expansion: 13200,
          contraction: 2900,
          churn: 4400,
          customers: 724,
        },
        {
          month: "2026-06",
          newMrr: 31400,
          expansion: 15800,
          contraction: 3500,
          churn: 6100,
          customers: 745,
        },
        {
          month: "2026-07",
          newMrr: 26700,
          expansion: 12900,
          contraction: 5200,
          churn: 11200,
          customers: 749,
        },
        {
          month: "2026-08",
          newMrr: 33800,
          expansion: 16700,
          contraction: 2700,
          churn: 5800,
          customers: 772,
        },
        {
          month: "2026-09",
          newMrr: 35200,
          expansion: 18100,
          contraction: 3100,
          churn: 6600,
          customers: 794,
        },
      ]}
    />
  );
}
