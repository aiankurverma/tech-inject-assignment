import * as React from "react";
import { cn } from "@/lib/utils";
import { FIELD_LABELS, type CheckoutField } from "@/components/crm/pro-checkout-flow/schema";

export const inputCls =
  "h-9 w-full rounded-crm border border-crm-input bg-crm-bg px-3 text-sm text-crm-fg outline-none placeholder:text-crm-subtle focus-visible:ring-2 focus-visible:ring-crm-ring aria-invalid:border-crm-danger disabled:opacity-50";

export const fieldId = (formId: string, name: string) => `${formId}-${name}`;

export interface FieldProps {
  formId: string;
  name: CheckoutField;
  label?: string;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  /** Receives the a11y props to spread on the control. */
  children: (a11y: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
}

/** Label + control + hint + inline error, wired with aria-describedby. */
export function Field({ formId, name, label, error, hint, className, children }: FieldProps) {
  const id = fieldId(formId, name);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-xs text-crm-soft">
        {label ?? FIELD_LABELS[name]}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-crm-muted-fg">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="text-xs text-crm-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export interface ErrorSummaryProps {
  formId: string;
  errors: { name: CheckoutField; message: string }[];
  onJump: (name: CheckoutField) => void;
}

/**
 * GOV.UK-style error summary: receives focus when it appears, lists every error as a link that
 * moves focus to the offending field.
 */
export function ErrorSummary({ formId, errors, onJump }: ErrorSummaryProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const key = errors.map((e) => e.name).join();
  React.useEffect(() => {
    if (errors.length) ref.current?.focus();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!errors.length) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby={`${formId}-errsum`}
      className="rounded-crm border border-crm-danger/50 bg-crm-danger/10 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-crm-danger"
    >
      <h3 id={`${formId}-errsum`} className="font-medium text-crm-danger">
        There {errors.length === 1 ? "is a problem" : `are ${errors.length} problems`}
      </h3>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-crm-fg">
        {errors.map((e) => (
          <li key={e.name}>
            <a
              href={`#${fieldId(formId, e.name)}`}
              className="underline underline-offset-2 hover:text-crm-danger"
              onClick={(ev) => {
                ev.preventDefault();
                onJump(e.name);
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
