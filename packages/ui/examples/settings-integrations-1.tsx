import { SettingsIntegrations, type Integration } from "@/components/crm/settings-integrations";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const apps: Integration[] = [
  {
    id: "gmail",
    name: "Gmail",
    category: "Email",
    description: "Two-way email sync and open tracking for every rep inbox.",
    status: "connected",
    account: "sales@northwind.io",
    lastSyncedAt: ago(4),
  },
  {
    id: "outlook",
    name: "Outlook",
    category: "Email",
    description: "Sync Microsoft 365 mail and calendar events to contacts.",
    status: "disconnected",
  },
  {
    id: "slack",
    name: "Slack",
    category: "Messaging",
    description: "Post deal-won alerts and approvals to channels.",
    status: "error",
    account: "#sales-wins",
    errorMessage: "Token expired. Reconnect to resume alerts.",
    lastSyncedAt: ago(2900),
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Billing",
    description: "See MRR, invoices and failed payments on the company record.",
    status: "connected",
    account: "acct_1Nw4…",
    lastSyncedAt: ago(90),
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: "Billing",
    description: "Push closed-won deals as invoices with line items.",
    status: "disconnected",
  },
  {
    id: "zoom",
    name: "Zoom",
    category: "Meetings",
    description: "Log calls and attach recordings and transcripts.",
    status: "disconnected",
    beta: true,
  },
  {
    id: "salesforce",
    name: "Salesforce import",
    category: "Data",
    description: "One-click migration of accounts, opportunities and history.",
    status: "disconnected",
    locked: true,
  },
];

export default function Example() {
  return (
    <SettingsIntegrations
      className="max-w-5xl"
      defaultIntegrations={apps}
      onConnect={(i) =>
        new Promise((resolve, reject) =>
          setTimeout(
            () =>
              i.id === "zoom"
                ? reject(new Error("Zoom admin approval required."))
                : resolve({ account: "ops@northwind.io" }),
            900,
          ),
        )
      }
      onSync={() => new Promise((r) => setTimeout(r, 1200))}
    />
  );
}
