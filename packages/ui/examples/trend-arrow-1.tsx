import { TrendArrow } from "@/components/crm/trend-arrow";

const kpis = [
  { label: "Revenue", value: "$412k", delta: 12.4 },
  { label: "Pipeline", value: "$1.8M", delta: -3.1 },
  { label: "Win rate", value: "27%", delta: 0 },
];
const health = [
  { label: "New accounts", delta: 8, inverse: false, hint: "higher is better" },
  { label: "Churn", delta: -2.5, inverse: true, hint: "lower is better" },
  { label: "Open tickets", delta: 42, inverse: true, hint: "lower is better" },
];

export default function Example() {
  return (
    <div className="flex w-full max-w-lg flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-4 font-crm text-crm-fg">
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="min-w-0 rounded-crm border border-crm-border p-3">
            <p className="truncate text-xs text-crm-soft">{k.label}</p>
            <p className="mt-1 text-lg font-medium tabular-nums">{k.value}</p>
            <TrendArrow value={k.delta} context="vs last month" />
          </div>
        ))}
      </div>
      <ul className="divide-y divide-crm-border border-t border-crm-border">
        {health.map((h) => (
          <li key={h.label} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate">
              {h.label} <span className="text-xs text-crm-soft">({h.hint})</span>
            </span>
            <TrendArrow
              value={h.delta}
              inverse={h.inverse}
              format={h.label === "Open tickets" ? "number" : "percent"}
              variant="pill"
              context={`${h.label} vs last month`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
