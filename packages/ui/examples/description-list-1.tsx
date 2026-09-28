import { Building2, Mail, Phone, User } from "lucide-react";
import { DescriptionList } from "@/components/crm/description-list";
import { Tag } from "@/components/crm/tag";

export default function Example() {
  return (
    <div className="max-w-2xl rounded-xl border border-crm-border bg-crm-card p-5">
      <DescriptionList
        columns={2}
        items={[
          { label: "Owner", value: "Priya Shah", icon: <User /> },
          { label: "Company", value: "Acme Robotics", icon: <Building2 /> },
          {
            label: "Email",
            value: "priya@acme.io",
            copyValue: "priya@acme.io",
            icon: <Mail />,
          },
          { label: "Phone", value: "", icon: <Phone /> },
          { label: "Stage", value: <Tag color="purple">Negotiation</Tag> },
          { label: "Amount", value: "$48,000" },
          {
            label: "Notes",
            value: "Wants a 2-year term with quarterly billing.",
            fullWidth: true,
          },
        ]}
      />
    </div>
  );
}
