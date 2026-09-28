import { Progress, ProgressRing } from "@/components/crm/progress";

export default function Example() {
  return (
    <div className="flex w-[380px] flex-col gap-5">
      <Progress label="Q3 quota" value={72} showValue />
      <Progress label="Import contacts" value={34} tone="warning" showValue size="sm" />
      <Progress label="Syncing mailbox" />
      <div className="flex gap-4">
        <ProgressRing label="Quota attainment" value={86} tone="success" />
        <ProgressRing label="Onboarding" value={40} />
        <ProgressRing label="Churn risk" value={18} tone="danger" size={48} />
      </div>
    </div>
  );
}
