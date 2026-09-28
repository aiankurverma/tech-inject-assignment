import * as React from "react";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/crm/dropdown-menu";

export interface UserMenuUser {
  name: string;
  email: string;
  avatarUrl?: string;
  /** e.g. "Admin", "Pro plan". */
  role?: string;
}

export interface UserMenuProps {
  user: UserMenuUser;
  /** Menu items (DropdownMenuItem, DropdownMenuSeparator, ...) between the header and sign-out. */
  children?: React.ReactNode;
  onSignOut?: () => void;
  /** "avatar": round avatar button (top bars). "full": avatar + name row (sidebar footers). */
  trigger?: "avatar" | "full";
  /** Presence dot on the avatar. */
  status?: "online" | "away" | "busy" | "offline";
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

const statusColor = {
  online: "bg-crm-success",
  away: "bg-crm-warning",
  busy: "bg-crm-danger",
  offline: "bg-crm-faint",
} as const;

/** Avatar menu: identity header, account links and sign out. Keyboard navigation via Radix. */
export function UserMenu({
  user,
  children,
  onSignOut,
  trigger = "avatar",
  status,
  align = "end",
  side = "bottom",
  className,
}: UserMenuProps) {
  const avatar = (
    <span className="relative inline-flex">
      <Avatar name={user.name} src={user.avatarUrl} size="md" />
      {status ? (
        <span
          aria-hidden
          className={cn(
            "absolute right-0 bottom-0 size-2 rounded-full ring-2 ring-crm-bg",
            statusColor[status],
          )}
        />
      ) : null}
    </span>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger === "avatar" ? (
          <button
            type="button"
            aria-label={`Account menu for ${user.name}${status ? ` (${status})` : ""}`}
            className={cn(
              "inline-flex cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
              className,
            )}
          >
            {avatar}
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Account menu for ${user.name}`}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-1.5 text-left font-crm outline-none",
              "transition-colors duration-150 ease-crm hover:bg-crm-raised focus-visible:ring-2 focus-visible:ring-crm-ring/60 data-[state=open]:bg-crm-raised",
              className,
            )}
          >
            {avatar}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-crm-fg">{user.name}</span>
              <span className="block truncate text-xs text-crm-subtle">{user.email}</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-crm-subtle" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="w-[240px]">
        <div className="flex items-center gap-2.5 px-2 pt-2 pb-2.5">
          <Avatar name={user.name} src={user.avatarUrl} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-crm-fg">{user.name}</p>
            <p className="truncate text-xs text-crm-subtle">{user.email}</p>
          </div>
          {user.role ? (
            <span className="rounded-full border border-tag-purple-border bg-tag-purple-bg px-1.5 text-[10px] leading-4 text-tag-purple-text">
              {user.role}
            </span>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {children}
        {onSignOut ? (
          <>
            {children ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem icon={<LogOut />} onSelect={onSignOut}>
              Sign out
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
