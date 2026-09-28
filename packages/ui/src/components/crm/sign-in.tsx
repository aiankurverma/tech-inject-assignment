import * as React from "react";
import { KeyRound, Lock, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/crm/alert";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { FormField, Input } from "@/components/crm/input";
import { PasswordInput } from "@/components/crm/password-input";

export interface SignInProvider {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface SignInValues {
  email: string;
  password: string;
  remember: boolean;
}

export interface SignInProps {
  /** Resolve to sign in; resolve a string (or throw) to show that error and count a failed attempt. */
  onSubmit: (values: SignInValues) => Promise<string | void> | string | void;
  /** Send a one-time sign-in link instead of a password. Enables the "Email me a link" mode. */
  onMagicLink?: (email: string) => Promise<string | void> | string | void;
  providers?: SignInProvider[];
  onProviderClick?: (id: string) => void;
  onForgotPassword?: (email: string) => void;
  onSignUp?: () => void;
  /** Failed attempts before the form locks. */
  maxAttempts?: number;
  /** Lockout length in seconds. */
  lockoutSeconds?: number;
  defaultEmail?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Logo or product mark above the title. */
  logo?: React.ReactNode;
  className?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Email + password sign-in with SSO buttons, magic-link mode, caps-lock hint and attempt lockout. */
export function SignIn({
  onSubmit,
  onMagicLink,
  providers = [],
  onProviderClick,
  onForgotPassword,
  onSignUp,
  maxAttempts = 5,
  lockoutSeconds = 30,
  defaultEmail = "",
  title = "Sign in to your workspace",
  description = "Welcome back. Enter your work email to continue.",
  logo,
  className,
}: SignInProps) {
  const id = React.useId();
  const [mode, setMode] = React.useState<"password" | "link">("password");
  const [email, setEmail] = React.useState(defaultEmail);
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [touched, setTouched] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [linkSentTo, setLinkSentTo] = React.useState<string | null>(null);
  const [failures, setFailures] = React.useState(0);
  const [lockedUntil, setLockedUntil] = React.useState<number | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const [capsLock, setCapsLock] = React.useState(false);

  React.useEffect(() => {
    if (!lockedUntil) return;
    const t = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) {
        setLockedUntil(null);
        setFailures(0);
        setError(null);
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [lockedUntil]);

  const locked = lockedUntil !== null && now < lockedUntil;
  const secondsLeft = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const emailError =
    touched && !EMAIL_RE.test(email.trim()) ? "Enter a valid email address." : undefined;
  const passwordError =
    touched && mode === "password" && !password ? "Enter your password." : undefined;

  const fail = (message: string) => {
    const next = failures + 1;
    setFailures(next);
    if (next >= maxAttempts) {
      setLockedUntil(Date.now() + lockoutSeconds * 1000);
      setNow(Date.now());
      setError(null);
    } else {
      const left = maxAttempts - next;
      setError(`${message} ${left} attempt${left === 1 ? "" : "s"} left before a short lockout.`);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (locked || loading) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) return;
    if (mode === "password" && !password) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "link" && onMagicLink) {
        const res = await onMagicLink(cleanEmail);
        if (typeof res === "string") setError(res);
        else setLinkSentTo(cleanEmail);
      } else {
        const res = await onSubmit({ email: cleanEmail, password, remember });
        if (typeof res === "string") fail(res);
        else setFailures(0);
      }
    } catch (err) {
      if (mode === "password") fail(err instanceof Error ? err.message : "Sign-in failed.");
      else setError(err instanceof Error ? err.message : "Could not send the link.");
    } finally {
      setLoading(false);
    }
  };

  const onPwKey = (e: React.KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(e.getModifierState?.("CapsLock") ?? false);

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-sm flex-col gap-6 rounded-crm border border-crm-border bg-crm-card p-6 font-crm shadow-crm-raised sm:p-8",
        className,
      )}
    >
      <header className="flex flex-col gap-2 text-center">
        {logo ? <div className="mx-auto mb-2">{logo}</div> : null}
        <h1 className="text-lg font-semibold text-crm-fg">{title}</h1>
        {description ? <p className="text-sm text-crm-soft">{description}</p> : null}
      </header>

      {providers.length ? (
        <>
          <div className="flex flex-col gap-2">
            {providers.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="lg"
                className="w-full justify-center"
                disabled={locked || loading}
                onClick={() => onProviderClick?.(p.id)}
              >
                {p.icon ?? <KeyRound />}
                Continue with {p.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-crm-border" />
            <span className="crm-caption text-crm-subtle">or</span>
            <span className="h-px flex-1 bg-crm-border" />
          </div>
        </>
      ) : null}

      {linkSentTo ? (
        <div className="flex flex-col gap-4">
          <Alert tone="success" title="Check your inbox">
            We sent a sign-in link to <span className="text-crm-fg">{linkSentTo}</span>. It expires
            in 15 minutes.
          </Alert>
          <Button type="button" variant="ghost" onClick={() => setLinkSentTo(null)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4" aria-busy={loading}>
          {locked ? (
            <Alert tone="danger" title="Too many attempts" icon={<Lock />}>
              For your security, sign-in is paused. Try again in{" "}
              <span aria-live="polite" className="tabular-nums text-crm-fg">
                {secondsLeft}s
              </span>
              .
            </Alert>
          ) : error ? (
            <Alert tone="danger" title="Couldn't sign you in">
              {error}
            </Alert>
          ) : null}

          <FormField label="Work email" htmlFor={`${id}-email`} error={emailError} required>
            <Input
              id={`${id}-email`}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              invalid={!!emailError}
              aria-describedby={emailError ? `${id}-email-msg` : undefined}
              disabled={locked}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          {mode === "password" ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={`${id}-pw`} className="text-xs text-crm-soft">
                  Password <span className="text-crm-subtle">*</span>
                </label>
                {onForgotPassword ? (
                  <button
                    type="button"
                    className="rounded text-xs text-crm-primary hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring/40 focus-visible:outline-none"
                    onClick={() => onForgotPassword(email.trim())}
                  >
                    Forgot password?
                  </button>
                ) : null}
              </div>
              <PasswordInput
                id={`${id}-pw`}
                value={password}
                invalid={!!passwordError}
                disabled={locked}
                aria-describedby={`${id}-pw-msg`}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={onPwKey}
                onKeyDown={onPwKey}
              />
              <p id={`${id}-pw-msg`} className="min-h-4 text-xs" aria-live="polite">
                {passwordError ? (
                  <span className="text-crm-danger">{passwordError}</span>
                ) : capsLock ? (
                  <span className="text-crm-warning">Caps Lock is on.</span>
                ) : null}
              </p>
            </div>
          ) : null}

          {mode === "password" ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-crm-soft">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
              Keep me signed in for 30 days
            </label>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full justify-center"
            loading={loading}
            disabled={locked}
          >
            {mode === "password" ? "Sign in" : "Email me a sign-in link"}
          </Button>

          {onMagicLink ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-center"
              onClick={() => {
                setMode((m) => (m === "password" ? "link" : "password"));
                setError(null);
              }}
            >
              {mode === "password" ? <Mail /> : <Lock />}
              {mode === "password" ? "Email me a link instead" : "Use my password"}
            </Button>
          ) : null}
        </form>
      )}

      {onSignUp ? (
        <p className="text-center text-xs text-crm-soft">
          New to the team?{" "}
          <button
            type="button"
            onClick={onSignUp}
            className="rounded text-crm-primary hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring/40 focus-visible:outline-none"
          >
            Create an account
          </button>
        </p>
      ) : null}
    </div>
  );
}
