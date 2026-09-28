import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

/** Heuristic 0-4 score from length, mixed case, digits and symbols; very short input caps at 1. */
export function scorePassword(pw: string): PasswordStrength {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (pw.length < 8) s = Math.min(s, 1);
  return Math.min(4, s) as PasswordStrength;
}

const LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"] as const;
const TONES = [
  "bg-crm-danger",
  "bg-crm-danger",
  "bg-crm-warning",
  "bg-crm-success",
  "bg-crm-success",
] as const;

export interface PasswordInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  /** Show the four-segment strength meter below the field. */
  showStrength?: boolean;
  /** Custom scorer; defaults to scorePassword. */
  getStrength?: (value: string) => PasswordStrength;
  invalid?: boolean;
}

/** Password field with an accessible show/hide toggle and an optional live strength meter. */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      showStrength,
      getStrength = scorePassword,
      invalid,
      className,
      disabled,
      id,
      value,
      defaultValue,
      onChange,
      autoComplete = "current-password",
      ...props
    },
    ref,
  ) {
    const [visible, setVisible] = React.useState(false);
    const [inner, setInner] = React.useState(String(defaultValue ?? ""));
    const current = value !== undefined ? String(value) : inner;
    const autoId = React.useId();
    const fieldId = id ?? autoId;
    const score = getStrength(current);

    return (
      <div className={cn("flex w-full flex-col gap-1.5 font-crm", className)}>
        <div
          className={cn(
            "flex h-9 w-full items-center rounded-crm border border-crm-input/60 bg-crm-raised pr-1 pl-3",
            "transition-[border-color,box-shadow] duration-150 ease-crm hover:border-crm-input",
            "focus-within:border-crm-ring focus-within:ring-2 focus-within:ring-crm-ring/40",
            invalid && "border-crm-danger ring-crm-danger/20",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <input
            ref={ref}
            id={fieldId}
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            spellCheck={false}
            autoCapitalize="off"
            aria-invalid={invalid || undefined}
            aria-describedby={showStrength ? `${fieldId}-strength` : undefined}
            disabled={disabled}
            value={value}
            defaultValue={value === undefined ? defaultValue : undefined}
            onChange={(e) => {
              if (value === undefined) setInner(e.target.value);
              onChange?.(e);
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-crm-fg outline-none placeholder:text-crm-subtle disabled:cursor-not-allowed"
            {...props}
          />
          <button
            type="button"
            disabled={disabled}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            aria-controls={fieldId}
            onClick={() => setVisible((v) => !v)}
            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-[6px] text-crm-subtle outline-none transition-colors duration-150 hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed [&_svg]:size-3.5"
          >
            {visible ? <EyeOff /> : <Eye />}
          </button>
        </div>
        {showStrength ? (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1" aria-hidden>
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors duration-200",
                    current && score >= i ? TONES[score] : "bg-crm-track",
                  )}
                />
              ))}
            </div>
            <span
              id={`${fieldId}-strength`}
              aria-live="polite"
              className="w-16 text-right text-[11px] text-crm-subtle"
            >
              {current ? `${LABELS[score]}` : ""}
              <span className="sr-only">{current ? " password" : ""}</span>
            </span>
          </div>
        ) : null}
      </div>
    );
  },
);
