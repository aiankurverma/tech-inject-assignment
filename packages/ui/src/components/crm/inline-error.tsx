import * as React from "react";
import { AlertTriangle, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  error: { text: "text-crm-danger", Icon: CircleAlert },
  warning: { text: "text-crm-warning", Icon: AlertTriangle },
} as const;

export interface InlineErrorProps {
  /** One message, several (rendered as a list), or nothing (renders nothing). */
  message?: string | string[] | null;
  /** Id to reference from the field's `aria-describedby`. Use `useFieldError` to wire both sides. */
  id?: string;
  tone?: keyof typeof tones;
  /** Optional fix-it action, e.g. "Use suggested address". */
  action?: { label: string; onClick: () => void };
  className?: string;
}

/**
 * Field-level validation text. Announced politely when it appears, lists multiple rules,
 * and supports a one-click fix action.
 */
export function InlineError({ message, id, tone = "error", action, className }: InlineErrorProps) {
  const list = (Array.isArray(message) ? message : message ? [message] : []).filter(Boolean);
  const { text, Icon } = tones[tone];
  return (
    <div id={id} aria-live="polite" aria-atomic="true" className={cn("font-crm", className)}>
      {list.length > 0 && (
        <div className={cn("mt-1 flex items-start gap-1.5 text-xs leading-4", text)}>
          <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
          <div className="min-w-0">
            {list.length === 1 ? (
              <p>{list[0]}</p>
            ) : (
              <ul className="list-disc space-y-0.5 pl-3.5 marker:text-current/60">
                {list.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            {action && (
              <button
                type="button"
                onClick={action.onClick}
                className="mt-0.5 cursor-pointer rounded text-crm-fg underline decoration-crm-input underline-offset-2 outline-none hover:decoration-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary"
              >
                {action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export type Validator<T> = (value: T) => string | null | undefined | false;

export interface UseFieldErrorOptions<T> {
  value: T;
  rules: Validator<T>[];
  /** Validate immediately instead of after first blur. */
  eager?: boolean;
}

/**
 * Runs rules against a value and returns ready-to-spread props for the input and the error.
 * Errors appear after the first blur (or submit via `touch()`), then update live while typing.
 */
export function useFieldError<T>({ value, rules, eager = false }: UseFieldErrorOptions<T>) {
  const id = React.useId();
  const [touched, setTouched] = React.useState(eager);
  const messages = rules
    .map((r) => r(value))
    .filter((m): m is string => typeof m === "string" && !!m);
  const show = touched && messages.length > 0;
  return {
    valid: messages.length === 0,
    messages,
    touch: () => setTouched(true),
    reset: () => setTouched(eager),
    inputProps: {
      "aria-invalid": show || undefined,
      "aria-describedby": show ? `${id}-err` : undefined,
      onBlur: () => setTouched(true),
    },
    errorProps: { id: `${id}-err`, message: show ? messages : null },
  };
}
