import { RadioGroup } from "@/components/crm/radio-group";

export default function Example() {
  return (
    <div className="flex w-[380px] flex-col gap-6">
      <RadioGroup
        label="Lead routing"
        defaultValue="round-robin"
        options={[
          { value: "round-robin", label: "Round robin", description: "Rotate evenly across reps." },
          { value: "territory", label: "By territory", description: "Match on account region." },
          { value: "manual", label: "Manual", description: "Leads wait in the inbox." },
        ]}
      />
      <RadioGroup
        label="Billing cycle"
        variant="cards"
        orientation="horizontal"
        defaultValue="yearly"
        options={[
          { value: "monthly", label: "Monthly", description: "$29 / seat" },
          { value: "yearly", label: "Yearly", description: "$24 / seat" },
          { value: "custom", label: "Custom", description: "Contact sales", disabled: true },
        ]}
      />
    </div>
  );
}
