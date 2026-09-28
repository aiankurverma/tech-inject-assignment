import { Bell, CreditCard, Plug, ShieldCheck, User, Users } from "lucide-react";
import {
  VerticalTabs,
  VerticalTabsContent,
  VerticalTabsLabel,
  VerticalTabsList,
  VerticalTabsTrigger,
} from "@/components/crm/vertical-tabs";

const panels = {
  profile: "Name, photo and time zone.",
  notifications: "Choose which pipeline events notify you.",
  security: "Password, two-factor authentication and sessions.",
  members: "Invite teammates and manage roles.",
  billing: "Plan, invoices and payment method.",
  integrations: "Connect Gmail, Slack and your calendar.",
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
      {Object.entries(panels).map(([key, text]) => (
        <VerticalTabsContent
          key={key}
          value={key}
          className="border border-crm-border bg-crm-card p-5"
        >
          <h2 className="text-sm font-medium capitalize">{key}</h2>
          <p className="mt-1 text-xs text-crm-soft">{text}</p>
        </VerticalTabsContent>
      ))}
    </VerticalTabs>
  );
}
