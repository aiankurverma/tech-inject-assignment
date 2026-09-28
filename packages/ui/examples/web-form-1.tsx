import { WebForm, type WebFormStep } from "@/components/crm/web-form";

const steps: WebFormStep[] = [
  {
    title: "About you",
    fields: [
      { name: "firstName", label: "First name", type: "text", required: true, half: true },
      { name: "lastName", label: "Last name", type: "text", required: true, half: true },
      { name: "email", label: "Work email", type: "email", required: true, workEmail: true },
      { name: "phone", label: "Phone", type: "tel", hint: "Optional — for a faster callback." },
    ],
  },
  {
    title: "Your company",
    description: "Helps us route you to the right specialist.",
    fields: [
      { name: "company", label: "Company", type: "text", required: true, half: true },
      { name: "website", label: "Website", type: "url", placeholder: "https://", half: true },
      {
        name: "size",
        label: "Team size",
        type: "select",
        required: true,
        options: [
          { value: "1-10", label: "1–10" },
          { value: "11-50", label: "11–50" },
          { value: "51-200", label: "51–200" },
          { value: "201+", label: "201+" },
        ],
      },
      {
        name: "seats",
        label: "How many sales seats?",
        type: "number",
        min: 1,
        max: 5000,
        required: true,
        showIf: { field: "size", equals: ["51-200", "201+"] },
      },
      {
        name: "crm",
        label: "Current CRM",
        type: "select",
        options: [
          { value: "none", label: "Spreadsheets / none" },
          { value: "hubspot", label: "HubSpot" },
          { value: "salesforce", label: "Salesforce" },
          { value: "other", label: "Other" },
        ],
      },
      {
        name: "crmOther",
        label: "Which CRM?",
        type: "text",
        required: true,
        showIf: { field: "crm", equals: "other" },
      },
    ],
  },
  {
    title: "Your project",
    fields: [
      {
        name: "goals",
        label: "What are you hoping to fix?",
        type: "textarea",
        maxLength: 600,
        required: true,
      },
      {
        name: "consent",
        label: "I agree to be contacted about this request.",
        type: "checkbox",
        required: true,
      },
    ],
  },
];

export default function Example() {
  return (
    <div className="w-full max-w-xl">
      <WebForm
        title="Talk to sales"
        steps={steps}
        submitLabel="Request a demo"
        hiddenFields={{ utm_source: "google", utm_campaign: "q4-mid-market", page: "/pricing" }}
        consent={<>We process your data per our privacy policy. You can unsubscribe at any time.</>}
        onSubmit={async (values) => {
          await new Promise((r) => setTimeout(r, 900));
          console.log("lead", values);
        }}
      />
    </div>
  );
}
