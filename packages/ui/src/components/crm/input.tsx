import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Text shown inside the field before the value, e.g. "$". */
  prefix?: string;
  invalid?: boolean;
}

/** Dark text input. Set `invalid` (or aria-invalid) for the red error border. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, prefix, invalid, ...props },
  ref,
) {
  const field = (
    <input
      ref={ref}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      className={cn(
        "h-9 w-full rounded-crm border border-crm-input/60 bg-crm-raised px-3 font-crm text-sm text-crm-fg placeholder:text-crm-subtle",
        "outline-none transition-[border-color,box-shadow] duration-150 ease-crm hover:border-crm-input",
        "focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40",
        "aria-[invalid=true]:border-crm-danger aria-[invalid=true]:ring-crm-danger/20 disabled:cursor-not-allowed disabled:opacity-50",
        "[color-scheme:dark]",
        prefix && "pl-7",
        className,
      )}
      {...props}
    />
  );
  if (!prefix) return field;
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-crm text-sm text-crm-subtle">
        {prefix}
      </span>
      {field}
    </span>
  );
});

export interface FormFieldProps {
  label: string;
  /** id of the control; links label, hint and error. */
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

/** Label + control + hint/error text. Pass aria-describedby={`${htmlFor}-msg`} to the control. */
export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5 font-crm", className)}>
      <label htmlFor={htmlFor} className="text-xs text-crm-soft">
        {label}
        {required ? <span className="text-crm-subtle"> *</span> : null}
      </label>
      {children}
      {error || hint ? (
        <p
          id={`${htmlFor}-msg`}
          role={error ? "alert" : undefined}
          className={cn("text-xs", error ? "text-crm-danger" : "text-crm-subtle")}
        >
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}
