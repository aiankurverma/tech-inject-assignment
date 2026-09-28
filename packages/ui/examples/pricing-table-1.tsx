import * as React from "react";
import {
  PricingTable,
  type PlanQuote,
  type PricingFeatureRow,
  type PricingPlan,
} from "@/components/crm/pricing-table";

const plans: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "For founders tracking their first deals.",
    monthlyPerSeat: 0,
    maxSeats: 2,
    highlights: ["1 pipeline", "500 contacts", "Gmail sync"],
    ctaLabel: "Start free",
  },
  {
    id: "starter",
    name: "Starter",
    description: "Small teams replacing spreadsheets.",
    monthlyPerSeat: 19,
    highlights: ["3 pipelines", "10,000 contacts", "Email templates", "Meeting scheduler"],
  },
  {
    id: "growth",
    name: "Growth",
    description: "Scaling teams that need forecasting and automation.",
    monthlyPerSeat: 49,
    annualPerSeat: 39,
    minSeats: 3,
    recommended: true,
    highlights: ["Unlimited pipelines", "Sequences", "Forecasting", "Power dialer"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Security, compliance and dedicated support.",
    monthlyPerSeat: null,
    minSeats: 25,
    highlights: ["SAML SSO + SCIM", "Audit log", "Sandbox", "99.9% SLA"],
  },
];

const comparison: PricingFeatureRow[] = [
  {
    group: "Sales",
    label: "Pipelines",
    values: { free: "1", starter: "3", growth: "Unlimited", enterprise: "Unlimited" },
  },
  {
    group: "Sales",
    label: "Contacts",
    values: { free: "500", starter: "10k", growth: "100k", enterprise: "Unlimited" },
  },
  { group: "Sales", label: "Forecasting", values: { growth: true, enterprise: true } },
  {
    group: "Engagement",
    label: "Email sync",
    values: { free: true, starter: true, growth: true, enterprise: true },
  },
  { group: "Engagement", label: "Sequences", values: { growth: true, enterprise: true } },
  {
    group: "Engagement",
    label: "Power dialer minutes",
    values: { growth: "1,000 / mo", enterprise: "5,000 / mo" },
  },
  { group: "Security", label: "SAML SSO", values: { enterprise: true } },
  {
    group: "Security",
    label: "Audit log retention",
    values: { starter: "30 days", growth: "90 days", enterprise: "1 year" },
  },
];

export default function Example() {
  const [picked, setPicked] = React.useState<{ plan: string; q: PlanQuote } | null>(null);
  return (
    <div className="flex w-full max-w-6xl flex-col gap-4">
      <PricingTable
        plans={plans}
        comparison={comparison}
        currentPlanId="starter"
        defaultSeats={8}
        onSelectPlan={(plan, q) => setPicked({ plan: plan.name, q })}
      />
      <p className="text-xs text-crm-subtle" aria-live="polite">
        {picked
          ? `Checkout: ${picked.plan}, ${picked.q.seats} seats, ${picked.q.cycle}, total ${picked.q.total === null ? "custom quote" : `$${picked.q.total.toLocaleString()}`}`
          : "Change seats or billing cycle to see totals update."}
      </p>
    </div>
  );
}
