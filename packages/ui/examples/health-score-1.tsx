import { HealthScore } from "@/components/crm/health-score";

export default function Example() {
  return (
    <div className="max-w-sm rounded-crm border border-crm-border bg-crm-card p-4">
      <HealthScore
        label="Northwind Logistics health"
        previousScore={71}
        signals={[
          {
            key: "usage",
            label: "Product usage",
            score: 58,
            weight: 3,
            detail: "42 of 72 seats active in 30 days",
          },
          {
            key: "support",
            label: "Support sentiment",
            score: 81,
            weight: 2,
            detail: "CSAT 4.4 · 2 open tickets",
          },
          { key: "nps", label: "NPS", score: 64, weight: 1, detail: "Last survey +18" },
          {
            key: "billing",
            label: "Billing",
            score: 35,
            weight: 2,
            detail: "Invoice INV-2291 is 31 days overdue",
          },
          { key: "exec", label: "Executive engagement", score: 70, detail: "QBR held Aug 14" },
        ]}
      />
    </div>
  );
}
