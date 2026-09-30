import * as React from "react";
import { cn } from "@/lib/utils";
import { Sidebar, SidebarBrand, SidebarItem, SidebarSection } from "@/components/crm/app-sidebar";
import { KpiGrid, type Kpi } from "@/components/crm/kpi-grid";

export type { Kpi } from "@/components/crm/kpi-grid";

export interface TemplateNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

export interface TemplateShellProps {
  brand: { logo: React.ReactNode; title: string; subtitle?: string };
  nav: TemplateNavItem[];
  /** Controlled active nav id. Falls back to internal state starting at the first item. */
  activeNav?: string;
  onNavigate?: (id: string) => void;
  title: string;
  description?: string;
  /** Header actions (buttons, filters). */
  actions?: React.ReactNode;
  kpis?: Kpi[];
  /** Pinned below the nav, e.g. a plan or trial card. */
  sidebarFooter?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Full-page layout used by every Kitbase page template: sidebar, page header, KPI row, body. */
export function TemplateShell({
  brand,
  nav,
  activeNav,
  onNavigate,
  title,
  description,
  actions,
  kpis,
  sidebarFooter,
  className,
  children,
}: TemplateShellProps) {
  const [internal, setInternal] = React.useState(nav[0]?.id);
  const active = activeNav ?? internal;
  const select = (id: string) => {
    setInternal(id);
    onNavigate?.(id);
  };
  return (
    <div
      className={cn(
        "flex h-[860px] w-full overflow-hidden rounded-crm border border-crm-border bg-crm-bg font-crm",
        className,
      )}
    >
      <Sidebar className="hidden md:flex">
        <SidebarBrand {...brand} />
        <SidebarSection>
          {nav.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              count={item.count}
              active={item.id === active}
              onClick={() => select(item.id)}
            >
              {item.label}
            </SidebarItem>
          ))}
        </SidebarSection>
        {sidebarFooter}
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-crm-border px-6 py-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-medium tracking-[-0.01em] text-crm-fg">{title}</h1>
            {description ? <p className="text-sm text-crm-muted-fg">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
        <div className="flex flex-col gap-4 p-6">
          {kpis?.length ? <KpiGrid items={kpis} /> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
