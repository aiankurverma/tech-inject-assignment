import * as React from "react";
import { Check, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Input } from "@/components/crm/input";

export interface CtaBannerProps {
  title: string;
  description?: string;
  eyebrow?: string;
  /** Primary action label. When `onSubmitEmail` is set it becomes the email form's submit label. */
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Turn the banner into an email capture. Reject the promise to show its message as an error. */
  onSubmitEmail?: (email: string) => Promise<void>;
  /** Reject free-mail domains (gmail.com, yahoo.com, …) for B2B lead capture. */
  requireWorkEmail?: boolean;
  /** Offer deadline; shows a live countdown and disables the CTA once passed. */
  expiresAt?: Date | string;
  /** Show a close button. Called after the banner hides. */
  onDismiss?: () => void;
  tone?: "primary" | "neutral";
  className?: string;
}

const FREE_MAIL = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com"];

function remaining(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return d > 0
    ? `${d}d ${h}h ${m}m`
    : `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

/** Conversion banner with optional work-email capture, async states, offer countdown and dismiss. */
export function CtaBanner({
  title,
  description,
  eyebrow,
  actionLabel = "Get started",
  onAction,
  secondaryLabel,
  onSecondary,
  onSubmitEmail,
  requireWorkEmail = false,
  expiresAt,
  onDismiss,
  tone = "primary",
  className,
}: CtaBannerProps) {
  const id = React.useId();
  const [hidden, setHidden] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [state, setState] = React.useState<"idle" | "loading" | "done">("idle");
  const deadline = expiresAt ? new Date(expiresAt).getTime() : null;
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (deadline === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [deadline]);

  if (hidden) return null;
  const expired = deadline !== null && now >= deadline;

  const validate = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return "Enter your email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return "That email doesn't look right.";
    const domain = (trimmed.split("@")[1] ?? "").toLowerCase();
    if (requireWorkEmail && FREE_MAIL.includes(domain)) return "Please use your work email.";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitEmail || expired) return;
    const err = validate(email);
    setError(err);
    if (err) return;
    setState("loading");
    try {
      await onSubmitEmail(email.trim());
      setState("done");
    } catch (x) {
      setState("idle");
      setError(x instanceof Error ? x.message : "Something went wrong. Try again.");
    }
  };

  return (
    <section
      aria-labelledby={`${id}-t`}
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-crm border p-5 font-crm sm:p-6 md:flex-row md:items-center md:justify-between",
        tone === "primary"
          ? "border-crm-primary/40 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(98,71,255,0.28),transparent_60%)] bg-crm-card"
          : "border-crm-border bg-crm-card",
        className,
      )}
    >
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            setHidden(true);
            onDismiss();
          }}
          className="absolute top-2 right-2 rounded-full p-1.5 text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3.5"
        >
          <X />
        </button>
      ) : null}
      <div className="flex max-w-xl flex-col gap-1.5">
        {eyebrow ? <span className="crm-eyebrow text-crm-primary">{eyebrow}</span> : null}
        <h2 id={`${id}-t`} className="text-lg font-semibold text-balance text-crm-fg">
          {title}
        </h2>
        {description ? <p className="text-sm text-crm-soft">{description}</p> : null}
        {deadline !== null ? (
          <p
            className={cn(
              "flex items-center gap-1 crm-caption tabular-nums [&_svg]:size-3",
              expired ? "text-crm-danger" : "text-crm-warning",
            )}
          >
            <Clock aria-hidden />
            {expired ? "Offer ended" : <span>Ends in {remaining(deadline - now)}</span>}
          </p>
        ) : null}
      </div>

      {onSubmitEmail ? (
        state === "done" ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-crm-success [&_svg]:size-4"
          >
            <Check aria-hidden /> Check your inbox — we sent the details to {email.trim()}.
          </p>
        ) : (
          <form noValidate onSubmit={submit} className="flex w-full flex-col gap-1.5 md:w-auto">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor={`${id}-e`} className="sr-only">
                Work email
              </label>
              <Input
                id={`${id}-e`}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                invalid={!!error}
                aria-describedby={error ? `${id}-err` : undefined}
                disabled={expired}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                className="sm:w-64"
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={state === "loading"}
                disabled={expired}
              >
                {actionLabel}
              </Button>
            </div>
            {error ? (
              <p id={`${id}-err`} role="alert" className="text-xs text-crm-danger">
                {error}
              </p>
            ) : null}
          </form>
        )
      ) : (
        <div className="flex flex-wrap gap-2">
          {secondaryLabel ? (
            <Button size="lg" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          ) : null}
          <Button size="lg" variant="primary" onClick={onAction} disabled={expired}>
            {actionLabel}
          </Button>
        </div>
      )}
    </section>
  );
}
