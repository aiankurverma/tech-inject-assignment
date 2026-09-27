import { SegmentedMeter } from "@/components/crm/segmented-meter";

export default function Example() {
  return (
    <div className="flex w-56 flex-col gap-3">
      {[82, 51, 24].map((v) => (
        <SegmentedMeter key={v} value={v} showValue label="Win probability" />
      ))}
    </div>
  );
}
