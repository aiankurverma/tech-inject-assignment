import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";

export interface PageHeaderProps {
  title: string;
  /** Next to the title, e.g. a StatusBadge. */
  badge?: React.ReactNode;
  /** Right side: icon buttons, profile chip. */
  actions?: React.ReactNode;
  /** Left of the title on small screens, e.g. a menu IconButton. */
  leading?: React.ReactNode;
  className?: string;
}

/** Top bar of a page: title + badge on the left, actions on the right. */
export function PageHeader({ title, badge, actions, leading, className }: PageHeaderProps) {
  return (
    <header className={cn("flex h-14 items-center gap-3 px-4 font-crm", className)}>
      {leading}
      <h1 className="truncate text-base font-medium text-crm-fg">{title}</h1>
      {badge}
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export interface ProfileChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  name: string;
  avatar?: string;
  /** Hide the name (compact, e.g. on mobile). */
  compact?: boolean;
}

/** Avatar + name pill that opens the user's profile. */
export const ProfileChip = React.forwardRef<HTMLButtonElement, ProfileChipProps>(
  function ProfileChip({ name, avatar, compact, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={`Open profile for ${name}`}
        className={cn(
          "inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-crm-raised font-crm text-xs text-crm-fg shadow-crm-raised outline-none",
          "transition-colors duration-150 ease-crm hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60",
          compact ? "w-[30px] justify-center" : "py-[5px] pr-[9px] pl-[5px]",
          className,
        )}
        {...props}
      >
        <Avatar name={name} src={avatar} size="sm" />
        {compact ? null : name}
      </button>
    );
  },
);
