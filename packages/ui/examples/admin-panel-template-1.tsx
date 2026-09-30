import { AdminPanelTemplate } from "@/components/crm/admin-panel-template";
import type { AuditEvent, AuditFetchPage } from "@/components/crm/pro-audit-log";
import type { RbacGrants, RbacPermission, RbacRole } from "@/components/crm/pro-rbac-matrix";

const roles: RbacRole[] = [
  { id: "owner", name: "Owner", locked: true, members: 2, inherits: ["admin"] },
  { id: "admin", name: "Admin", members: 5, inherits: ["rep"] },
  { id: "rep", name: "Account Exec", members: 38, inherits: ["viewer"] },
  { id: "viewer", name: "Viewer", members: 120 },
];
const resources = ["contacts", "companies", "deals", "invoices", "reports", "api-keys"];
const actions = ["read", "create", "update", "delete", "export"];
const permissions: RbacPermission[] = resources.flatMap((resource) =>
  actions.map((action) => ({
    id: `${resource}:${action}`,
    resource,
    action,
    description: `${action} ${resource}`,
    risk: action === "delete" || action === "export" ? ("high" as const) : ("low" as const),
  })),
);
const grants: RbacGrants = {
  owner: [],
  admin: permissions.map((p) => p.id),
  rep: permissions
    .filter((p) => ["create", "update"].includes(p.action) && p.resource !== "api-keys")
    .map((p) => p.id),
  viewer: permissions.filter((p) => p.action === "read").map((p) => p.id),
};

// Small in-memory audit log: 60 events, 20 per page.
const people = ["Priya Raman", "Marcus Webb", "Sofia Lindqvist"];
const verbs = ["deal.updated", "member.role_changed", "api_key.created", "contact.exported"];
const events: AuditEvent[] = Array.from({ length: 60 }, (_, i) => ({
  id: `evt_${i}`,
  occurredAt: new Date(Date.UTC(2026, 8, 29, 12) - i * 47 * 60_000).toISOString(),
  actor: { id: `u${i % 3}`, name: people[i % 3] ?? "System", kind: "user" },
  action: verbs[i % verbs.length] ?? "deal.updated",
  resource: { type: (verbs[i % verbs.length] ?? "deal").split(".")[0] ?? "deal", id: `r_${i}` },
  outcome: i % 11 === 0 ? "failure" : "success",
  ip: `10.0.0.${i + 1}`,
  before: { stage: "Discovery" },
  after: { stage: "Proposal" },
}));
const fetchPage: AuditFetchPage = async ({ cursor, pageSize }) => {
  await new Promise((r) => setTimeout(r, 200));
  const start = cursor ? Number(cursor) : 0;
  const next = start + pageSize;
  return {
    events: events.slice(start, next),
    nextCursor: next < events.length ? String(next) : null,
    total: events.length,
  };
};

export default function Example() {
  return (
    <AdminPanelTemplate
      kpis={[
        { label: "Members", value: "165", delta: 4.2 },
        { label: "Pending invites", value: "7" },
        { label: "SSO enforced", value: "Yes" },
        { label: "Failed logins (7d)", value: "3", delta: -40, invert: true },
      ]}
      rbac={{ roles, permissions, defaultValue: grants, label: "Roles and permissions" }}
      audit={{ fetchPage, pageSize: 20, title: "Workspace activity" }}
    />
  );
}
