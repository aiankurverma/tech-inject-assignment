import * as React from "react";
import { cn } from "@/lib/utils";

export interface SettingsRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  label: React.ReactNode;
  description?: React.ReactNode;
  /** The control: Switch, Select, Button... */
  control: React.ReactNode;
  /** id of the control so the label is clickable and announced. */
  htmlFor?: string;
  /** Leading icon tile. */
  icon?: React.ReactNode;
  /** Small badge next to the label, e.g. <Tag>Beta</Tag>. */
  badge?: React.ReactNode;
  /** Red label for destructive settings (delete workspace...). */
  danger?: boolean;
  disabled?: boolean;
  /** stack: control goes under the text on every width. */
  layout?: "inline" | "stack";
}

/** One settings line: label + description on the left, control on the right. Stacks under 640px. */
export function SettingsRow({
  label,
  description,
  control,
  htmlFor,
  icon,
  badge,
  danger,
  disabled,
  layout = "inline",
  className,
  id,
  ...props
}: SettingsRowProps) {
  const autoId = React.useId();
  const base = id ?? autoId;
  const labelId = `${base}-label`;
  const descId = `${base}-desc`;
  return (
    <div
      id={id}
      role="group"
      aria-labelledby={labelId}
      aria-describedby={description ? descId : undefined}
      aria-disabled={disabled || undefined}
      className={cn(
        "flex flex-col gap-3 py-4 font-crm",
        layout === "inline" && "sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-crm-raised text-crm-soft shadow-crm-raised [&_svg]:size-4"
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            {htmlFor ? (
              <label
                id={labelId}
                htmlFor={htmlFor}
                className={cn(
                  "cursor-pointer text-sm font-medium",
                  danger ? "text-crm-danger" : "text-crm-fg",
                )}
              >
                {label}
              </label>
            ) : (
              <span
                id={labelId}
                className={cn("text-sm font-medium", danger ? "text-crm-danger" : "text-crm-fg")}
              >
                {label}
              </span>
            )}
            {badge}
          </span>
          {description ? (
            <p id={descId} className="text-xs leading-5 text-crm-soft">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className={cn("flex shrink-0 items-center gap-2", disabled && "pointer-events-none")}>
        {control}
      </div>
    </div>
  );
}

export interface SettingsGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional eyebrow heading above the group. */
  heading?: string;
}

/** Stacks SettingsRows with hairline dividers inside a card. */
export function SettingsGroup({ heading, className, children, ...props }: SettingsGroupProps) {
  const id = React.useId();
  return (
    <div className={cn("flex flex-col gap-2 font-crm", className)} {...props}>
      {heading ? (
        <h4 id={id} className="crm-eyebrow px-1 text-crm-subtle">
          {heading}
        </h4>
      ) : null}
      <div
        role="group"
        aria-labelledby={heading ? id : undefined}
        className="divide-y divide-crm-border rounded-xl border border-crm-border bg-crm-card px-4 shadow-crm-raised"
      >
        {children}
      </div>
    </div>
  );
}
