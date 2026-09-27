import { CountBadge, StatusBadge } from "@/components/crm/badge";

export default function Example() {
  return (
    <div className="flex items-center gap-4">
      <CountBadge>241</CountBadge>
      <CountBadge>9</CountBadge>
      <StatusBadge>Active</StatusBadge>
      <StatusBadge status="warning">At risk</StatusBadge>
      <StatusBadge status="danger">Churned</StatusBadge>
      <StatusBadge status="neutral">Paused</StatusBadge>
    </div>
  );
}
