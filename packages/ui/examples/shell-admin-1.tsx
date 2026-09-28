import * as React from "react";
import { Building2, CreditCard, KeyRound, ScrollText, Shield, Users, Webhook } from "lucide-react";
import { ShellAdmin } from "@/components/crm/shell-admin";

export default function Example() {
  const [page, setPage] = React.useState("members");
  const [impersonating, setImpersonating] = React.useState(true);
  return (
    <ShellAdmin
      className="w-[960px]"
      orgName="Acme Logistics"
      role="admin"
      environment="staging"
      active={page}
      onNavigate={setPage}
      impersonating={
        impersonating
          ? { name: "rahul@acme.com", onExit: () => setImpersonating(false) }
          : undefined
      }
      sections={[
        {
          label: "Organization",
          items: [
            { id: "general", label: "General", icon: <Building2 /> },
            { id: "members", label: "Members", icon: <Users />, count: 48 },
            { id: "security", label: "Security & SSO", icon: <Shield />, requires: "admin" },
          ],
        },
        {
          label: "Developers",
          items: [
            { id: "api", label: "API keys", icon: <KeyRound />, count: 3 },
            { id: "webhooks", label: "Webhooks", icon: <Webhook />, alert: true },
            { id: "audit", label: "Audit log", icon: <ScrollText /> },
          ],
        },
        {
          label: "Billing",
          items: [
            { id: "billing", label: "Plan & invoices", icon: <CreditCard />, requires: "owner" },
          ],
        },
      ]}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold capitalize">{page}</h1>
        <p className="text-sm text-crm-soft">
          48 members · 6 pending invites. Billing is locked because it requires the owner role.
        </p>
      </div>
    </ShellAdmin>
  );
}
