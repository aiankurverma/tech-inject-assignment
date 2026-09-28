import * as React from "react";
import { KeyRound, MessageSquare, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/crm/alert";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { OtpInput } from "@/components/crm/otp-input";
import { SegmentedControl } from "@/components/crm/segmented-control";

export type TwoFactorMethod = "totp" | "sms" | "backup";

export interface TwoFactorProps {
  /** Methods the account has enrolled, in preference order. */
  methods?: TwoFactorMethod[];
  defaultMethod?: TwoFactorMethod;
  /** Masked phone for SMS, e.g. "+1 ••• ••• 4821". */
  phoneHint?: string;
  /** Verify a code. Resolve true on success, false for a wrong code, or throw. */
  onVerify: (
    code: string,
    method: TwoFactorMethod,
    options: { trustDevice: boolean },
  ) => Promise<boolean> | boolean;
  /** Send an SMS code. Called when the SMS tab opens and on resend. */
  onSendSms?: () => Promise<void> | void;
  onSuccess?: () => void;
  onCancel?: () => void;
  /** Days a trusted device skips the challenge. 0 hides the option. */
  trustDays?: number;
  maxAttempts?: number;
  smsCooldown?: number;
  /** Backup codes left; shows a warning when low. */
  backupCodesRemaining?: number;
  recoveryHref?: string;
  className?: string;
}

const META: Record<TwoFactorMethod, { label: string; icon: React.ReactNode }> = {
  totp: { label: "App", icon: <Smartphone /> },
  sms: { label: "SMS", icon: <MessageSquare /> },
  backup: { label: "Backup code", icon: <KeyRound /> },
};

/** Normalise "abcd efgh" / "ABCD-EFGH" to "ABCD-EFGH". */
export function formatBackupCode(raw: string): string {
  const c = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** Second-factor challenge: authenticator app, SMS (with resend cooldown) or one-time backup code; trust-device option. */
export function TwoFactor({
  methods = ["totp", "sms", "backup"],
  defaultMethod,
  phoneHint,
  onVerify,
  onSendSms,
  onSuccess,
  onCancel,
  trustDays = 30,
  maxAttempts = 5,
  smsCooldown = 30,
  backupCodesRemaining,
  recoveryHref = "#",
  className,
}: TwoFactorProps) {
  const id = React.useId();
  const [method, setMethod] = React.useState<TwoFactorMethod>(
    defaultMethod ?? methods[0] ?? "totp",
  );
  const [code, setCode] = React.useState("");
  const [backup, setBackup] = React.useState("");
  const [trust, setTrust] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [attempts, setAttempts] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);
  const [smsSent, setSmsSent] = React.useState(false);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const sendSms = React.useCallback(async () => {
    if (!onSendSms) return;
    setError(null);
    try {
      await onSendSms();
      setSmsSent(true);
      setCooldown(smsCooldown);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the SMS.");
    }
  }, [onSendSms, smsCooldown]);

  // Open straight on SMS: send the first code once on mount.
  const autoSent = React.useRef(false);
  React.useEffect(() => {
    if (method === "sms" && !autoSent.current) {
      autoSent.current = true;
      void sendSms();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTo = (m: TwoFactorMethod) => {
    setMethod(m);
    setCode("");
    setBackup("");
    setError(null);
    if (m === "sms" && !smsSent) void sendSms();
  };

  const locked = attempts >= maxAttempts;
  const value = method === "backup" ? backup.replace("-", "") : code;
  const complete = method === "backup" ? value.length === 8 : value.length === 6;

  const verify = async (raw: string) => {
    if (checking || locked) return;
    setChecking(true);
    setError(null);
    try {
      const ok = await onVerify(method === "backup" ? formatBackupCode(raw) : raw, method, {
        trustDevice: trust,
      });
      if (ok) {
        onSuccess?.();
        return;
      }
      const next = attempts + 1;
      setAttempts(next);
      setCode("");
      setBackup("");
      const left = maxAttempts - next;
      setError(
        left > 0
          ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Too many incorrect codes.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setChecking(false);
    }
  };

  const hint =
    method === "totp"
      ? "Open your authenticator app (1Password, Authy, Google Authenticator) and enter the 6-digit code."
      : method === "sms"
        ? `We texted a 6-digit code to ${phoneHint ?? "your phone"}.`
        : "Enter one of the 8-character backup codes you saved. Each code works once.";

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-sm flex-col gap-5 rounded-crm border border-crm-border bg-crm-card p-6 font-crm shadow-crm-raised sm:p-8",
        className,
      )}
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold text-crm-fg">Two-step verification</h1>
        <p className="text-sm text-crm-soft">{hint}</p>
      </header>

      {methods.length > 1 ? (
        <SegmentedControl
          label="Verification method"
          fullWidth
          value={method}
          onValueChange={(v) => switchTo(v as TwoFactorMethod)}
          options={methods.map((m) => ({ value: m, label: META[m].label, icon: META[m].icon }))}
        />
      ) : null}

      {locked ? (
        <Alert tone="danger" title="Verification locked">
          Too many incorrect codes. For your security, this sign-in was blocked.{" "}
          <a href={recoveryHref} className="text-crm-primary hover:underline">
            Recover your account
          </a>
          .
        </Alert>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          aria-busy={checking}
          onSubmit={(e) => {
            e.preventDefault();
            if (complete) void verify(value);
          }}
        >
          {method === "backup" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-backup`} className="text-xs text-crm-soft">
                Backup code
              </label>
              <input
                id={`${id}-backup`}
                value={backup}
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="XXXX-XXXX"
                aria-invalid={!!error || undefined}
                aria-describedby={`${id}-msg`}
                onChange={(e) => setBackup(formatBackupCode(e.target.value))}
                className="h-11 w-full rounded-crm border border-crm-input/60 bg-crm-raised px-3 text-center font-mono text-lg tracking-[0.3em] text-crm-fg uppercase outline-none placeholder:text-crm-subtle focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40 aria-[invalid=true]:border-crm-danger"
              />
              {backupCodesRemaining !== undefined && backupCodesRemaining <= 3 ? (
                <p className="text-xs text-crm-warning">
                  Only {backupCodesRemaining} backup code{backupCodesRemaining === 1 ? "" : "s"}{" "}
                  left - generate new ones after signing in.
                </p>
              ) : null}
            </div>
          ) : (
            <OtpInput
              key={method}
              length={6}
              groupSize={3}
              value={code}
              autoFocus
              disabled={checking}
              invalid={!!error}
              aria-label={method === "sms" ? "SMS code" : "Authenticator code"}
              onChange={(v) => {
                setCode(v);
                if (error) setError(null);
              }}
              onComplete={(v) => void verify(v)}
              className="self-center"
            />
          )}

          <p
            id={`${id}-msg`}
            className="min-h-4 text-center text-xs text-crm-danger"
            aria-live="polite"
          >
            {error}
          </p>

          {method === "sms" && onSendSms ? (
            <p className="text-center text-xs text-crm-soft">
              {cooldown > 0 ? (
                <span className="tabular-nums">Resend code in {cooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void sendSms()}
                  className="rounded text-crm-primary hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring/40 focus-visible:outline-none"
                >
                  {smsSent ? "Resend code" : "Send code"}
                </button>
              )}
            </p>
          ) : null}

          {trustDays > 0 ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-crm-soft">
              <Checkbox checked={trust} onCheckedChange={(c) => setTrust(c === true)} />
              Trust this device for {trustDays} days
            </label>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full justify-center"
            disabled={!complete}
            loading={checking}
          >
            Verify
          </Button>
        </form>
      )}

      {onCancel ? (
        <Button type="button" variant="ghost" className="justify-center" onClick={onCancel}>
          Sign in as someone else
        </Button>
      ) : null}
    </div>
  );
}
