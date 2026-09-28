import * as React from "react";
import { PricingCard } from "@/components/crm/pricing-card";

const tiers = [
  {
    name: "Starter",
    description: "For small teams getting their pipeline in order.",
    monthlyPrice: 19,
    yearlyMonthlyPrice: 15,
    features: [
      { label: "Contacts", hint: "5,000" },
      { label: "Pipelines", hint: "1" },
      { label: "Email sync (Gmail, Outlook)" },
      { label: "Workflow automation", included: false },
      { label: "Forecasting", included: false },
    ],
  },
  {
    name: "Growth",
    description: "Automation and reporting for scaling sales teams.",
    monthlyPrice: 49,
    yearlyMonthlyPrice: 39,
    badge: "Most popular",
    featured: true,
    features: [
      { label: "Contacts", hint: "100,000" },
      { label: "Pipelines", hint: "Unlimited" },
      { label: "Email sync (Gmail, Outlook)" },
      { label: "Workflow automation", hint: "50 rules" },
      { label: "Forecasting" },
      { label: "Custom objects", hint: "10" },
      { label: "Sandbox environment" },
      { label: "Priority support, 4h SLA" },
    ],
  },
  {
    name: "Enterprise",
    description: "SSO, audit logs and procurement-friendly invoicing.",
    monthlyPrice: null,
    features: [
      { label: "Everything in Growth" },
      { label: "SAML SSO and SCIM" },
      { label: "Audit log retention", hint: "7 years" },
      { label: "Dedicated CSM" },
    ],
  },
];

export default function Example() {
  const [yearly, setYearly] = React.useState(true);
  const [pending, setPending] = React.useState<string | null>(null);
  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <label className="flex items-center gap-2 self-center text-xs text-crm-soft">
        <input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />
        Bill yearly (12 seats)
      </label>
      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((t) => (
          <PricingCard
            key={t.name}
            {...t}
            seats={12}
            interval={yearly ? "yearly" : "monthly"}
            current={t.name === "Starter"}
            loading={pending === t.name}
            maxFeatures={5}
            onSelect={() => {
              setPending(t.name);
              setTimeout(() => setPending(null), 1200);
            }}
          />
        ))}
      </div>
    </div>
  );
}
