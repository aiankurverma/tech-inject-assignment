import { useState } from "react";
import { Bell, Building2, CreditCard, KeyRound, Plug, Shield, User, Users } from "lucide-react";
import { ShellSettings, type SettingsPage } from "@/components/crm/shell-settings";
import { SettingsGroup, SettingsRow } from "@/components/crm/settings-row";
import { Switch } from "@/components/crm/switch";
import { Input } from "@/components/crm/input";
import { Select } from "@/components/crm/select";
import { Tag } from "@/components/crm/tag";

const pages: SettingsPage[] = [
  {
    id: "profile",
    label: "Profile",
    group: "Account",
    icon: <User />,
    description: "How you appear to teammates and customers.",
  },
  {
    id: "notifications",
    label: "Notifications",
    group: "Account",
    icon: <Bell />,
    keywords: ["email", "digest", "mentions"],
  },
  {
    id: "security",
    label: "Security",
    group: "Account",
    icon: <Shield />,
    keywords: ["2fa", "password", "sessions"],
  },
  {
    id: "workspace",
    label: "General",
    group: "Workspace",
    icon: <Building2 />,
    description: "Name, currency and fiscal year for the whole workspace.",
  },
  {
    id: "members",
    label: "Members",
    group: "Workspace",
    icon: <Users />,
    badge: <Tag size="sm">24</Tag>,
  },
  {
    id: "integrations",
    label: "Integrations",
    group: "Workspace",
    icon: <Plug />,
    keywords: ["slack", "gmail", "salesforce"],
  },
  {
    id: "sso",
    label: "SSO & SCIM",
    group: "Workspace",
    icon: <KeyRound />,
    keywords: ["saml", "okta"],
    badge: (
      <Tag size="sm" color="purple">
        Enterprise
      </Tag>
    ),
    disabled: true,
  },
  { id: "billing", label: "Plan & billing", group: "Billing", icon: <CreditCard /> },
];

const initial = {
  name: "Acme Sales",
  currency: "USD",
  fiscal: "jan",
  digest: true,
  mentions: true,
};

export default function Example() {
  const [active, setActive] = useState("workspace");
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  const save = () => {
    if (!draft.name.trim()) return setError("Workspace name can't be empty.");
    setSaving(true);
    setError(undefined);
    setTimeout(() => {
      setSaved(draft);
      setSaving(false);
    }, 700);
  };

  return (
    <div className="h-[600px] overflow-hidden rounded-crm border border-crm-border">
      <ShellSettings
        pages={pages}
        activeId={active}
        onNavigate={setActive}
        dirty={dirty}
        saving={saving}
        saveError={error}
        onSave={save}
        onDiscard={() => {
          setDraft(saved);
          setError(undefined);
        }}
        confirmLeave={() => true}
      >
        {active === "workspace" ? (
          <SettingsGroup heading="Workspace">
            <SettingsRow
              label="Workspace name"
              htmlFor="ws-name"
              control={
                <Input
                  id="ws-name"
                  value={draft.name}
                  invalid={!draft.name.trim()}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-56"
                />
              }
            />
            <SettingsRow
              label="Reporting currency"
              description="Deal amounts in other currencies convert at daily rates."
              control={
                <Select
                  aria-label="Reporting currency"
                  value={draft.currency}
                  onValueChange={(currency) => setDraft({ ...draft, currency })}
                  options={[
                    { value: "USD", label: "USD — US Dollar" },
                    { value: "EUR", label: "EUR — Euro" },
                    { value: "INR", label: "INR — Indian Rupee" },
                  ]}
                  className="w-56"
                />
              }
            />
            <SettingsRow
              label="Fiscal year starts"
              control={
                <Select
                  aria-label="Fiscal year start"
                  value={draft.fiscal}
                  onValueChange={(fiscal) => setDraft({ ...draft, fiscal })}
                  options={[
                    { value: "jan", label: "January" },
                    { value: "apr", label: "April" },
                    { value: "jul", label: "July" },
                  ]}
                  className="w-56"
                />
              }
            />
          </SettingsGroup>
        ) : active === "notifications" ? (
          <SettingsGroup heading="Email">
            <SettingsRow
              label="Daily pipeline digest"
              description="Sent at 8:00 in your time zone."
              control={
                <Switch
                  checked={draft.digest}
                  onCheckedChange={(digest) => setDraft({ ...draft, digest })}
                  aria-label="Daily digest"
                />
              }
            />
            <SettingsRow
              label="Mentions"
              control={
                <Switch
                  checked={draft.mentions}
                  onCheckedChange={(mentions) => setDraft({ ...draft, mentions })}
                  aria-label="Mentions"
                />
              }
            />
          </SettingsGroup>
        ) : (
          <p className="rounded-crm border border-dashed border-crm-border p-8 text-center text-sm text-crm-muted-fg">
            This section is managed by your admin.
          </p>
        )}
      </ShellSettings>
    </div>
  );
}
