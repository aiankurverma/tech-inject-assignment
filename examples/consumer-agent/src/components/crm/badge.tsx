import * as React from "react";
import { cn } from "@/lib/utils";

/** Small pill counter used in navigation ("241") and headers. */
export function CountBadge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "crm-caption inline-flex h-4 min-w-6 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[#414141] bg-crm-muted px-1 text-center font-crm text-crm-chip shadow-[0_0_0_0.5px_#0e0e0e]",
        className,
      )}
      {...props}
    />
  );
}

const dots = {
  active: "bg-crm-status",
  warning: "bg-crm-warning",
  danger: "bg-crm-danger",
  neutral: "bg-crm-subtle",
} as const;

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: keyof typeof dots;
}

/** Dot + label pill, e.g. "Active". */
export function StatusBadge({
  status = "active",
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "crm-caption inline-flex shrink-0 items-center gap-1 rounded-full border border-[#363636] bg-crm-muted py-[3px] pr-[6px] pl-[4px] font-crm text-crm-fg",
        className,
      )}
      {...props}
    >
      <span className={cn("size-1.5 rounded-full", dots[status])} aria-hidden />
      {children}
    </span>
  );
}
