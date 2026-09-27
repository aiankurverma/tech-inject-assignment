import { ProgressRow } from "@/components/crm/segmented-meter";

export default function Example() {
  return (
    <div className="flex w-[440px] flex-col gap-4">
      <ProgressRow label="Discovery" value={31} tone="danger" />
      <ProgressRow label="Evaluation" value={53} tone="warning" />
      <ProgressRow label="Procurement" value={31} tone="success" />
    </div>
  );
}
