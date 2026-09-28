import * as React from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/crm/alert";
import { Button } from "@/components/crm/button";
import { FormField, Input } from "@/components/crm/input";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "priya.raman@acme.com" -> "pr•••••••n@acme.com" so the sent screen doesn't leak the full address. */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  if (user.length <= 2) return `${user[0] ?? ""}•@${domain}`;
  return `${user.slice(0, 2)}${"•".repeat(Math.min(7, user.length - 3))}${user.slice(-1)}@${domain}`;
}

export interface ForgotPasswordProps {
  /** Send the reset email. Resolve a string (or throw) to show an error. */
  onSubmit: (email: string) => Promise<string | void> | string | void;
  onBack?: () => void;
  defaultEmail?: string;
  /** Seconds before "Resend" is allowed again. */
  resendCooldown?: number;
  /** Max resends shown to the user before asking them to contact support. */
  maxResends?: number;
  /** How long the reset link stays valid, shown in the confirmation copy. */
  linkValidMinutes?: number;
  supportHref?: string;
  className?: string;
}

/** Request a password-reset link; confirmation screen with masked email, resend cooldown and resend cap. */
export function ForgotPassword({
  onSubmit,
  onBack,
  defaultEmail = "",
  resendCooldown = 60,
  maxResends = 3,
  linkValidMinutes = 30,
  supportHref = "#",
  className,
}: ForgotPasswordProps) {
  const id = React.useId();
  const [email, setEmail] = React.useState(defaultEmail);
  const [touched, setTouched] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [sends, setSends] = React.useState(0);
  const [cooldown, setCooldown] = React.useState(0);
  const [notice, setNotice] = React.useState("");

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const clean = email.trim().toLowerCase();
  const invalid = touched && !EMAIL_RE.test(clean);

  const send = async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await onSubmit(target);
      if (typeof res === "string") {
        setError(res);
        return;
      }
      setSentTo(target);
      setSends((n) => n + 1);
      setCooldown(resendCooldown);
      setNotice(
        sentTo
          ? `A new link was sent at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
          : "",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const shell = cn(
    "mx-auto flex w-full max-w-sm flex-col gap-6 rounded-crm border border-crm-border bg-crm-card p-6 font-crm shadow-crm-raised sm:p-8",
    className,
  );

  if (sentTo) {
    const capped = sends > maxResends;
    return (
      <div className={shell}>
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-crm-raised text-crm-success shadow-crm-raised">
            <MailCheck className="size-5" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold text-crm-fg">Check your email</h1>
          <p className="text-sm text-crm-soft">
            If an account exists for <span className="text-crm-fg">{maskEmail(sentTo)}</span>,
            you'll get a reset link valid for {linkValidMinutes} minutes.
          </p>
        </header>
        <ul className="flex flex-col gap-1.5 rounded-crm bg-crm-raised p-3 text-xs text-crm-soft shadow-crm-raised">
          <li>· Check spam or "Updates" folders.</li>
          <li>· The email comes from no-reply - add it to your contacts.</li>
          <li>· Only the most recent link works.</li>
        </ul>
        <p className="text-xs text-crm-subtle" aria-live="polite">
          {notice}
        </p>
        {error ? (
          <Alert tone="danger" title="Couldn't resend">
            {error}
          </Alert>
        ) : null}
        {capped ? (
          <Alert tone="warning" title="Still nothing?">
            You've requested several links.{" "}
            <a href={supportHref} className="text-crm-primary hover:underline">
              Contact support
            </a>{" "}
            and we'll help you get back in.
          </Alert>
        ) : (
          <Button
            type="button"
            size="lg"
            className="w-full justify-center"
            disabled={cooldown > 0}
            loading={loading}
            onClick={() => send(sentTo)}
          >
            {cooldown > 0 ? (
              <span className="tabular-nums">Resend link in {cooldown}s</span>
            ) : (
              "Resend link"
            )}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-center"
          onClick={() => {
            setSentTo(null);
            setSends(0);
            setNotice("");
          }}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className={shell}>
      <header className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold text-crm-fg">Reset your password</h1>
        <p className="text-sm text-crm-soft">
          Enter the email you use to sign in and we'll send you a secure reset link.
        </p>
      </header>
      <form
        noValidate
        className="flex flex-col gap-4"
        aria-busy={loading}
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (EMAIL_RE.test(clean) && !loading) void send(clean);
        }}
      >
        {error ? (
          <Alert tone="danger" title="Couldn't send the link">
            {error}
          </Alert>
        ) : null}
        <FormField
          label="Email"
          htmlFor={`${id}-email`}
          required
          error={invalid ? "Enter a valid email address." : undefined}
        >
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            value={email}
            invalid={invalid}
            aria-describedby={invalid ? `${id}-email-msg` : undefined}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        </FormField>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full justify-center"
          loading={loading}
        >
          Send reset link
        </Button>
      </form>
      {onBack ? (
        <Button type="button" variant="ghost" className="justify-center" onClick={onBack}>
          <ArrowLeft />
          Back to sign in
        </Button>
      ) : null}
    </div>
  );
}
