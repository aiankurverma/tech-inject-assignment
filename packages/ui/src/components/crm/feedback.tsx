import * as React from "react";
import { cn } from "@/lib/utils";

/** Pulsing placeholder block while data loads. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-crm bg-crm-muted", className)}
      {...props}
    />
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: "neutral" | "error";
  className?: string;
}

/** Centered message for empty lists and error states. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: EmptyStateProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center font-crm",
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            "grid size-10 place-items-center rounded-full bg-crm-muted shadow-crm-raised [&_svg]:size-4",
            tone === "error" ? "text-crm-danger" : "text-crm-soft",
          )}
        >
          {icon}
        </span>
      ) : null}
      <div>
        <p className="text-sm font-medium text-crm-fg">{title}</p>
        {description ? <p className="mt-1 max-w-sm text-xs text-crm-soft">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
