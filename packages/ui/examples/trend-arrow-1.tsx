import { TrendArrow } from "@/components/crm/trend-arrow";

export default function Example() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <TrendArrow value={12.4} context="vs last month" />
        <TrendArrow value={-3.1} context="vs last month" />
        <TrendArrow value={0} />
      </div>
      <div className="flex items-center gap-3">
        <TrendArrow value={8} variant="pill" />
        <TrendArrow value={-2.5} variant="pill" inverse context="churn" />
        <TrendArrow value={42} format="number" variant="pill" size="sm" />
      </div>
    </div>
  );
}
