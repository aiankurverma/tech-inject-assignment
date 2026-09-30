import * as React from "react";
import { CreditCard, FileText, Gauge, LifeBuoy, Receipt } from "lucide-react";
import { Button } from "@/components/crm/button";
import { ProBillingPortal, type ProBillingPortalProps } from "@/components/crm/pro-billing-portal";
import { TemplateShell, type Kpi } from "@/components/crm/template-shell";

export interface BillingPageTemplateProps {
  kpis?: Kpi[];
  /** Forwarded to ProBillingPortal (the `api` adapter does all IO). */
  billing: ProBillingPortalProps;
  onContactSales?: () => void;
  className?: string;
}

const nav = [
  { id: "subscription", label: "Subscription", icon: <CreditCard /> },
  { id: "invoices", label: "Invoices", icon: <FileText /> },
  { id: "usage", label: "Usage", icon: <Gauge /> },
  { id: "support", label: "Billing support", icon: <LifeBuoy /> },
];

/** Full-page billing & subscription area: spend KPIs plus the self-serve pro billing portal. */
export function BillingPageTemplate({
  kpis,
  billing,
  onContactSales,
  className,
}: BillingPageTemplateProps) {
  return (
    <TemplateShell
      className={className}
      brand={{ logo: <Receipt />, title: "Billing", subtitle: "Account" }}
      nav={nav}
      title="Billing & subscription"
      description="Manage your plan, payment methods, invoices and usage."
      kpis={kpis}
      actions={<Button onClick={onContactSales}>Talk to sales</Button>}
    >
      <ProBillingPortal title="Your plan" {...billing} />
    </TemplateShell>
  );
}
