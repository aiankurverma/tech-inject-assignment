import * as React from "react";
import { History, KeyRound, Settings, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/crm/button";
import { ProAuditLog, type ProAuditLogProps } from "@/components/crm/pro-audit-log";
import { ProRbacMatrix, type ProRbacMatrixProps } from "@/components/crm/pro-rbac-matrix";
import { TemplateShell, type Kpi } from "@/components/crm/template-shell";

export type AdminPanelSection = "roles" | "audit";

export interface AdminPanelTemplateProps {
  kpis?: Kpi[];
  /** Forwarded to ProRbacMatrix. */
  rbac: ProRbacMatrixProps;
  /** Forwarded to ProAuditLog. */
  audit: ProAuditLogProps;
  /** Section shown first. The sidebar switches between them. */
  defaultSection?: AdminPanelSection;
  onInvite?: () => void;
  className?: string;
}

/** Full-page workspace admin: members KPIs, roles & permissions matrix and the audit log. */
export function AdminPanelTemplate({
  kpis,
  rbac,
  audit,
  defaultSection = "roles",
  onInvite,
  className,
}: AdminPanelTemplateProps) {
  const [section, setSection] = React.useState<string>(defaultSection);
  const nav = [
    { id: "members", label: "Members", icon: <Users /> },
    { id: "roles", label: "Roles & permissions", icon: <ShieldCheck />, count: rbac.roles.length },
    { id: "audit", label: "Audit log", icon: <History /> },
    { id: "api", label: "API keys", icon: <KeyRound /> },
  ];
  const showAudit = section === "audit";
  return (
    <TemplateShell
      className={className}
      brand={{ logo: <Settings />, title: "Admin", subtitle: "Workspace settings" }}
      nav={nav}
      activeNav={section}
      onNavigate={setSection}
      title={showAudit ? "Audit log" : "Roles & permissions"}
      description={
        showAudit
          ? "Every change made in this workspace, with before/after diffs."
          : "Grant or revoke permissions per role. Inherited grants are dashed."
      }
      kpis={kpis}
      actions={
        <Button variant="primary" onClick={onInvite}>
          <UserPlus /> Invite member
        </Button>
      }
    >
      {showAudit ? (
        <ProAuditLog height={520} {...audit} />
      ) : (
        <ProRbacMatrix height={520} {...rbac} />
      )}
    </TemplateShell>
  );
}
