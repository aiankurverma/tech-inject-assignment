import { SettingsRoles, type PermissionResource, type Role } from "@/components/crm/settings-roles";

const resources: PermissionResource[] = [
  { key: "contacts", label: "Contacts", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "companies", label: "Companies", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "deals", label: "Deals", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "quotes", label: "Quotes", actions: ["view", "create", "edit", "delete"] },
  { key: "reports", label: "Reports", actions: ["view", "create", "export"] },
  { key: "billing", label: "Billing", actions: ["view", "edit"] },
];

const full = Object.fromEntries(resources.map((r) => [r.key, r.actions]));

const roles: Role[] = [
  {
    id: "admin",
    name: "Admin",
    description: "Full access to everything",
    system: true,
    memberCount: 2,
    permissions: full,
  },
  {
    id: "rep",
    name: "Sales rep",
    description: "Works own pipeline",
    system: true,
    memberCount: 14,
    permissions: {
      contacts: ["view", "create", "edit"],
      companies: ["view", "create", "edit"],
      deals: ["view", "create", "edit"],
      quotes: ["view", "create", "edit"],
      reports: ["view"],
    },
  },
  {
    id: "finance",
    name: "Finance reviewer",
    description: "Custom role",
    memberCount: 3,
    permissions: {
      deals: ["view", "export"],
      quotes: ["view"],
      reports: ["view", "export"],
      billing: ["view", "edit"],
    },
  },
  {
    id: "intern",
    name: "SDR intern",
    description: "Custom role",
    memberCount: 0,
    permissions: { contacts: ["view", "create"], companies: ["view"] },
  },
];

export default function Example() {
  return (
    <SettingsRoles
      className="max-w-5xl"
      resources={resources}
      defaultRoles={roles}
      onSave={() => new Promise((r) => setTimeout(r, 700))}
    />
  );
}
