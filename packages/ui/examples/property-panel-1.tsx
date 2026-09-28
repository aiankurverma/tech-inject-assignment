import * as React from "react";
import { Building2, Calendar, DollarSign, Mail, User } from "lucide-react";
import { PropertyPanel, type PropertySection } from "@/components/crm/property-panel";

export default function Example() {
  const [values, setValues] = React.useState<Record<string, string>>({
    owner: "Priya Shah",
    email: "priya@acme.io",
    company: "Acme Robotics",
    amount: "48000",
    stage: "proposal",
    close: "2026-11-14",
    created: "Sep 2, 2026",
  });
  const sections: PropertySection[] = [
    {
      id: "contact",
      title: "Contact",
      fields: [
        { key: "owner", label: "Owner", value: values.owner!, icon: <User /> },
        {
          key: "email",
          label: "Email",
          type: "email",
          value: values.email!,
          icon: <Mail />,
          validate: (v) => (/^\S+@\S+\.\S+$/.test(v) ? undefined : "Enter a valid email"),
        },
        { key: "company", label: "Company", value: values.company!, icon: <Building2 /> },
      ],
    },
    {
      id: "deal",
      title: "Deal",
      fields: [
        {
          key: "amount",
          label: "Amount",
          type: "number",
          value: values.amount!,
          icon: <DollarSign />,
          render: (v) => `$${Number(v).toLocaleString()}`,
        },
        {
          key: "stage",
          label: "Stage",
          type: "select",
          value: values.stage!,
          options: [
            { value: "qualified", label: "Qualified" },
            { value: "proposal", label: "Proposal" },
            { value: "won", label: "Closed won" },
          ],
        },
        { key: "close", label: "Close date", value: values.close!, icon: <Calendar /> },
        { key: "created", label: "Created", value: values.created!, readOnly: true },
      ],
    },
  ];
  return (
    <PropertyPanel
      className="max-w-sm"
      header={<p className="text-sm font-medium">Acme Robotics renewal</p>}
      sections={sections}
      onFieldChange={(key, value) => setValues((s) => ({ ...s, [key]: value }))}
    />
  );
}
