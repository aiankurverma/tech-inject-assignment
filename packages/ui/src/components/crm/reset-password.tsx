import * as React from "react";
import { Check, CheckCircle2, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/crm/alert";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { FormField } from "@/components/crm/input";
import { PasswordInput } from "@/components/crm/password-input";

export interface ResetPasswordPolicy {
  minLength?: number;
  requireUpper?: boolean;
  requireNumber?: boolean;
  requireSymbol?: boolean;
}

export interface ResetPasswordProps {
  /** Account email; shown to the user and used to reject passwords containing it. */
  email: string;
  /** When the reset token expires. Past dates show the expired state immediately. */
  expiresAt?: Date | string | number;
  policy?: ResetPasswordPolicy;
  /** Return true if the password matches one of the last N passwords (server-side check). */
  isReused?: (password: string) => Promise<boolean> | boolean;
  /** Save the new password. Resolve a string (or throw) to show an error. */
  onSubmit: (
    password: string,
    options: { signOutOtherSessions: boolean },
  ) => Promise<string | void> | string | void;
  onRequestNewLink?: () => void;
  onContinue?: () => void;
  className?: string;
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Set a new password from a reset link: policy checklist, match check, reuse check, token expiry countdown. */
export function ResetPassword({
  email,
  expiresAt,
  policy = {},
  isReused,
  onSubmit,
  onRequestNewLink,
  onContinue,
  className,
}: ResetPasswordProps) {
  const {
    minLength = 12,
    requireUpper = true,
    requireNumber = true,
    requireSymbol = true,
  } = policy;
  const id = React.useId();
  const [pw, setPw] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [signOut, setSignOut] = React.useState(true);
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const expiry = expiresAt !== undefined ? new Date(expiresAt).getTime() : null;
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (expiry === null || done) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [expiry, done]);

  const remaining = expiry === null ? Infinity : expiry - now;
  const expired = remaining <= 0;
  const local = email.split("@")[0]?.toLowerCase() ?? "";

  const rules = [
    { label: `At least ${minLength} characters`, ok: pw.length >= minLength },
    ...(requireUpper ? [{ label: "One uppercase letter", ok: /[A-Z]/.test(pw) }] : []),
    ...(requireNumber ? [{ label: "One number", ok: /\d/.test(pw) }] : []),
    ...(requireSymbol ? [{ label: "One symbol (!@#...)", ok: /[^A-Za-z0-9]/.test(pw) }] : []),
    {
      label: "Doesn't contain your email",
      ok: pw.length > 0 && (local.length < 3 || !pw.toLowerCase().includes(local)),
    },
  ];
  const allOk = rules.every((r) => r.ok);
  const mismatch = confirm.length > 0 && confirm !== pw;

  const shell = cn(
    "mx-auto flex w-full max-w-sm flex-col gap-6 rounded-crm border border-crm-border bg-crm-card p-6 font-crm shadow-crm-raised sm:p-8",
    className,
  );

  if (done) {
    return (
      <div className={shell}>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="size-10 text-crm-success" aria-hidden />
          <h1 className="text-lg font-semibold text-crm-fg">Password updated</h1>
          <p className="text-sm text-crm-soft" role="status">
            You can now sign in with your new password.
            {signOut ? " All other sessions were signed out." : ""}
          </p>
        </div>
        {onContinue ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full justify-center"
            onClick={onContinue}
          >
            Continue to sign in
          </Button>
        ) : null}
      </div>
    );
  }

  if (expired) {
    return (
      <div className={shell}>
        <Alert tone="warning" title="This reset link has expired" icon={<Clock />}>
          For your security, reset links only work for a short time and only once.
        </Alert>
        {onRequestNewLink ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full justify-center"
            onClick={onRequestNewLink}
          >
            Send me a new link
          </Button>
        ) : null}
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!allOk || confirm !== pw || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (isReused && (await isReused(pw))) {
        setError("You've used this password recently. Choose one you haven't used before.");
        return;
      }
      const res = await onSubmit(pw, { signOutOtherSessions: signOut });
      if (typeof res === "string") setError(res);
      else setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={shell}>
      <header className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold text-crm-fg">Choose a new password</h1>
        <p className="text-sm text-crm-soft">
          For <span className="text-crm-fg">{email}</span>
        </p>
        {expiry !== null ? (
          <p
            className={cn(
              "flex items-center gap-1.5 text-xs",
              remaining < 5 * 60_000 ? "text-crm-warning" : "text-crm-subtle",
            )}
          >
            <Clock className="size-3.5" aria-hidden />
            Link expires in <span className="tabular-nums">{fmt(remaining)}</span>
          </p>
        ) : null}
      </header>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4" aria-busy={loading}>
        {error ? (
          <Alert tone="danger" title="Password not saved">
            {error}
          </Alert>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-pw`} className="text-xs text-crm-soft">
            New password <span className="text-crm-subtle">*</span>
          </label>
          <PasswordInput
            id={`${id}-pw`}
            autoComplete="new-password"
            autoFocus
            showStrength
            value={pw}
            invalid={submitted && !allOk}
            aria-describedby={`${id}-rules`}
            onChange={(e) => setPw(e.target.value)}
          />
          <ul
            id={`${id}-rules`}
            className="mt-1 flex flex-col gap-1"
            aria-label="Password requirements"
          >
            {rules.map((r) => (
              <li
                key={r.label}
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  r.ok ? "text-crm-success" : submitted ? "text-crm-danger" : "text-crm-subtle",
                )}
              >
                {r.ok ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <X className="size-3.5" aria-hidden />
                )}
                {r.label}
                <span className="sr-only">{r.ok ? "(met)" : "(not met)"}</span>
              </li>
            ))}
          </ul>
        </div>
        <FormField
          label="Confirm new password"
          htmlFor={`${id}-confirm`}
          required
          error={
            mismatch
              ? "Passwords don't match."
              : submitted && !confirm
                ? "Confirm your new password."
                : undefined
          }
        >
          <PasswordInput
            id={`${id}-confirm`}
            autoComplete="new-password"
            value={confirm}
            invalid={mismatch}
            aria-describedby={`${id}-confirm-msg`}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </FormField>
        <label className="flex cursor-pointer items-start gap-2 text-xs text-crm-soft">
          <Checkbox
            className="mt-0.5"
            checked={signOut}
            onCheckedChange={(c) => setSignOut(c === true)}
          />
          Sign out of all other devices (recommended if you think someone else knows your password)
        </label>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full justify-center"
          loading={loading}
        >
          Update password
        </Button>
      </form>
    </div>
  );
}
