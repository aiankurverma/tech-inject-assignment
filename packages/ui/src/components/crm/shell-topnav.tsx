import * as React from "react";
import { Bell, ChevronDown, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/crm/button";
import { CountBadge } from "@/components/crm/badge";
import { SearchInput } from "@/components/crm/search-input";
import { NotificationsPopover, type Notification } from "@/components/crm/notifications";
import { UserMenu, type UserMenuUser } from "@/components/crm/user-menu";
import { WorkspaceSwitcher, type Workspace } from "@/components/crm/workspace-switcher";
import { Sheet, SheetContent } from "@/components/crm/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/crm/dropdown-menu";

export interface TopNavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

export interface ShellTopnavProps {
  items: TopNavItem[];
  activeId?: string;
  defaultActiveId?: string;
  onNavigate?: (id: string) => void;
  workspaces: Workspace[];
  workspaceId?: string;
  onWorkspaceChange?: (id: string) => void;
  user: UserMenuUser;
  onSignOut?: () => void;
  userMenu?: React.ReactNode;
  notifications?: Notification[];
  onMarkAllRead?: () => void;
  onSearch?: (q: string) => void;
  actions?: React.ReactNode;
  /** Secondary bar under the main nav: page title, filters, tabs. */
  subheader?: React.ReactNode;
  /** Constrain content to a centered max width. */
  contained?: boolean;
  children: React.ReactNode;
  className?: string;
}

const MORE_WIDTH = 84;

/**
 * Top-navigation application shell. Nav items that do not fit move into a "More" menu
 * (measured with ResizeObserver, keeping the active item visible); under 768px the nav
 * collapses into a sheet.
 */
export function ShellTopnav({
  items,
  activeId,
  defaultActiveId,
  onNavigate,
  workspaces,
  workspaceId,
  onWorkspaceChange,
  user,
  onSignOut,
  userMenu,
  notifications,
  onMarkAllRead,
  onSearch,
  actions,
  subheader,
  contained = true,
  children,
  className,
}: ShellTopnavProps) {
  const [innerActive, setInnerActive] = React.useState(defaultActiveId ?? items[0]?.id);
  const [visibleCount, setVisibleCount] = React.useState(items.length);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const navRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const active = activeId ?? innerActive;

  React.useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure || typeof ResizeObserver === "undefined") return;
    const compute = () => {
      const widths = [...measure.children].map((c) => (c as HTMLElement).offsetWidth + 4);
      const available = nav.clientWidth;
      const total = widths.reduce((s, w) => s + w, 0);
      if (total <= available) return setVisibleCount(items.length);
      let used = MORE_WIDTH;
      let n = 0;
      while (n < widths.length && used + (widths[n] ?? 0) <= available) used += widths[n++] ?? 0;
      setVisibleCount(Math.max(0, n));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [items]);

  // Keep the active item visible: swap it into the last visible slot when it overflows.
  const ordered = React.useMemo(() => {
    const idx = items.findIndex((i) => i.id === active);
    if (idx < visibleCount || visibleCount === 0) return items;
    const copy = [...items];
    const [a] = copy.splice(idx, 1);
    if (a) copy.splice(visibleCount - 1, 0, a);
    return copy;
  }, [items, active, visibleCount]);
  const visible = ordered.slice(0, visibleCount);
  const overflow = ordered.slice(visibleCount);

  const select = (id: string) => {
    if (activeId === undefined) setInnerActive(id);
    onNavigate?.(id);
    setMobileOpen(false);
  };

  const unread = notifications?.filter((n) => n.unread).length ?? 0;

  const tab = (it: TopNavItem) => (
    <button
      key={it.id}
      type="button"
      aria-current={it.id === active ? "page" : undefined}
      onClick={() => select(it.id)}
      className={cn(
        "relative flex h-14 shrink-0 cursor-pointer items-center gap-1.5 px-2.5 text-sm font-medium whitespace-nowrap text-crm-muted-fg outline-none",
        "transition-colors duration-150 ease-crm hover:text-crm-fg focus-visible:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:ring-inset",
        "[&_svg]:size-3.5",
        it.id === active &&
          "text-crm-fg after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-crm-primary",
      )}
    >
      {it.icon}
      {it.label}
      {it.count !== undefined ? <CountBadge>{it.count}</CountBadge> : null}
    </button>
  );

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col bg-crm-bg font-crm text-crm-fg",
        className,
      )}
    >
      <header className="shrink-0 border-b border-crm-border bg-crm-sidebar">
        <div
          className={cn("flex h-14 items-center gap-3 px-4", contained && "mx-auto max-w-[1280px]")}
        >
          <IconButton
            label="Open navigation"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </IconButton>
          <WorkspaceSwitcher
            workspaces={workspaces}
            value={workspaceId}
            onValueChange={onWorkspaceChange}
            className="max-w-[200px] shrink-0"
          />
          <div ref={navRef} className="relative hidden min-w-0 flex-1 md:block">
            <div
              ref={measureRef}
              aria-hidden
              className="pointer-events-none invisible absolute top-0 left-0 flex"
            >
              {items.map((it) => (
                <span
                  key={it.id}
                  className="flex shrink-0 items-center gap-1.5 px-2.5 text-sm font-medium whitespace-nowrap [&_svg]:size-3.5"
                >
                  {it.icon}
                  {it.label}
                  {it.count !== undefined ? <CountBadge>{it.count}</CountBadge> : null}
                </span>
              ))}
            </div>
            <nav aria-label="Main" className="flex items-center">
              {visible.map(tab)}
              {overflow.length ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex h-14 cursor-pointer items-center gap-1 px-2.5 text-sm font-medium text-crm-muted-fg outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:ring-inset"
                    aria-label={`${overflow.length} more sections`}
                  >
                    More <ChevronDown className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {overflow.map((it) => (
                      <DropdownMenuItem key={it.id} onSelect={() => select(it.id)}>
                        {it.icon}
                        <span className="flex-1">{it.label}</span>
                        {it.count !== undefined ? <CountBadge>{it.count}</CountBadge> : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </nav>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {onSearch ? (
              <SearchInput
                size="sm"
                variant="subtle"
                shortcut="k"
                placeholder="Search"
                onSearch={onSearch}
                className="hidden w-48 xl:flex"
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
            <UserMenu user={user} onSignOut={onSignOut}>
              {userMenu}
            </UserMenu>
          </div>
        </div>
        {subheader ? (
          <div className="border-t border-crm-border">
            <div className={cn("px-4 py-3", contained && "mx-auto max-w-[1280px]")}>
              {subheader}
            </div>
          </div>
        ) : null}
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" title="Navigation">
          <nav aria-label="Main" className="flex flex-col gap-0.5 p-2">
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                aria-current={it.id === active ? "page" : undefined}
                onClick={() => select(it.id)}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-crm px-2 text-sm text-crm-muted-fg outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3.5",
                  it.id === active && "bg-crm-muted text-crm-fg shadow-crm-raised",
                )}
              >
                {it.icon}
                <span className="flex-1 text-left">{it.label}</span>
                {it.count !== undefined ? <CountBadge>{it.count}</CountBadge> : null}
              </button>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn(contained && "mx-auto max-w-[1280px]")}>{children}</div>
      </main>
    </div>
  );
}
