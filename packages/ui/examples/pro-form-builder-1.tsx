import * as React from "react";
import { ProFormBuilder, type FormSchema } from "@/components/crm/pro-form-builder";

const leadIntake: FormSchema = {
  id: "form_inbound_lead",
  version: 1,
  title: "Inbound lead intake",
  description: "Qualifies website leads before they are routed to sales.",
  settings: { submitLabel: "Talk to sales", showProgress: true },
  pages: [
    {
      id: "pg_about",
      title: "About you",
      fields: [
        {
          id: "a1",
          type: "text",
          name: "full_name",
          label: "Full name",
          required: true,
          width: "half",
        },
        {
          id: "a2",
          type: "email",
          name: "email",
          label: "Work email",
          required: true,
          width: "half",
          asyncValidator: "notDisposable",
        },
        {
          id: "a3",
          type: "select",
          name: "company_size",
          label: "Company size",
          required: true,
          options: [
            { label: "1–10", value: "1_10" },
            { label: "11–50", value: "11_50" },
            { label: "51–200", value: "51_200" },
            { label: "201–1,000", value: "201_1000" },
            { label: "1,000+", value: "1000_plus" },
          ],
        },
        {
          id: "a4",
          type: "radio",
          name: "use_case",
          label: "Primary use case",
          required: true,
          options: [
            { label: "Pipeline management", value: "pipeline" },
            { label: "Customer support", value: "support" },
            { label: "Partner portal", value: "partners" },
            { label: "Something else", value: "other" },
          ],
        },
        {
          id: "a5",
          type: "textarea",
          name: "use_case_detail",
          label: "Tell us more",
          required: true,
          validation: { minLength: 10 },
          logic: {
            combinator: "and",
            rules: [{ field: "use_case", operator: "=", value: "other" }],
          },
        },
      ],
    },
    {
      id: "pg_budget",
      title: "Budget & timing",
      logic: {
        combinator: "and",
        rules: [{ field: "company_size", operator: "in", value: "51_200,201_1000,1000_plus" }],
      },
      fields: [
        {
          id: "b1",
          type: "number",
          name: "budget",
          label: "Annual budget (USD)",
          validation: { min: 0 },
          width: "half",
        },
        { id: "b2", type: "date", name: "decision_date", label: "Decision date", width: "half" },
        {
          id: "b3",
          type: "checkbox",
          name: "stakeholders",
          label: "Who is involved?",
          options: [
            { label: "IT / Security", value: "it" },
            { label: "Finance", value: "finance" },
            { label: "Procurement", value: "procurement" },
            { label: "Legal", value: "legal" },
          ],
        },
      ],
    },
    {
      id: "pg_finish",
      title: "Finish",
      fields: [
        { id: "c0", type: "heading", name: "section", label: "Almost done" },
        {
          id: "c1",
          type: "file",
          name: "rfp",
          label: "RFP or requirements doc",
          file: { accept: ["application/pdf", ".docx"], maxSizeMb: 10, maxFiles: 1 },
        },
        {
          id: "c2",
          type: "consent",
          name: "consent",
          label: "I agree to be contacted by sales.",
          required: true,
        },
      ],
    },
  ],
};

export default function Example() {
  const [schema, setSchema] = React.useState(leadIntake);
  const [saved, setSaved] = React.useState<string | null>(null);
  const fields = schema.pages.reduce((n, p) => n + p.fields.length, 0);

  return (
    <div className="flex flex-col gap-3 bg-crm-bg p-4 font-crm">
      <ProFormBuilder
        value={schema}
        onChange={setSchema}
        height={680}
        asyncValidators={{
          notDisposable: async (v) => {
            await new Promise((r) => setTimeout(r, 300));
            return /@(mailinator|10minutemail|guerrillamail)\./i.test(String(v))
              ? "Disposable addresses are not accepted"
              : null;
          },
        }}
        onSave={async (s) => {
          await new Promise((r) => setTimeout(r, 500));
          setSaved(
            `v${new Date().toLocaleTimeString()} · ${JSON.stringify(s).length.toLocaleString()} bytes`,
          );
        }}
      />
      <p className="text-xs text-crm-subtle">
        {schema.pages.length} pages · {fields} fields ·{" "}
        {saved ? `last saved ${saved}` : "not saved yet"}
      </p>
    </div>
  );
}
