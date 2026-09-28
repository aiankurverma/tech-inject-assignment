import * as React from "react";
import { ArrowRight, Building2, KeyRound, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { FormField, Input } from "@/components/crm/input";
import { LogoTile } from "@/components/crm/avatar";

export interface SsoProvider {
  id: string;
  name: string;
  /** "oauth" for Google/Microsoft style buttons, "saml"/"oidc" for enterprise IdPs. */
  kind: "oauth" | "saml" | "oidc";
  icon?: React.ReactNode;
  /** Temporarily unavailable (maintenance, misconfigured). */
  disabled?: boolean;
  disabledReason?: string;
}

export interface SsoDomainRule {
  /** Email domain, e.g. "acme.com". Subdomains match too. */
  domain: string;
  providerId: string;
  /** Organisation name shown in the routing banner. */
  orgName: string;
  /** When true, password sign-in is blocked for this domain. */
  enforced?: boolean;
}

export interface SsoPickerProps {
  providers: SsoProvider[];
  /** Domain to IdP routing rules (home realm discovery). */
  domainRules?: SsoDomainRule[];
  /** Provider used on this device last time; shown first with a "Last used" hint. */
  lastUsedId?: string;
  /** Start the redirect. Reject to show an inline error. */
  onSelect: (providerId: string, email?: string) => Promise<void> | void;
  /** Fallback to email + password. Hidden when the typed domain enforces SSO. */
  onPasswordSignIn?: (email: string) => void;
  title?: string;
  className?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function matchRule(email: string, rules: SsoDomainRule[]) {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return undefined;
  return rules.find((r) => domain === r.domain || domain.endsWith(`.${r.domain}`));
}

/** Single sign-on chooser with email-domain routing (home realm discovery), last-used hint and per-provider loading/error states. */
export function SsoPicker({
  providers,
  domainRules = [],
  lastUsedId,
  onSelect,
  onPasswordSignIn,
  title = "Sign in to your workspace",
  className,
}: SsoPickerProps) {
  const [email, setEmail] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const emailId = React.useId();

  const validEmail = EMAIL_RE.test(email.trim());
  const rule = validEmail ? matchRule(email, domainRules) : undefined;
  const routed = rule ? providers.find((p) => p.id === rule.providerId) : undefined;

  const ordered = React.useMemo(() => {
    const list = [...providers];
    list.sort((a, b) => Number(b.id === lastUsedId) - Number(a.id === lastUsedId));
    return list;
  }, [providers, lastUsedId]);
  const social = ordered.filter((p) => p.kind === "oauth");
  const enterprise = ordered.filter((p) => p.kind !== "oauth");

  const start = async (id: string) => {
    if (pending) return;
    setError(null);
    setPending(id);
    try {
      await onSelect(id, validEmail ? email.trim() : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the identity provider.");
    } finally {
      setPending(null);
    }
  };

  const continueWithEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!validEmail) return;
    if (routed) void start(routed.id);
    else onPasswordSignIn?.(email.trim());
  };

  const providerButton = (p: SsoProvider) => (
    <li key={p.id}>
      <button
        type="button"
        disabled={p.disabled || (pending !== null && pending !== p.id)}
        aria-busy={pending === p.id || undefined}
        onClick={() => void start(p.id)}
        title={p.disabled ? p.disabledReason : undefined}
        className={cn(
          "flex h-10 w-full cursor-pointer items-center gap-3 rounded-crm border border-crm-border bg-crm-raised px-3 text-left text-sm text-crm-fg shadow-crm-raised",
          "outline-none transition-colors duration-150 hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60",
          "disabled:cursor-not-allowed disabled:opacity-50",
          routed?.id === p.id && "border-crm-primary",
        )}
      >
        <LogoTile size="sm" aria-hidden>
          {p.icon ?? <KeyRound />}
        </LogoTile>
        <span className="min-w-0 flex-1 truncate">
          Continue with {p.name}
          {p.disabled && p.disabledReason ? (
            <span className="block truncate text-xs text-crm-subtle">{p.disabledReason}</span>
          ) : null}
        </span>
        {p.id === lastUsedId ? (
          <span className="crm-caption rounded-full bg-crm-muted px-1.5 py-1 text-crm-soft">
            Last used
          </span>
        ) : null}
        {pending === p.id ? (
          <span
            aria-hidden
            className="size-3.5 animate-spin rounded-full border-2 border-crm-soft border-t-transparent"
          />
        ) : null}
      </button>
    </li>
  );

  return (
    <section
      aria-labelledby={`${emailId}-title`}
      className={cn(
        "flex w-full max-w-sm flex-col gap-5 rounded-crm border border-crm-border bg-crm-card p-6 font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-col gap-1">
        <h2 id={`${emailId}-title`} className="text-lg font-medium">
          {title}
        </h2>
        <p className="text-xs text-crm-muted-fg">
          Use your company identity provider or a connected account.
        </p>
      </header>

      <form onSubmit={continueWithEmail} noValidate className="flex flex-col gap-3">
        <FormField
          label="Work email"
          htmlFor={emailId}
          error={touched && !validEmail ? "Enter a valid work email" : undefined}
        >
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            invalid={touched && !validEmail}
            aria-describedby={`${emailId}-msg ${emailId}-route`}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => email && setTouched(true)}
          />
        </FormField>
        <div id={`${emailId}-route`} aria-live="polite">
          {rule && routed ? (
            <p className="flex items-start gap-2 rounded-crm border border-crm-border bg-crm-raised p-2.5 text-xs text-crm-soft">
              <ShieldCheck className="mt-px size-3.5 shrink-0 text-crm-success" aria-hidden />
              <span>
                <span className="text-crm-fg">{rule.orgName}</span> signs in with {routed.name}.
                {rule.enforced ? " Password sign-in is disabled by your admin." : ""}
              </span>
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={!!routed && pending === routed.id}
          disabled={!!pending || (!routed && !onPasswordSignIn)}
        >
          {routed ? `Continue with ${routed.name}` : "Continue with email"}
          <ArrowRight aria-hidden />
        </Button>
      </form>

      {error ? (
        <p role="alert" className="rounded-crm bg-crm-danger/10 p-2.5 text-xs text-crm-danger">
          {error}
        </p>
      ) : null}

      {rule?.enforced ? null : (
        <>
          {social.length ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 text-xs text-crm-subtle">
                <span className="h-px flex-1 bg-crm-border" />
                or
                <span className="h-px flex-1 bg-crm-border" />
              </div>
              <ul className="flex flex-col gap-2">{social.map(providerButton)}</ul>
            </div>
          ) : null}
          {enterprise.length ? (
            <div className="flex flex-col gap-2">
              <p className="crm-eyebrow flex items-center gap-1.5 text-crm-subtle uppercase">
                <Building2 className="size-3" aria-hidden /> Enterprise SSO
              </p>
              <ul className="flex flex-col gap-2">{enterprise.map(providerButton)}</ul>
            </div>
          ) : null}
        </>
      )}
      {providers.length === 0 ? (
        <p className="text-center text-xs text-crm-subtle">
          No sign-in providers are configured for this workspace.
        </p>
      ) : null}
    </section>
  );
}
