import * as React from "react";
import { AutomationBuilder, type Automation } from "@/components/crm/automation-builder";

const reps = [
  { value: "maya", label: "Maya Chen" },
  { value: "omar", label: "Omar Haddad" },
  { value: "priya", label: "Priya Nair" },
];

export default function Example() {
  const [value, setValue] = React.useState<Automation>({
    name: "Stalled enterprise deal nudge",
    enabled: true,
    trigger: "stage_idle",
    steps: [
      { id: "s1", kind: "condition", field: "amount", operator: "gt", value: "50000" },
      { id: "s2", kind: "action", action: "task", target: "Call champion to confirm timeline" },
      { id: "s3", kind: "delay", amount: 3, unit: "days" },
      { id: "s4", kind: "condition", field: "stage", operator: "is", value: "Proposal" },
      { id: "s5", kind: "action", action: "notify", target: "priya" },
    ],
  });
  const [saving, setSaving] = React.useState(false);
  return (
    <AutomationBuilder
      className="max-w-2xl"
      value={value}
      onChange={setValue}
      saving={saving}
      onSave={() => {
        setSaving(true);
        setTimeout(() => setSaving(false), 800);
      }}
      triggers={[
        { value: "deal_created", label: "Deal is created" },
        { value: "stage_changed", label: "Deal stage changes" },
        { value: "stage_idle", label: "Deal idle in stage for 14 days" },
        { value: "form_submitted", label: "Web form is submitted" },
      ]}
      fields={[
        { value: "amount", label: "Amount" },
        { value: "stage", label: "Stage" },
        { value: "region", label: "Region" },
        { value: "owner", label: "Owner" },
      ]}
      actions={[
        { value: "email", label: "Send email", targetLabel: "Template name" },
        { value: "task", label: "Create task", targetLabel: "Task title" },
        { value: "assign", label: "Assign owner", targetLabel: "Owner", targetOptions: reps },
        { value: "notify", label: "Notify manager", targetLabel: "Manager", targetOptions: reps },
        { value: "webhook", label: "Call webhook", targetLabel: "https://hooks.example.com/..." },
      ]}
    />
  );
}
