import * as React from "react";
import { Bell, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/crm/button";
import { CountBadge } from "@/components/crm/badge";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/crm/breadcrumbs";
import { SearchInput } from "@/components/crm/search-input";
import { NotificationsPopover, type Notification } from "@/components/crm/notifications";
import { UserMenu, type UserMenuUser } from "@/components/crm/user-menu";
import { WorkspaceSwitcher, type Workspace } from "@/components/crm/workspace-switcher";
import { Sheet, SheetContent } from "@/components/crm/sheet";

export interface ShellNavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Coloured dot instead of an icon (pipelines, lists). */
  dotColor?: string;
  count?: number;
}

export interface ShellNavSection {
  id: string;
  title?: string;
  items: ShellNavItem[];
}

export interface ShellSidebarProps {
  sections: ShellNavSection[];
  activeId?: string;
  defaultActiveId?: string;
  onNavigate?: (id: string) => void;
  workspaces: Workspace[];
  workspaceId?: string;
  onWorkspaceChange?: (id: string) => void;
  user: UserMenuUser;
  onSignOut?: () => void;
  /** Items for the user menu (DropdownMenuItem...). */
  userMenu?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  notifications?: Notification[];
  onMarkAllRead?: () => void;
  onSearch?: (q: string) => void;
  /** Right side of the top bar, before notifications. */
  actions?: React.ReactNode;
  /** Pinned to the bottom of the sidebar (e.g. TrialCard, usage). */
  sidebarFooter?: React.ReactNode;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

function NavList({
  sections,
  active,
  collapsed,
  onSelect,
}: {
  sections: ShellNavSection[];
  active?: string;
  collapsed: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      {sections.map((s) => (
        <nav
          key={s.id}
          aria-label={s.title ?? "Main"}
          className="flex flex-col gap-0.5 border-b border-crm-border p-2"
        >
          {s.title && !collapsed ? (
            <p className="crm-eyebrow mb-1 px-2 text-[11px] text-crm-faint">{s.title}</p>
          ) : null}
          {s.items.map((it) => {
            const isActive = it.id === active;
            return (
              <button
                key={it.id}
                type="button"
                title={collapsed ? it.label : undefined}
                aria-label={collapsed ? it.label : undefined}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelect(it.id)}
                className={cn(
                  "group relative flex h-8 w-full cursor-pointer items-center gap-2 rounded-crm px-2 text-sm font-medium text-crm-muted-fg outline-none",
                  "transition-colors duration-150 ease-crm hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                  isActive && "bg-crm-muted text-crm-fg shadow-crm-raised",
                  collapsed && "justify-center px-0",
                )}
              >
                {it.dotColor ? (
                  <span className="grid size-3.5 place-items-center">
                    <span className="size-1.5 rounded-full" style={{ background: it.dotColor }} />
                  </span>
                ) : (
                  <span className="text-crm-subtle group-hover:text-crm-icon [&_svg]:size-3.5">
                    {it.icon}
                  </span>
                )}
                {!collapsed ? <span className="flex-1 truncate text-left">{it.label}</span> : null}
                {it.count !== undefined && !collapsed ? <CountBadge>{it.count}</CountBadge> : null}
                {it.count && collapsed ? (
                  <span
                    aria-hidden
                    className="absolute top-1 right-1.5 size-1.5 rounded-full bg-crm-primary"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>
      ))}
    </>
  );
}

/**
 * Classic CRM application shell: collapsible sidebar (Ctrl/Cmd+B) with workspace switcher and
 * sectioned nav, top bar with breadcrumbs, search, notifications and user menu, and a
 * slide-in navigation sheet under 768px.
 */
export function ShellSidebar({
  sections,
  activeId,
  defaultActiveId,
  onNavigate,
  workspaces,
  workspaceId,
  onWorkspaceChange,
  user,
  onSignOut,
  userMenu,
  breadcrumbs,
  notifications,
  onMarkAllRead,
  onSearch,
  actions,
  sidebarFooter,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  children,
  className,
}: ShellSidebarProps) {
  const [innerActive, setInnerActive] = React.useState(
    defaultActiveId ?? sections[0]?.items[0]?.id,
  );
  const [innerCollapsed, setInnerCollapsed] = React.useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const active = activeId ?? innerActive;
  const collapsed = collapsedProp ?? innerCollapsed;

  const setCollapsed = React.useCallback(
    (c: boolean) => {
      if (collapsedProp === undefined) setInnerCollapsed(c);
      onCollapsedChange?.(c);
    },
    [collapsedProp, onCollapsedChange],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed(!collapsed);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, setCollapsed]);

  const select = (id: string) => {
    if (activeId === undefined) setInnerActive(id);
    onNavigate?.(id);
    setMobileOpen(false);
  };

  const unread = notifications?.filter((n) => n.unread).length ?? 0;

  return (
    <div className={cn("flex h-full min-h-0 w-full bg-crm-bg font-crm text-crm-fg", className)}>
      <aside
        aria-label="Sidebar"
        className={cn(
          "hidden h-full shrink-0 flex-col border-r border-crm-border bg-crm-sidebar transition-[width] duration-200 ease-crm md:flex",
          collapsed ? "w-[60px]" : "w-[248px]",
        )}
      >
        <div className="flex items-center gap-1 border-b border-crm-border p-2">
          <WorkspaceSwitcher
            workspaces={workspaces}
            value={workspaceId}
            onValueChange={onWorkspaceChange}
            compact={collapsed}
            className={collapsed ? "mx-auto" : "flex-1"}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList sections={sections} active={active} collapsed={collapsed} onSelect={select} />
        </div>
        {!collapsed && sidebarFooter ? (
          <div className="border-t border-crm-border">{sidebarFooter}</div>
        ) : null}
        <div
          className={cn(
            "flex items-center gap-2 border-t border-crm-border p-2",
            collapsed && "justify-center",
          )}
        >
          {!collapsed ? (
            <UserMenu
              user={user}
              onSignOut={onSignOut}
              trigger="full"
              side="top"
              align="start"
              className="flex-1"
            >
              {userMenu}
            </UserMenu>
          ) : null}
          <IconButton
            label={collapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </IconButton>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" title="Navigation" hideHeader className="p-0">
          <div className="border-b border-crm-border p-2">
            <WorkspaceSwitcher
              workspaces={workspaces}
              value={workspaceId}
              onValueChange={onWorkspaceChange}
            />
          </div>
          <NavList sections={sections} active={active} collapsed={false} onSelect={select} />
          {sidebarFooter}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-crm-border px-4">
          <IconButton
            label="Open navigation"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </IconButton>
          {breadcrumbs?.length ? (
            <Breadcrumbs items={breadcrumbs} className="hidden min-w-0 sm:flex" />
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {onSearch ? (
              <SearchInput
                size="sm"
                variant="subtle"
                shortcut="k"
                placeholder="Search records"
                onSearch={onSearch}
                className="hidden w-56 lg:flex"
              />
            ) : null}
            {actions}
            {notifications ? (
              <NotificationsPopover
                items={notifications}
                onMarkAllRead={onMarkAllRead}
                trigger={
                  <IconButton
                    label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                    dot={unread > 0}
                  >
                    <Bell />
                  </IconButton>
                }
              />
            ) : null}
            <span className="md:hidden">
              <UserMenu user={user} onSignOut={onSignOut}>
                {userMenu}
              </UserMenu>
            </span>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
