import { ProductUsage, type FeatureUsage } from "@/components/crm/product-usage";

const wk = (start: number, step: number) =>
  Array.from({ length: 12 }, (_, i) =>
    Math.max(0, Math.round(start + step * i + ((i * 7) % 5) - 2)),
  );

const features: FeatureUsage[] = [
  {
    id: "pipeline",
    name: "Pipeline board",
    area: "Sales",
    weekly: { Starter: wk(610, 6), Growth: wk(780, 4), Enterprise: wk(205, 1) },
  },
  {
    id: "sequences",
    name: "Email sequences",
    area: "Engagement",
    weekly: { Starter: wk(120, 3), Growth: wk(410, 8), Enterprise: wk(150, 2) },
  },
  {
    id: "forecast",
    name: "Forecasting",
    area: "Reporting",
    weekly: { Starter: wk(4, 0), Growth: wk(96, 2), Enterprise: wk(162, 1) },
  },
  {
    id: "dialer",
    name: "Power dialer",
    area: "Engagement",
    weekly: { Starter: wk(35, -1), Growth: wk(140, -2), Enterprise: wk(60, 0) },
  },
  {
    id: "ai-notes",
    name: "AI call notes",
    area: "Intelligence",
    launchedAt: "2026-08-28",
    weekly: {
      Starter: [0, 0, 0, 0, 0, 0, 0, 0, 22, 61, 104, 150],
      Growth: [0, 0, 0, 0, 0, 0, 0, 0, 40, 118, 190, 260],
      Enterprise: [0, 0, 0, 0, 0, 0, 0, 0, 9, 30, 52, 71],
    },
  },
  {
    id: "dashboards",
    name: "Custom dashboards",
    area: "Reporting",
    weekly: { Starter: wk(90, 1), Growth: wk(300, 3), Enterprise: wk(180, 1) },
  },
  {
    id: "cpq",
    name: "Quotes & CPQ",
    area: "Sales",
    weekly: { Starter: wk(12, 0), Growth: wk(70, 1), Enterprise: wk(95, 1) },
  },
  {
    id: "api",
    name: "Public API",
    area: "Platform",
    weekly: { Starter: wk(8, 0), Growth: wk(55, 0), Enterprise: wk(170, 2) },
  },
];

export default function Example() {
  return (
    <ProductUsage
      className="w-full max-w-[960px]"
      features={features}
      accountsByPlan={{ Starter: 1_240, Growth: 1_020, Enterprise: 236 }}
      dau={[612, 640, 655, 598, 301, 280, 630, 671, 688, 702, 690, 330, 298, 710]}
      mau={2_310}
      asOf="2026-09-25"
    />
  );
}
