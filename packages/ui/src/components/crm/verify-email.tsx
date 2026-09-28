import * as React from "react";
import { CheckCircle2, MailOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/crm/alert";
import { Button } from "@/components/crm/button";
import { OtpInput } from "@/components/crm/otp-input";

export type VerifyResult = "ok" | "invalid" | "expired" | void;

export interface VerifyEmailProps {
  email: string;
  /** Check the code. Resolve "ok" (or nothing) on success, "invalid" / "expired" otherwise, or throw. */
  onVerify: (code: string) => Promise<VerifyResult> | VerifyResult;
  /** Send a new code. Resolve a string (or throw) to show an error. */
  onResend: () => Promise<string | void> | string | void;
  onChangeEmail?: () => void;
  onVerified?: () => void;
  codeLength?: number;
  /** Seconds between resends. */
  resendCooldown?: number;
  /** Wrong codes allowed before the current code is burned and a new one must be sent. */
  maxAttempts?: number;
  /** Seconds the first code was already cooling down, e.g. sent on the previous screen. */
  initialCooldown?: number;
  className?: string;
}

/** Enter the emailed code: auto-submit on the last digit, attempts left, burned-code state, resend cooldown. */
export function VerifyEmail({
  email,
  onVerify,
  onResend,
  onChangeEmail,
  onVerified,
  codeLength = 6,
  resendCooldown = 45,
  maxAttempts = 5,
  initialCooldown = 45,
  className,
}: VerifyEmailProps) {
  const [code, setCode] = React.useState("");
  const [status, setStatus] = React.useState<
    "idle" | "checking" | "invalid" | "expired" | "burned" | "ok"
  >("idle");
  const [attempts, setAttempts] = React.useState(0);
  const [cooldown, setCooldown] = React.useState(initialCooldown);
  const [resending, setResending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const verify = async (value: string) => {
    if (status === "checking" || status === "burned" || status === "ok") return;
    setStatus("checking");
    setMessage(null);
    try {
      const res = await onVerify(value);
      if (res === undefined || res === "ok") {
        setStatus("ok");
        onVerified?.();
        return;
      }
      if (res === "expired") {
        setStatus("expired");
        return;
      }
      const next = attempts + 1;
      setAttempts(next);
      setStatus(next >= maxAttempts ? "burned" : "invalid");
      setCode("");
    } catch (err) {
      setStatus("idle");
      setMessage(err instanceof Error ? err.message : "Could not verify the code.");
    }
  };

  const resend = async () => {
    setResending(true);
    setMessage(null);
    try {
      const res = await onResend();
      if (typeof res === "string") {
        setMessage(res);
        return;
      }
      setAttempts(0);
      setCode("");
      setStatus("idle");
      setCooldown(resendCooldown);
      setMessage(`A new code is on its way to ${email}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not send a new code.");
    } finally {
      setResending(false);
    }
  };

  const shell = cn(
    "mx-auto flex w-full max-w-sm flex-col gap-6 rounded-crm border border-crm-border bg-crm-card p-6 font-crm shadow-crm-raised sm:p-8",
    className,
  );

  if (status === "ok") {
    return (
      <div className={shell} role="status">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="size-10 text-crm-success" aria-hidden />
          <h1 className="text-lg font-semibold text-crm-fg">Email verified</h1>
          <p className="text-sm text-crm-soft">{email} is confirmed. You're all set.</p>
        </div>
      </div>
    );
  }

  const left = maxAttempts - attempts;
  const blocked = status === "burned" || status === "expired";

  return (
    <div className={shell}>
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-crm-raised text-crm-primary shadow-crm-raised">
          <MailOpen className="size-5" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold text-crm-fg">Verify your email</h1>
        <p className="text-sm text-crm-soft">
          Enter the {codeLength}-digit code we sent to <span className="text-crm-fg">{email}</span>.
        </p>
      </header>

      <form
        className="flex flex-col items-center gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === codeLength) void verify(code);
        }}
      >
        <OtpInput
          length={codeLength}
          value={code}
          groupSize={codeLength === 6 ? 3 : undefined}
          autoFocus
          disabled={blocked || status === "checking"}
          invalid={status === "invalid"}
          aria-label={`${codeLength}-digit verification code`}
          onChange={(v) => {
            setCode(v);
            if (status === "invalid") setStatus("idle");
          }}
          onComplete={(v) => void verify(v)}
        />
        <p className="min-h-4 text-center text-xs" aria-live="polite">
          {status === "checking" ? (
            <span className="text-crm-soft">Checking code...</span>
          ) : status === "invalid" ? (
            <span className="text-crm-danger">
              That code isn't right. {left} attempt{left === 1 ? "" : "s"} left.
            </span>
          ) : null}
        </p>
        {status === "burned" ? (
          <Alert tone="danger" title="Too many incorrect codes">
            This code has been disabled. Send a new one to continue.
          </Alert>
        ) : status === "expired" ? (
          <Alert tone="warning" title="This code has expired">
            Codes are valid for 10 minutes. Send a new one to continue.
          </Alert>
        ) : null}
        {message ? <p className="text-center text-xs text-crm-soft">{message}</p> : null}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full justify-center"
          disabled={code.length !== codeLength || blocked}
          loading={status === "checking"}
        >
          Verify email
        </Button>
      </form>

      <div className="flex flex-col items-center gap-2 text-xs text-crm-soft">
        <span>
          Didn't get it?{" "}
          {cooldown > 0 && !blocked ? (
            <span className="tabular-nums text-crm-subtle">Resend in {cooldown}s</span>
          ) : (
            <button
              type="button"
              disabled={resending}
              onClick={() => void resend()}
              className="rounded text-crm-primary hover:underline focus-visible:ring-2 focus-visible:ring-crm-ring/40 focus-visible:outline-none disabled:opacity-50"
            >
              {resending ? "Sending..." : "Send a new code"}
            </button>
          )}
        </span>
        {onChangeEmail ? (
          <button
            type="button"
            onClick={onChangeEmail}
            className="rounded text-crm-subtle hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/40 focus-visible:outline-none"
          >
            Wrong address? Change email
          </button>
        ) : null}
      </div>
    </div>
  );
}
