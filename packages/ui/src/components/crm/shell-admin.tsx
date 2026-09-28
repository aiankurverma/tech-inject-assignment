import * as React from "react";
import { ChevronRight, Lock, PanelLeftClose, PanelLeftOpen, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tag } from "@/components/crm/tag";

export type AdminRole = "viewer" | "admin" | "owner";
const rank: Record<AdminRole, number> = { viewer: 0, admin: 1, owner: 2 };

export interface AdminNavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Minimum role required. Lower roles see the item locked. */
  requires?: AdminRole;
  count?: number;
  /** Marks items that need attention (e.g. failing webhooks). */
  alert?: boolean;
}

export interface AdminNavSection {
  label: string;
  items: AdminNavItem[];
}

export interface ShellAdminProps {
  sections: AdminNavSection[];
  role: AdminRole;
  active?: string;
  defaultActive?: string;
  onNavigate?: (id: string) => void;
  environment?: "production" | "staging" | "development";
  /** When set, shows a persistent impersonation banner with an exit action. */
  impersonating?: { name: string; onExit: () => void };
  orgName: string;
  topRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const envTag = { production: "red", staging: "amber", development: "green" } as const;

/** Admin console layout: role-gated nav, environment badge, impersonation banner, collapsible rail. */
export function ShellAdmin({
  sections,
  role,
  active,
  defaultActive,
  onNavigate,
  environment = "production",
  impersonating,
  orgName,
  topRight,
  children,
  className,
}: ShellAdminProps) {
  const first = sections[0]?.items[0]?.id ?? "";
  const [inner, setInner] = React.useState(defaultActive ?? first);
  const [collapsed, setCollapsed] = React.useState(false);
  const current = active ?? inner;
  const allItems = sections.flatMap((s) => s.items);
  const currentItem = allItems.find((i) => i.id === current);
  const currentSection = sections.find((s) => s.items.some((i) => i.id === current));

  const allowed = (i: AdminNavItem) => rank[role] >= rank[i.requires ?? "viewer"];
  const select = (i: AdminNavItem) => {
    if (!allowed(i)) return;
    if (active === undefined) setInner(i.id);
    onNavigate?.(i.id);
  };

  return (
    <div
      className={cn(
        "flex min-h-[560px] flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg font-crm text-crm-fg",
        className,
      )}
    >
      {impersonating ? (
        <div
          role="status"
          className="flex items-center justify-between gap-2 border-b border-tag-amber-border bg-tag-amber-bg px-4 py-1.5 text-xs text-tag-amber-text"
        >
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="size-3.5" aria-hidden />
            Viewing as <strong className="font-semibold">{impersonating.name}</strong>. Actions are
            audited.
          </span>
          <button
            type="button"
            onClick={impersonating.onExit}
            className="rounded px-1.5 py-0.5 font-medium underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
          >
            Exit
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Admin"
          className={cn(
            "flex shrink-0 flex-col gap-4 overflow-y-auto border-r border-crm-border bg-crm-card p-2 transition-[width] duration-150",
            collapsed ? "w-12" : "w-12 sm:w-56",
          )}
        >
          <div className="flex items-center justify-between gap-2 px-1.5 pt-1">
            {!collapsed ? (
              <span className="hidden truncate text-sm font-semibold sm:block">{orgName}</span>
            ) : null}
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={!collapsed}
              className="hidden size-6 place-items-center rounded-md text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none sm:grid"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-3.5" />
              ) : (
                <PanelLeftClose className="size-3.5" />
              )}
            </button>
          </div>
          {sections.map((s) => (
            <div key={s.label} className="flex flex-col gap-0.5">
              {!collapsed ? (
                <p className="crm-eyebrow hidden px-2 pb-1 sm:block">{s.label}</p>
              ) : null}
              <ul className="flex flex-col gap-0.5">
                {s.items.map((i) => {
                  const ok = allowed(i);
                  const on = i.id === current;
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => select(i)}
                        aria-current={on ? "page" : undefined}
                        aria-disabled={!ok || undefined}
                        title={ok ? i.label : `${i.label} — requires ${i.requires} role`}
                        className={cn(
                          "relative flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0",
                          on
                            ? "bg-crm-muted font-medium text-crm-fg"
                            : ok
                              ? "text-crm-muted-fg hover:bg-crm-muted/60 hover:text-crm-fg"
                              : "cursor-not-allowed text-crm-faint",
                        )}
                      >
                        {i.icon}
                        {!collapsed ? (
                          <span className="hidden flex-1 truncate sm:block">{i.label}</span>
                        ) : null}
                        {!collapsed && !ok ? (
                          <Lock className="hidden sm:block" aria-label="Locked" />
                        ) : null}
                        {!collapsed && ok && i.count !== undefined ? (
                          <span className="hidden text-xs text-crm-soft tabular-nums sm:block">
                            {i.count}
                          </span>
                        ) : null}
                        {i.alert ? (
                          <span
                            aria-label="Needs attention"
                            className="absolute top-1.5 left-5 size-1.5 rounded-full bg-crm-danger"
                          />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 items-center justify-between gap-3 border-b border-crm-border px-4">
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
              <span className="truncate text-crm-soft">{currentSection?.label ?? "Admin"}</span>
              <ChevronRight className="size-3.5 shrink-0 text-crm-faint" aria-hidden />
              <span className="truncate font-medium">{currentItem?.label ?? "Overview"}</span>
            </nav>
            <div className="flex items-center gap-2">
              <Tag color={envTag[environment]} size="sm">
                {environment}
              </Tag>
              <Tag color="neutral" size="sm">
                {role}
              </Tag>
              {topRight}
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
