import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "raised" | "outline";
  /** Adds hover and focus-visible styles for clickable cards (pair with onClick + tabIndex or wrap a link). */
  interactive?: boolean;
}

/** Surface container. Compose with CardHeader, CardBody and CardFooter. */
export function Card({ variant = "default", interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-crm font-crm text-crm-fg",
        variant === "default" && "border border-crm-border bg-crm-card",
        variant === "raised" && "bg-crm-raised shadow-crm-raised",
        variant === "outline" && "border border-crm-input/60 bg-transparent",
        interactive &&
          "cursor-pointer outline-none transition-colors hover:border-crm-input focus-visible:ring-2 focus-visible:ring-crm-ring/60",
        className,
      )}
      {...props}
    />
  );
}

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned slot, e.g. a menu or button. */
  action?: React.ReactNode;
  /** Draws a divider under the header. */
  bordered?: boolean;
}

export function CardHeader({
  title,
  description,
  action,
  bordered = false,
  className,
  children,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 pt-4",
        bordered ? "border-b border-crm-border pb-3" : "pb-0",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        {title ? <h3 className="truncate text-sm leading-5 font-medium">{title}</h3> : null}
        {description ? (
          <p className="mt-0.5 text-xs leading-4 text-crm-muted-fg">{description}</p>
        ) : null}
        {children}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 p-4 text-sm text-crm-chip", className)} {...props} />;
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Draws a divider above the footer. */
  bordered?: boolean;
}

export function CardFooter({ bordered = true, className, ...props }: CardFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 px-4 py-3",
        bordered && "border-t border-crm-border",
        className,
      )}
      {...props}
    />
  );
}
