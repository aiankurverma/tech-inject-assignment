import { SettingsCustomFields, type CustomField } from "@/components/crm/settings-custom-fields";

const fields: Record<string, CustomField[]> = {
  contact: [
    {
      id: "c1",
      label: "LinkedIn profile",
      apiName: "linkedin_profile",
      type: "url",
      required: false,
      fillRate: 0.64,
    },
    {
      id: "c2",
      label: "Persona",
      apiName: "persona",
      type: "select",
      required: true,
      options: ["Economic buyer", "Champion", "End user", "Blocker"],
      fillRate: 0.88,
    },
    {
      id: "c3",
      label: "Newsletter opt-in",
      apiName: "newsletter_opt_in",
      type: "checkbox",
      required: false,
      fillRate: 1,
    },
    {
      id: "c4",
      label: "Fax number",
      apiName: "fax_number",
      type: "text",
      required: false,
      archived: true,
      fillRate: 0.03,
    },
  ],
  company: [
    {
      id: "co1",
      label: "Annual revenue (USD)",
      apiName: "annual_revenue_usd",
      type: "currency",
      required: false,
      fillRate: 0.41,
    },
    {
      id: "co2",
      label: "Employee count",
      apiName: "employee_count",
      type: "number",
      required: false,
      fillRate: 0.72,
    },
    {
      id: "co3",
      label: "Tech stack",
      apiName: "tech_stack",
      type: "multiselect",
      required: false,
      options: ["Salesforce", "HubSpot", "Snowflake", "AWS"],
      fillRate: 0.12,
    },
  ],
  deal: [
    {
      id: "d1",
      label: "Competitor",
      apiName: "competitor",
      type: "select",
      required: false,
      options: ["Pipedrive", "HubSpot", "In-house", "None"],
      fillRate: 0.55,
    },
    {
      id: "d2",
      label: "Contract start",
      apiName: "contract_start",
      type: "date",
      required: true,
      fillRate: 0.93,
    },
  ],
};

export default function Example() {
  return (
    <SettingsCustomFields
      className="max-w-4xl"
      objects={{ contact: "Contacts", company: "Companies", deal: "Deals" }}
      defaultFields={fields}
    />
  );
}
