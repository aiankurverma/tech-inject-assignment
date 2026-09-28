import { Bell, CreditCard, Plug, ShieldCheck, User, Users } from "lucide-react";
import {
  VerticalTabs,
  VerticalTabsContent,
  VerticalTabsLabel,
  VerticalTabsList,
  VerticalTabsTrigger,
} from "@/components/crm/vertical-tabs";

const panels: Record<string, { title: string; desc: string; rows: [string, string][] }> = {
  profile: {
    title: "Profile",
    desc: "How you appear to teammates and customers.",
    rows: [
      ["Full name", "Maya Chen"],
      ["Email", "maya@acme.io"],
      ["Job title", "Account Executive"],
      ["Time zone", "Asia/Kolkata (GMT+5:30)"],
      ["Language", "English (US)"],
    ],
  },
  notifications: {
    title: "Notifications",
    desc: "Choose which pipeline events notify you.",
    rows: [
      ["Deal stage changes", "Email + in-app"],
      ["Mentions", "In-app"],
      ["Daily digest", "8:00 AM"],
    ],
  },
  security: {
    title: "Security",
    desc: "Password, two-factor authentication and sessions.",
    rows: [
      ["Password", "Updated 3 months ago"],
      ["Two-factor", "Authenticator app"],
      ["Active sessions", "2 devices"],
    ],
  },
  members: {
    title: "Members",
    desc: "Invite teammates and manage roles.",
    rows: [
      ["Seats", "12 of 15 used"],
      ["Default role", "Member"],
    ],
  },
  billing: {
    title: "Billing",
    desc: "Plan, invoices and payment method.",
    rows: [
      ["Plan", "Pro, billed yearly"],
      ["Next invoice", "Nov 1, 2026"],
    ],
  },
  integrations: {
    title: "Integrations",
    desc: "Connect Gmail, Slack and your calendar.",
    rows: [],
  },
};

export default function Example() {
  return (
    <VerticalTabs defaultValue="profile" className="w-[640px]">
      <VerticalTabsList aria-label="Settings">
        <VerticalTabsLabel>Account</VerticalTabsLabel>
        <VerticalTabsTrigger value="profile" icon={<User />}>
          Profile
        </VerticalTabsTrigger>
        <VerticalTabsTrigger value="notifications" icon={<Bell />} badge={3}>
          Notifications
        </VerticalTabsTrigger>
        <VerticalTabsTrigger value="security" icon={<ShieldCheck />}>
          Security
        </VerticalTabsTrigger>
        <VerticalTabsLabel>Workspace</VerticalTabsLabel>
        <VerticalTabsTrigger value="members" icon={<Users />} badge={12}>
          Members
        </VerticalTabsTrigger>
        <VerticalTabsTrigger value="billing" icon={<CreditCard />}>
          Billing
        </VerticalTabsTrigger>
        <VerticalTabsTrigger value="integrations" icon={<Plug />} disabled>
          Integrations
        </VerticalTabsTrigger>
      </VerticalTabsList>
      {Object.entries(panels).map(([key, p]) => (
        <VerticalTabsContent
          key={key}
          value={key}
          className="rounded-xl border border-crm-border bg-crm-card p-5 text-crm-fg"
        >
          <h2 className="text-sm font-medium">{p.title}</h2>
          <p className="mt-1 text-xs text-crm-soft">{p.desc}</p>
          <dl className="mt-4 divide-y divide-crm-border rounded-lg border border-crm-border">
            {p.rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-3 py-2.5">
                <dt className="text-xs text-crm-subtle">{label}</dt>
                <dd className="truncate text-sm">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="h-8 rounded-lg border border-crm-border px-3 text-xs text-crm-soft hover:bg-crm-raised"
            >
              Cancel
            </button>
            <button
              type="button"
              className="h-8 rounded-lg bg-crm-primary px-3 text-xs font-medium text-crm-primary-fg"
            >
              Save changes
            </button>
          </div>
        </VerticalTabsContent>
      ))}
    </VerticalTabs>
  );
}
