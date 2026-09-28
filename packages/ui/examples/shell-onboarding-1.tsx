import * as React from "react";
import { Sparkles } from "lucide-react";
import { ShellOnboarding } from "@/components/crm/shell-onboarding";

const field =
  "h-8 w-full rounded-md border border-crm-border bg-crm-card px-2.5 text-sm text-crm-fg outline-none focus:ring-2 focus:ring-crm-primary";

export default function Example() {
  const [company, setCompany] = React.useState("");
  const [currency, setCurrency] = React.useState("USD");
  const [emails, setEmails] = React.useState("");
  const [stages, setStages] = React.useState("Discovery, Demo, Proposal, Negotiation");

  const invalidEmails = emails
    .split(/[\s,]+/)
    .filter(Boolean)
    .filter((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

  return (
    <ShellOnboarding
      className="w-[900px]"
      brand={
        <>
          <Sparkles className="size-4 text-crm-primary" /> Northwind CRM
        </>
      }
      onExit={() => undefined}
      onComplete={() => new Promise<void>((r) => setTimeout(r, 800))}
      steps={[
        {
          id: "company",
          title: "Your company",
          description: "Used on quotes, invoices and email signatures.",
          minutes: 2,
          validate: () => (company.trim().length < 2 ? "Enter your company name." : null),
          content: (
            <div className="grid max-w-md gap-3">
              <label className="grid gap-1 text-xs text-crm-soft">
                Company name
                <input
                  className={field}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Logistics Pvt Ltd"
                />
              </label>
              <label className="grid gap-1 text-xs text-crm-soft">
                Reporting currency
                <select
                  className={field}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option>USD</option>
                  <option>EUR</option>
                  <option>INR</option>
                  <option>GBP</option>
                </select>
              </label>
            </div>
          ),
        },
        {
          id: "pipeline",
          title: "Sales pipeline",
          description: "Comma-separated stages, in order.",
          minutes: 3,
          validate: () =>
            stages.split(",").filter((s) => s.trim()).length < 2
              ? "Add at least two stages."
              : null,
          content: (
            <textarea
              aria-label="Pipeline stages"
              className={`${field} h-24 py-2`}
              value={stages}
              onChange={(e) => setStages(e.target.value)}
            />
          ),
        },
        {
          id: "team",
          title: "Invite your team",
          description: "Teammates get an email invite with viewer access.",
          optional: true,
          minutes: 1,
          validate: () =>
            invalidEmails.length ? `Invalid email: ${invalidEmails.join(", ")}` : null,
          content: (
            <textarea
              aria-label="Teammate emails"
              className={`${field} h-24 py-2`}
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="priya@acme.com, dev@acme.com"
            />
          ),
        },
        {
          id: "import",
          title: "Import contacts",
          description: "Upload a CSV from HubSpot, Salesforce or a spreadsheet.",
          optional: true,
          minutes: 4,
          content: (
            <p className="text-sm text-crm-soft">You can import later from Settings → Data.</p>
          ),
        },
      ]}
    />
  );
}
