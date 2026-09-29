import * as React from "react";
import {
  ProRbacMatrix,
  type GrantChange,
  type RbacGrants,
  type RbacPermission,
  type RbacRole,
} from "@/components/crm/pro-rbac-matrix";

// Enterprise tenant: 12 roles with an inheritance chain and 10,000 permissions
// (1,250 resources x 8 actions) - the size a real SSO/SCIM customer ships with.
const roles: RbacRole[] = [
  {
    id: "owner",
    name: "Owner",
    description: "Workspace owner",
    locked: true,
    members: 2,
    inherits: ["admin"],
  },
  {
    id: "admin",
    name: "Admin",
    description: "Full administrative access",
    members: 6,
    inherits: ["manager"],
  },
  { id: "manager", name: "Sales Manager", members: 18, inherits: ["rep"] },
  { id: "rep", name: "Account Exec", members: 142, inherits: ["viewer"] },
  { id: "sdr", name: "SDR", members: 64, inherits: ["viewer"] },
  { id: "cs", name: "Customer Success", members: 37, inherits: ["viewer"] },
  { id: "support", name: "Support Agent", members: 91, inherits: ["viewer"] },
  { id: "finance", name: "Finance", members: 9, inherits: ["viewer"] },
  { id: "marketing", name: "Marketing", members: 23, inherits: ["viewer"] },
  { id: "ops", name: "RevOps", members: 7, inherits: ["manager"] },
  { id: "auditor", name: "Auditor", description: "Read-only compliance access", members: 3 },
  { id: "viewer", name: "Viewer", description: "Base read access", members: 410 },
];

const DOMAINS = [
  "contacts",
  "companies",
  "deals",
  "invoices",
  "quotes",
  "tickets",
  "reports",
  "workflows",
  "webhooks",
  "api-keys",
];
const ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "export",
  "import",
  "share",
  "admin",
] as const;
const HIGH_RISK = new Set(["delete", "export", "admin"]);

function buildPermissions(): RbacPermission[] {
  const perms: RbacPermission[] = [];
  for (let i = 0; i < 1250; i++) {
    const domain = DOMAINS[i % DOMAINS.length] ?? "contacts";
    const resource =
      i < DOMAINS.length
        ? domain
        : `${domain}.${["fields", "views", "notes", "files", "tasks"][i % 5]}-${Math.floor(i / 10)}`;
    for (const action of ACTIONS)
      perms.push({
        id: `${resource}:${action}`,
        resource,
        action,
        description: `${action.charAt(0).toUpperCase()}${action.slice(1)} ${resource.replace(/[.-]/g, " ")}`,
        risk: HIGH_RISK.has(action) ? "high" : action === "update" ? "medium" : "low",
      });
  }
  return perms;
}

function buildGrants(perms: RbacPermission[]): RbacGrants {
  const g: Record<
    | "owner"
    | "admin"
    | "manager"
    | "rep"
    | "sdr"
    | "cs"
    | "support"
    | "finance"
    | "marketing"
    | "ops"
    | "auditor"
    | "viewer",
    string[]
  > = {
    owner: [],
    admin: [],
    manager: [],
    rep: [],
    sdr: [],
    cs: [],
    support: [],
    finance: [],
    marketing: [],
    ops: [],
    auditor: [],
    viewer: [],
  };
  for (const p of perms) {
    if (p.action === "read") g.viewer.push(p.id);
    if (["create", "update"].includes(p.action) && /^(contacts|companies|deals)/.test(p.resource))
      g.rep.push(p.id);
    if (p.action === "create" && /^contacts/.test(p.resource)) g.sdr.push(p.id);
    if (
      ["update", "share", "export"].includes(p.action) &&
      /^(deals|quotes|reports)/.test(p.resource)
    )
      g.manager.push(p.id);
    if (/^tickets/.test(p.resource) && p.action !== "admin") g.support.push(p.id);
    if (/^(invoices|quotes)/.test(p.resource) && p.action !== "admin") g.finance.push(p.id);
    if (p.action !== "admin" || /^(workflows|webhooks|api-keys)/.test(p.resource))
      g.admin.push(p.id);
    if (/^(workflows|reports)/.test(p.resource) && p.action !== "delete") g.ops.push(p.id);
    if (p.action === "read" || p.action === "export") g.auditor.push(p.id);
    if (/^(contacts|reports)/.test(p.resource) && ["import", "export"].includes(p.action))
      g.marketing.push(p.id);
  }
  return g;
}

export default function ProRbacMatrixExample() {
  const permissions = React.useMemo(buildPermissions, []);
  const initial = React.useMemo(() => buildGrants(permissions), [permissions]);
  const [log, setLog] = React.useState<string | null>(null);

  const onSave = async (_next: RbacGrants, changes: GrantChange[]) => {
    await new Promise((r) => setTimeout(r, 700));
    if (
      changes.some(
        (c) =>
          c.roleId === "auditor" &&
          c.change === "granted" &&
          !c.permId.endsWith(":read") &&
          !c.permId.endsWith(":export"),
      )
    )
      throw new Error("Policy: Auditor must stay read-only (SOC 2 control CC6.3).");
    setLog(
      `Saved ${changes.length} change${changes.length === 1 ? "" : "s"} at ${new Date().toLocaleTimeString()}`,
    );
  };

  return (
    <div className="space-y-3 bg-crm-bg p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-medium text-crm-fg">
            Roles & permissions · Globex (Enterprise)
          </h3>
          <p className="text-xs text-crm-muted-fg">
            {permissions.length.toLocaleString()} permissions across {roles.length} roles. Dashed
            cells are inherited.
          </p>
        </div>
        {log && <span className="text-xs text-crm-success">{log}</span>}
      </div>
      <ProRbacMatrix
        roles={roles}
        permissions={permissions}
        defaultValue={initial}
        onSave={onSave}
        height={560}
      />
    </div>
  );
}
