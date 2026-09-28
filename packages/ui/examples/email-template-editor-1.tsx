import { EmailTemplateEditor } from "@/components/crm/email-template-editor";

export default function Example() {
  return (
    <EmailTemplateEditor
      className="w-full max-w-[1100px]"
      mergeFields={[
        { key: "first_name", label: "First name", sample: "Jordan", fallback: "there" },
        { key: "company", label: "Company", sample: "Northwind Traders" },
        { key: "owner_name", label: "Owner", sample: "Maya Chen" },
        { key: "renewal_date", label: "Renewal date", sample: "Nov 14, 2026" },
        { key: "seats", label: "Seats", sample: "48" },
      ]}
      defaultValue={{
        name: "Renewal reminder — 45 days",
        subject: "{{first_name}}, your {{company}} plan renews on {{renewal_date}}",
        preheader: "A quick look at your team's usage and what's new",
        blocks: [
          { id: "b1", type: "heading", text: "Your renewal is coming up" },
          {
            id: "b2",
            type: "text",
            text: "Hi {{first_name}},\n\nYour {{seats}}-seat plan for {{company}} renews on {{renewal_date}}. Your team logged 1,240 activities last month, up 18%.",
          },
          {
            id: "b3",
            type: "button",
            label: "Review my plan",
            url: "https://app.example.com/billing",
          },
          { id: "b4", type: "divider" },
          {
            id: "b5",
            type: "text",
            text: "Questions? Just reply. {{owner_name}} reads every message.",
          },
        ],
      }}
      onSave={() => new Promise((resolve) => setTimeout(resolve, 600))}
    />
  );
}
