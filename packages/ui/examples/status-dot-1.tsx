import { StatusDot } from "@/components/crm/status-dot";

export default function Example() {
  return (
    <div className="flex flex-col gap-3">
      <StatusDot status="online" showLabel pulse />
      <StatusDot status="away" showLabel />
      <StatusDot status="busy" showLabel label="In a meeting" />
      <StatusDot status="offline" showLabel />
      <div className="flex items-center gap-2">
        <StatusDot status="online" size="sm" />
        <StatusDot status="away" size="md" />
        <StatusDot status="busy" size="lg" />
      </div>
    </div>
  );
}
