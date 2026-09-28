import * as React from "react";
import {
  OnboardingWizard,
  type WizardErrors,
  type WizardStep,
} from "@/components/crm/onboarding-wizard";
import { FormField, Input } from "@/components/crm/input";
import { Select } from "@/components/crm/select";
import { Checkbox } from "@/components/crm/checkbox";
import { CurrencyInput } from "@/components/crm/currency-input";

interface Values extends Record<string, unknown> {
  company: string;
  website: string;
  industry: string;
  quota: number | null;
  currency: string;
  channels: string[];
}

const industries = [
  { value: "saas", label: "Software / SaaS" },
  { value: "realestate", label: "Real estate" },
  { value: "agency", label: "Agency / services" },
  { value: "manufacturing", label: "Manufacturing" },
];
const channels = ["Email", "Phone", "LinkedIn", "WhatsApp"];

const steps: WizardStep<Values>[] = [
  {
    id: "company",
    title: "About your company",
    description: "We use this to tailor pipelines and reports.",
    validate: (v) => ({
      ...(v.company.trim().length < 2 ? { company: "Company name is required" } : {}),
      ...(v.website && !/^https?:\/\/.+\..+/.test(v.website)
        ? { website: "Use a full URL, e.g. https://acme.com" }
        : {}),
    }),
    render: ({ values, errors, setValues }) => (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Company name" htmlFor="w-company" required error={errors.company}>
          <Input
            id="w-company"
            value={values.company}
            invalid={!!errors.company}
            aria-describedby="w-company-msg"
            onChange={(e) => setValues({ company: e.target.value })}
          />
        </FormField>
        <FormField label="Website" htmlFor="w-web" error={errors.website}>
          <Input
            id="w-web"
            placeholder="https://"
            value={values.website}
            invalid={!!errors.website}
            aria-describedby="w-web-msg"
            onChange={(e) => setValues({ website: e.target.value })}
          />
        </FormField>
        <FormField label="Industry" htmlFor="w-ind" className="sm:col-span-2">
          <Select
            id="w-ind"
            value={values.industry}
            onValueChange={(industry) => setValues({ industry })}
            options={industries}
          />
        </FormField>
      </div>
    ),
  },
  {
    id: "targets",
    title: "Sales targets",
    description: "Monthly quota per rep. You can change it later in Settings.",
    validate: (v): WizardErrors =>
      v.quota === null || v.quota <= 0 ? { quota: "Enter a quota above zero" } : {},
    render: ({ values, errors, setValues }) => (
      <FormField label="Monthly quota per rep" htmlFor="w-quota" required error={errors.quota}>
        <CurrencyInput
          id="w-quota"
          currency={values.currency}
          locale="en-IN"
          value={values.quota}
          invalid={!!errors.quota}
          onChange={(quota) => setValues({ quota })}
        />
      </FormField>
    ),
  },
  {
    id: "channels",
    title: "Outreach channels",
    description: "Pick the channels your reps use. Sequences are built from these.",
    optional: true,
    render: ({ values, setValues }) => (
      <ul className="grid gap-2 sm:grid-cols-2">
        {channels.map((c) => {
          const on = values.channels.includes(c);
          return (
            <li key={c}>
              <label className="flex cursor-pointer items-center gap-2 rounded-crm border border-crm-border bg-crm-raised p-3 text-sm">
                <Checkbox
                  checked={on}
                  onCheckedChange={() =>
                    setValues({
                      channels: on
                        ? values.channels.filter((x) => x !== c)
                        : [...values.channels, c],
                    })
                  }
                />
                {c}
              </label>
            </li>
          );
        })}
      </ul>
    ),
  },
  {
    id: "review",
    title: "Review and finish",
    render: ({ values }) => (
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-crm-subtle">Company</dt>
        <dd>{values.company}</dd>
        <dt className="text-crm-subtle">Industry</dt>
        <dd>{industries.find((i) => i.value === values.industry)?.label}</dd>
        <dt className="text-crm-subtle">Quota / rep</dt>
        <dd>
          {values.quota?.toLocaleString("en-IN", {
            style: "currency",
            currency: values.currency,
            maximumFractionDigits: 0,
          })}
        </dd>
        <dt className="text-crm-subtle">Channels</dt>
        <dd>{values.channels.join(", ") || "None"}</dd>
      </dl>
    ),
  },
];

export default function Example() {
  const [done, setDone] = React.useState(false);
  if (done)
    return <p className="text-sm text-crm-fg">Workspace configured. Opening your pipeline…</p>;
  return (
    <OnboardingWizard
      steps={steps}
      initialValues={{
        company: "",
        website: "",
        industry: "saas",
        quota: 250000,
        currency: "INR",
        channels: ["Email"],
      }}
      onComplete={async () => {
        await new Promise((r) => setTimeout(r, 900));
        setDone(true);
      }}
    />
  );
}
