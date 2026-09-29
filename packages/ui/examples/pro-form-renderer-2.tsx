import * as React from "react";
import {
  ProFormRenderer,
  type FormField,
  type FormSchema,
} from "@/components/crm/pro-form-renderer";

// A generated 12-section, 180-question vendor security assessment: exercises page logic,
// per-question follow-ups and validation across a large schema.
const SECTIONS = [
  "Governance",
  "Access control",
  "Encryption",
  "Network security",
  "Application security",
  "Vulnerability management",
  "Incident response",
  "Business continuity",
  "Vendor management",
  "Data privacy",
  "Physical security",
  "HR security",
];
const TOPICS = [
  "a documented policy",
  "annual review",
  "named ownership",
  "automated monitoring",
  "evidence retained for 12 months",
  "third-party audit",
  "board reporting",
];

function buildAssessment(): FormSchema {
  const answers = [
    { label: "Yes", value: "yes" },
    { label: "Partially", value: "partial" },
    { label: "No", value: "no" },
    { label: "Not applicable", value: "na" },
  ];
  const pages = SECTIONS.map((section, s) => {
    const key = section.toLowerCase().replace(/[^a-z]+/g, "_");
    const fields: FormField[] = [
      {
        id: `h_${s}`,
        type: "heading",
        name: `h_${key}`,
        label: section,
        helpText: "7 controls with follow-ups",
      },
    ];
    for (let q = 0; q < 7; q++) {
      const name = `${key}_q${q + 1}`;
      fields.push({
        id: `q_${s}_${q}`,
        type: "radio",
        name,
        label: `${s + 1}.${q + 1} Does ${section.toLowerCase()} include ${TOPICS[q]}?`,
        required: true,
        options: answers,
      });
      fields.push({
        id: `e_${s}_${q}`,
        type: "textarea",
        name: `${name}_gap`,
        label: "Describe the gap and remediation plan",
        required: true,
        validation: { minLength: 15 },
        logic: { combinator: "or", rules: [{ field: name, operator: "in", value: "no,partial" }] },
      });
    }
    fields.push({
      id: `m_${s}`,
      type: "rating",
      name: `${key}_maturity`,
      label: "Self-assessed maturity",
      validation: { max: 5 },
    });
    return {
      id: `pg_${key}`,
      title: section,
      fields,
      // Physical security is skipped for fully remote vendors.
      logic:
        section === "Physical security"
          ? {
              combinator: "and" as const,
              rules: [{ field: "work_model", operator: "!=", value: "remote" }],
            }
          : undefined,
    };
  });
  pages.unshift({
    id: "pg_vendor",
    title: "Vendor",
    logic: undefined,
    fields: [
      { id: "v1", type: "text", name: "vendor_name", label: "Legal entity name", required: true },
      {
        id: "v2",
        type: "select",
        name: "work_model",
        label: "Work model",
        required: true,
        width: "half",
        options: [
          { label: "Office based", value: "office" },
          { label: "Hybrid", value: "hybrid" },
          { label: "Fully remote", value: "remote" },
        ],
      },
      {
        id: "v3",
        type: "number",
        name: "employees",
        label: "Employees",
        width: "half",
        validation: { min: 1 },
      },
    ],
  });
  return {
    id: "form_vendor_security",
    version: 1,
    title: "Vendor security assessment",
    description: `${pages.reduce((n, p) => n + p.fields.length, 0)} questions across ${pages.length} sections. Progress is saved as you go.`,
    settings: { submitLabel: "Submit assessment", showProgress: true },
    pages,
  };
}

export default function Example() {
  const schema = React.useMemo(buildAssessment, []);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="mx-auto max-w-2xl bg-crm-bg p-6 font-crm">
      <ProFormRenderer
        schema={schema}
        loading={loading}
        draftKey="kitbase-vendor-assessment-demo"
        initialValues={{
          vendor_name: "Acme Cloud Storage Ltd",
          work_model: "remote",
          employees: 84,
        }}
        onSubmit={async () => {
          await new Promise((r) => setTimeout(r, 800));
        }}
      />
    </div>
  );
}
