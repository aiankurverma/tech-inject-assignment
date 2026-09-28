import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned header actions, e.g. a "Reset" button. */
  actions?: React.ReactNode;
  /** Footer row, e.g. Cancel / Save buttons. */
  footer?: React.ReactNode;
  /** card: bordered panel. plain: no chrome. split: title column left, fields right (stacks on mobile). */
  variant?: "card" | "plain" | "split";
}

/** Titled group of form fields with description, optional actions and footer. Labelled for screen readers. */
export function FormSection({
  title,
  description,
  actions,
  footer,
  variant = "card",
  className,
  children,
  id,
  ...props
}: FormSectionProps) {
  const autoId = React.useId();
  const base = id ?? autoId;
  const titleId = `${base}-title`;
  const descId = `${base}-desc`;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cn(
        "font-crm",
        variant === "card" && "rounded-xl border border-crm-border bg-crm-card shadow-crm-raised",
        variant === "split" &&
          "grid gap-6 border-b border-crm-border py-6 md:grid-cols-[minmax(0,240px)_1fr]",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-4",
          variant === "card" && "border-b border-crm-border px-5 py-4",
          variant === "split" && "md:flex-col md:justify-start",
        )}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={titleId} className="text-sm font-medium text-crm-fg">
            {title}
          </h3>
          {description ? (
            <p id={descId} className="text-xs leading-5 text-crm-soft">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="flex min-w-0 flex-col">
        <div
          className={cn(
            "flex flex-col gap-4",
            variant === "card" && "px-5 py-4",
            variant === "plain" && "pt-4",
          )}
        >
          {children}
        </div>
        {footer ? (
          <div
            className={cn(
              "flex items-center justify-end gap-2",
              variant === "card" ? "border-t border-crm-border px-5 py-3" : "pt-4",
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </section>
  );
}
