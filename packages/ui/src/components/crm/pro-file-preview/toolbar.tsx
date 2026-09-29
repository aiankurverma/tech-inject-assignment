import * as React from "react";
import { cn } from "@/lib/utils";

/** Compact icon button used by every viewer toolbar. */
export const ToolButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }
>(function ToolButton({ label, active, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-crm px-1.5 text-crm-muted-fg transition-colors",
        "hover:bg-crm-muted hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        active && "bg-crm-muted text-crm-fg",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

export function Toolbar({
  className,
  children,
  label,
}: {
  className?: string;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cn(
        "flex h-11 shrink-0 items-center gap-1 border-b border-crm-border bg-crm-card px-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-crm-border" />;
}

export function ViewerMessage({
  icon,
  title,
  detail,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  detail?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex h-full min-h-48 flex-col items-center justify-center gap-2 p-6 text-center"
    >
      {icon && <div className="text-crm-muted-fg">{icon}</div>}
      <p className="text-sm font-medium text-crm-fg">{title}</p>
      {detail && <p className="max-w-sm text-xs text-crm-muted-fg">{detail}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex h-full min-h-48 items-center justify-center"
    >
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-crm-border border-t-crm-primary" />
    </div>
  );
}
