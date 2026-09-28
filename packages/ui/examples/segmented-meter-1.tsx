import { SegmentedMeter } from "@/components/crm/segmented-meter";

const deals = [
  { name: "Acme Corp · Q4 renewal", value: 82 },
  { name: "Globex · Platform expansion", value: 51 },
  { name: "Initech · New logo", value: 24 },
];

export default function Example() {
  return (
    <div className="flex w-80 flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-4">
      <span className="text-xs font-medium text-crm-soft">Win probability</span>
      {deals.map((d) => (
        <div key={d.name} className="flex flex-col gap-1.5">
          <span className="truncate text-sm text-crm-fg">{d.name}</span>
          <SegmentedMeter value={d.value} showValue label={`${d.name} win probability`} />
        </div>
      ))}
    </div>
  );
}
