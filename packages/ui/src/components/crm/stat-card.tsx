import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

/** Bordered label + value tile. Put several in a grid. */
export function StatCard({ label, value, icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-crm border border-crm-input/70 p-3 font-crm",
        className,
      )}
    >
      <span className="flex items-center gap-1 text-xs text-crm-soft [&_svg]:size-3">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium text-crm-fg tabular-nums">{value}</span>
    </div>
  );
}

/** Uppercase section title used in sheets and forms ("TEAM PIPELINE"). */
export function SectionLabel({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("crm-eyebrow font-crm font-medium text-crm-fg", className)} {...props} />
  );
}
