import * as React from "react";
import { cn } from "@/lib/utils";
import { CountBadge } from "@/components/crm/badge";

/** Full-height dark sidebar column. Compose with the parts below. */
export function Sidebar({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn(
        "flex h-full w-[254px] shrink-0 flex-col border-r border-crm-border bg-crm-sidebar font-crm",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarBrand({
  logo,
  title,
  subtitle,
}: {
  logo: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-crm-border px-3 py-3.5">
      <span className="grid size-7 place-items-center rounded-crm bg-crm-muted text-crm-fg shadow-crm-raised [&_svg]:size-4">
        {logo}
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium text-crm-fg">{title}</span>
        {subtitle ? <span className="text-xs text-crm-muted-fg">{subtitle}</span> : null}
      </span>
    </div>
  );
}

export function SidebarSection({
  title,
  className,
  children,
}: {
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <nav
      aria-label={title}
      className={cn("flex flex-col gap-0.5 border-b border-crm-border p-3", className)}
    >
      {title ? <p className="crm-eyebrow mb-1.5 px-0 text-[11px] text-crm-faint">{title}</p> : null}
      {children}
    </nav>
  );
}

export interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  /** Coloured dot instead of an icon (pipelines). */
  dotColor?: string;
  count?: number;
  active?: boolean;
}

/** Navigation row: icon or dot, label, optional count. Active row is raised. */
export function SidebarItem({
  icon,
  dotColor,
  count,
  active,
  className,
  children,
  ...props
}: SidebarItemProps) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      data-active={active || undefined}
      className={cn(
        "group flex h-[30px] w-full cursor-pointer items-center gap-2 rounded-crm px-2 text-sm font-medium text-crm-muted-fg outline-none",
        "transition-[background-color,color,box-shadow] duration-150 ease-crm hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60",
        "data-[active]:h-8 data-[active]:bg-crm-muted data-[active]:text-crm-fg data-[active]:shadow-crm-raised",
        className,
      )}
      {...props}
    >
      {dotColor ? (
        <span className="grid size-3.5 place-items-center">
          <span className="size-1.5 rounded-full" style={{ background: dotColor }} />
        </span>
      ) : (
        <span className="text-crm-subtle transition-colors group-hover:text-crm-icon group-data-[active]:text-crm-icon [&_svg]:size-3.5">
          {icon}
        </span>
      )}
      <span className="flex-1 truncate text-left">{children}</span>
      {count !== undefined ? <CountBadge>{count}</CountBadge> : null}
    </button>
  );
}

export interface TrialCardProps {
  days: number;
  caption?: string;
  action: React.ReactNode;
}

/** Sidebar footer with trial days left and an action button. */
export function TrialCard({ days, caption = "Left on trials", action }: TrialCardProps) {
  return (
    <div className="mt-auto flex items-center justify-between gap-2 border-t border-crm-border px-4 py-4">
      <span className="flex flex-col gap-1.5">
        <span className="text-sm font-medium tracking-[-0.01em] text-crm-fg">{days} Days</span>
        <span className="text-xs text-crm-muted-fg">{caption}</span>
      </span>
      {action}
    </div>
  );
}
