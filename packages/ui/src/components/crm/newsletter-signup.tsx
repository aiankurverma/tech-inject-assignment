import * as React from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { Input } from "@/components/crm/input";
import { cn } from "@/lib/utils";

export interface NewsletterTopic {
  id: string;
  label: string;
  /** e.g. "Weekly", "Monthly". */
  cadence?: string;
  defaultSelected?: boolean;
}

export interface NewsletterSubmission {
  email: string;
  topics: string[];
  consent: boolean;
  /** ISO timestamp of the consent click, for GDPR records. */
  consentedAt: string;
}

export interface NewsletterSignupProps {
  title?: string;
  description?: string;
  topics?: NewsletterTopic[];
  /** Resolve to finish; reject (or throw) with an Error to show its message. */
  onSubscribe: (submission: NewsletterSubmission) => Promise<void> | void;
  /** Block these domains (disposable inboxes). */
  blockedDomains?: string[];
  /** Require business email (rejects gmail.com, yahoo.com, ...). */
  requireWorkEmail?: boolean;
  /** Double opt-in: success copy tells the user to confirm. */
  doubleOptIn?: boolean;
  consentLabel?: React.ReactNode;
  subscriberCount?: number;
  layout?: "stacked" | "inline";
  disabled?: boolean;
  className?: string;
}

const COMMON_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "proton.me",
];
const FREE_DOMAINS = new Set([...COMMON_DOMAINS, "aol.com", "live.com", "mail.com", "gmx.com"]);
const DEFAULT_BLOCKED = ["mailinator.com", "10minutemail.com", "guerrillamail.com", "tempmail.com"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Levenshtein distance, small inputs only. */
function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array<number>(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return dp[a.length]![b.length]!;
}

/** Suggest "gmail.com" for "gmial.com" etc. Returns a corrected address or null. */
export function suggestEmailFix(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain || COMMON_DOMAINS.includes(domain)) return null;
  const hit = COMMON_DOMAINS.find((d) => distance(domain, d) <= 2);
  return hit ? `${email.slice(0, at)}@${hit}` : null;
}

export function validateNewsletterEmail(
  email: string,
  opts: { blockedDomains?: string[]; requireWorkEmail?: boolean } = {},
): string | null {
  const v = email.trim();
  if (!v) return "Enter your email address.";
  if (!EMAIL_RE.test(v)) return "That doesn't look like a valid email.";
  const domain = v.split("@")[1]!.toLowerCase();
  if ((opts.blockedDomains ?? DEFAULT_BLOCKED).includes(domain))
    return "Disposable inboxes aren't accepted.";
  if (opts.requireWorkEmail && FREE_DOMAINS.has(domain)) return "Please use your work email.";
  return null;
}

type Status = "idle" | "submitting" | "success" | "error";

/** Email capture with typo suggestions, topic preferences, explicit consent and async submit states. */
export function NewsletterSignup({
  title = "Get the RevOps brief",
  description = "Playbooks, benchmarks and product updates. No spam, unsubscribe anytime.",
  topics = [],
  onSubscribe,
  blockedDomains,
  requireWorkEmail = false,
  doubleOptIn = true,
  consentLabel = "I agree to receive emails and accept the privacy policy.",
  subscriberCount,
  layout = "stacked",
  disabled,
  className,
}: NewsletterSignupProps) {
  const id = React.useId();
  const [email, setEmail] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>(
    topics.filter((t) => t.defaultSelected).map((t) => t.id),
  );
  const [consent, setConsent] = React.useState(false);
  const [status, setStatus] = React.useState<Status>("idle");
  const [serverError, setServerError] = React.useState<string | null>(null);

  const emailError = validateNewsletterEmail(email, { blockedDomains, requireWorkEmail });
  const suggestion = email && !emailError ? suggestEmailFix(email.trim()) : null;
  const topicError = topics.length > 0 && selected.length === 0 ? "Pick at least one topic." : null;
  const consentError = !consent ? "Consent is required." : null;
  const showErrors = touched;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (emailError || topicError || consentError || disabled) return;
    setStatus("submitting");
    setServerError(null);
    try {
      await onSubscribe({
        email: email.trim().toLowerCase(),
        topics: selected,
        consent,
        consentedAt: new Date().toISOString(),
      });
      setStatus("success");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div
        role="status"
        className={cn(
          "flex flex-col items-center gap-3 rounded-crm border border-crm-border bg-crm-card p-6 text-center font-crm",
          className,
        )}
      >
        <CheckCircle2 className="size-8 text-crm-success" aria-hidden />
        <p className="text-sm font-medium text-crm-fg">
          {doubleOptIn ? "Check your inbox to confirm" : "You're subscribed"}
        </p>
        <p className="max-w-sm text-xs text-crm-soft">
          {doubleOptIn
            ? `We sent a confirmation link to ${email.trim().toLowerCase()}. It expires in 48 hours.`
            : `Welcome aboard. The next issue lands at ${email.trim().toLowerCase()}.`}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStatus("idle");
            setEmail("");
            setTouched(false);
            setConsent(false);
          }}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  const busy = status === "submitting";
  return (
    <form
      noValidate
      onSubmit={submit}
      aria-busy={busy || undefined}
      className={cn(
        "flex flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-5 font-crm",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-crm-raised shadow-crm-raised">
          <Mail className="size-4 text-crm-icon" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-medium text-crm-fg">{title}</h3>
          <p className="text-xs text-crm-soft">{description}</p>
        </div>
      </div>

      <div className={cn("flex gap-2", layout === "stacked" ? "flex-col" : "flex-col sm:flex-row")}>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor={`${id}-email`} className="sr-only">
            Email address
          </label>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={requireWorkEmail ? "you@company.com" : "you@example.com"}
            value={email}
            disabled={disabled || busy}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => email && setTouched(true)}
            invalid={showErrors && !!emailError}
            aria-describedby={`${id}-email-msg`}
          />
          <div id={`${id}-email-msg`} aria-live="polite" className="min-h-0">
            {showErrors && emailError ? (
              <p className="text-xs text-crm-danger">{emailError}</p>
            ) : suggestion ? (
              <p className="text-xs text-crm-soft">
                Did you mean{" "}
                <button
                  type="button"
                  className="cursor-pointer text-crm-fg underline underline-offset-2"
                  onClick={() => setEmail(suggestion)}
                >
                  {suggestion}
                </button>
                ?
              </p>
            ) : null}
          </div>
        </div>
        {layout === "inline" ? (
          <Button type="submit" variant="primary" size="lg" loading={busy} disabled={disabled}>
            Subscribe
          </Button>
        ) : null}
      </div>

      {topics.length > 0 ? (
        <fieldset className="flex flex-col gap-2" disabled={disabled || busy}>
          <legend className="mb-2 crm-eyebrow text-crm-subtle">Topics</legend>
          {topics.map((t) => {
            const checked = selected.includes(t.id);
            return (
              <label key={t.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) =>
                    setSelected((s) => (v === true ? [...s, t.id] : s.filter((x) => x !== t.id)))
                  }
                />
                <span className="text-crm-fg">{t.label}</span>
                {t.cadence ? <span className="text-xs text-crm-subtle">{t.cadence}</span> : null}
              </label>
            );
          })}
          {showErrors && topicError ? (
            <p className="text-xs text-crm-danger">{topicError}</p>
          ) : null}
        </fieldset>
      ) : null}

      <label className="flex cursor-pointer items-start gap-2.5 text-xs text-crm-soft">
        <Checkbox
          className="mt-0.5"
          checked={consent}
          disabled={disabled || busy}
          onCheckedChange={(v) => setConsent(v === true)}
          aria-invalid={showErrors && !!consentError}
        />
        <span>{consentLabel}</span>
      </label>
      {showErrors && consentError ? (
        <p className="-mt-2 text-xs text-crm-danger">{consentError}</p>
      ) : null}

      {serverError ? (
        <p role="alert" className="rounded-crm bg-crm-danger/10 px-3 py-2 text-xs text-crm-danger">
          {serverError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {subscriberCount ? (
          <span className="text-xs text-crm-subtle">
            Join {new Intl.NumberFormat("en-US").format(subscriberCount)} operators
          </span>
        ) : (
          <span />
        )}
        {layout === "stacked" ? (
          <Button type="submit" variant="primary" size="lg" loading={busy} disabled={disabled}>
            {status === "error" ? "Try again" : "Subscribe"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
