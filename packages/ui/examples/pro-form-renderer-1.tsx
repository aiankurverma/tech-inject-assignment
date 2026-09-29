import * as React from "react";
import { ProFormRenderer, type FormSchema } from "@/components/crm/pro-form-renderer";

const demoRequest: FormSchema = {
  id: "form_demo_request",
  version: 1,
  title: "Book a platform demo",
  description: "Tell us about your team and we will tailor the walkthrough.",
  settings: {
    submitLabel: "Request demo",
    showProgress: true,
    successMessage: "Thanks! An account executive will reach out within one business day.",
  },
  pages: [
    {
      id: "pg_contact",
      title: "Contact",
      fields: [
        {
          id: "f1",
          type: "text",
          name: "first_name",
          label: "First name",
          required: true,
          width: "half",
        },
        {
          id: "f2",
          type: "text",
          name: "last_name",
          label: "Last name",
          required: true,
          width: "half",
        },
        {
          id: "f3",
          type: "email",
          name: "work_email",
          label: "Work email",
          required: true,
          helpText: "Personal inboxes (gmail, yahoo…) are rejected by a server check.",
          asyncValidator: "businessEmail",
        },
        {
          id: "f4",
          type: "phone",
          name: "phone",
          label: "Phone",
          placeholder: "+1 415 555 0134",
          width: "half",
        },
        {
          id: "f5",
          type: "select",
          name: "role",
          label: "Your role",
          required: true,
          width: "half",
          options: [
            { label: "Sales leader", value: "sales_leader" },
            { label: "RevOps / Sales Ops", value: "revops" },
            { label: "Marketing", value: "marketing" },
            { label: "Customer success", value: "cs" },
            { label: "Founder / Exec", value: "exec" },
          ],
        },
      ],
    },
    {
      id: "pg_company",
      title: "Company",
      fields: [
        { id: "f6", type: "text", name: "company", label: "Company name", required: true },
        {
          id: "f7",
          type: "url",
          name: "website",
          label: "Website",
          placeholder: "https://",
          width: "half",
        },
        {
          id: "f8",
          type: "number",
          name: "seats",
          label: "Sales seats",
          required: true,
          width: "half",
          validation: { min: 1, max: 5000 },
        },
        {
          id: "f9",
          type: "radio",
          name: "current_crm",
          label: "Current CRM",
          required: true,
          options: [
            { label: "Salesforce", value: "salesforce" },
            { label: "HubSpot", value: "hubspot" },
            { label: "Pipedrive", value: "pipedrive" },
            { label: "Spreadsheets", value: "sheets" },
            { label: "Other", value: "other" },
          ],
        },
        {
          id: "f10",
          type: "text",
          name: "current_crm_other",
          label: "Which CRM?",
          required: true,
          logic: {
            combinator: "and",
            rules: [{ field: "current_crm", operator: "=", value: "other" }],
          },
        },
        {
          id: "f11",
          type: "checkbox",
          name: "migration_objects",
          label: "What would you migrate?",
          helpText: "Shown because you are moving off an existing CRM.",
          logic: {
            combinator: "and",
            rules: [
              { field: "current_crm", operator: "in", value: "salesforce,hubspot,pipedrive" },
            ],
          },
          options: [
            { label: "Accounts & contacts", value: "contacts" },
            { label: "Open deals", value: "deals" },
            { label: "Activity history", value: "activities" },
            { label: "Custom objects", value: "custom" },
          ],
        },
      ],
    },
    {
      id: "pg_enterprise",
      title: "Enterprise needs",
      description: "Only shown for teams of 200+ seats.",
      logic: { combinator: "and", rules: [{ field: "seats", operator: ">=", value: "200" }] },
      fields: [
        {
          id: "f12",
          type: "multiselect",
          name: "compliance",
          label: "Compliance requirements",
          options: [
            { label: "SOC 2 Type II", value: "soc2" },
            { label: "ISO 27001", value: "iso27001" },
            { label: "HIPAA", value: "hipaa" },
            { label: "GDPR DPA", value: "gdpr" },
            { label: "SSO / SCIM", value: "sso" },
            { label: "Data residency (EU)", value: "eu_residency" },
          ],
          validation: { minItems: 1 },
          required: true,
        },
        {
          id: "f13",
          type: "file",
          name: "security_questionnaire",
          label: "Security questionnaire",
          helpText: "Attach your vendor assessment and we will return it completed.",
          file: { accept: ["application/pdf", ".xlsx", ".docx"], maxSizeMb: 15, maxFiles: 2 },
        },
      ],
    },
    {
      id: "pg_goals",
      title: "Goals",
      fields: [
        {
          id: "f14",
          type: "textarea",
          name: "goals",
          label: "What should the demo cover?",
          required: true,
          validation: { minLength: 20, maxLength: 1200 },
          placeholder: "e.g. forecasting accuracy, pipeline hygiene, rep ramp time…",
        },
        {
          id: "f15",
          type: "rating",
          name: "urgency",
          label: "How urgent is this project?",
          validation: { max: 5 },
        },
        { id: "f16", type: "date", name: "target_date", label: "Target go-live", width: "half" },
        {
          id: "f17",
          type: "consent",
          name: "consent",
          label: "I agree to be contacted about this request and accept the privacy policy.",
          required: true,
        },
      ],
    },
  ],
};

const FREE_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "proton.me",
];

export default function Example() {
  const [log, setLog] = React.useState<string[]>([]);
  const push = (line: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${line}`, ...l].slice(0, 6));

  return (
    <div className="grid gap-4 bg-crm-bg p-6 font-crm lg:grid-cols-[minmax(0,1fr)_280px]">
      <ProFormRenderer
        schema={demoRequest}
        initialValues={{ first_name: "Priya", company: "Northwind Logistics" }}
        asyncValidators={{
          businessEmail: async (value) => {
            await new Promise((r) => setTimeout(r, 350));
            const domain = String(value).split("@")[1]?.toLowerCase();
            return domain && FREE_DOMAINS.includes(domain)
              ? "Please use your company email address"
              : null;
          },
        }}
        onSavePartial={async (partial) => {
          await new Promise((r) => setTimeout(r, 200));
          push(
            `draft saved · step ${partial.step + 1} · ${Object.keys(partial.values).length} keys`,
          );
        }}
        onStepChange={(step, pageId) => push(`step ${step + 1} (${pageId})`)}
        onSubmit={async (values, meta) => {
          await new Promise((r) => setTimeout(r, 600));
          push(
            `submitted ${Object.keys(values).length} answers, hidden: ${meta.hiddenFields.length}`,
          );
        }}
      />
      <aside className="rounded-crm bg-crm-card p-4 text-xs shadow-crm-raised">
        <p className="mb-2 font-medium text-crm-soft">Event log</p>
        {log.length ? (
          <ul className="flex flex-col gap-1 font-mono text-[11px] text-crm-muted-fg">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        ) : (
          <p className="text-crm-subtle">
            Try "Other" as CRM, 250 seats to unlock the enterprise page, or a gmail address.
          </p>
        )}
      </aside>
    </div>
  );
}
