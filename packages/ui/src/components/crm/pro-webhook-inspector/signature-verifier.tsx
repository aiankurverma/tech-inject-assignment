import { useId, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebhookSignature } from "@/hooks/use-webhook-signature";

export interface SignatureVerifierProps {
  payload: string;
  header: string | undefined;
  headerName: string;
  attemptedAtMs: number;
  /** Prefills the secret field (e.g. the endpoint's signing secret, fetched on demand). */
  defaultSecret?: string;
  toleranceSeconds?: number;
}

/** Recomputes the HMAC locally (the secret never leaves the browser) and explains the verdict. */
export function SignatureVerifier({
  payload,
  header,
  headerName,
  attemptedAtMs,
  defaultSecret = "",
  toleranceSeconds = 300,
}: SignatureVerifierProps) {
  const [secret, setSecret] = useState(defaultSecret);
  const [reveal, setReveal] = useState(false);
  const id = useId();
  const check = useWebhookSignature({ secret, payload, header, attemptedAtMs, toleranceSeconds });

  return (
    <section
      aria-labelledby={`${id}-t`}
      className="rounded-crm border border-crm-border bg-crm-bg p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 id={`${id}-t`} className="text-xs font-medium text-crm-fg">
          Verify signature
        </h4>
        <span className="font-mono text-[11px] text-crm-muted-fg">{headerName}</span>
      </div>
      {!header && (
        <p className="mt-2 text-xs text-crm-warning">This request carries no signature header.</p>
      )}
      <label htmlFor={`${id}-s`} className="mt-2 block text-[11px] text-crm-muted-fg">
        Endpoint signing secret (hashed locally with WebCrypto, never sent)
      </label>
      <div className="mt-1 flex items-center gap-1 rounded-md border border-crm-input bg-crm-card pr-1 focus-within:border-crm-ring">
        <input
          id={`${id}-s`}
          type={reveal ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="whsec_…"
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 font-mono text-xs text-crm-fg outline-none placeholder:text-crm-subtle"
        />
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? "Hide secret" : "Show secret"}
          className="rounded p-1 text-crm-muted-fg hover:text-crm-fg focus-visible:outline focus-visible:outline-crm-ring"
        >
          {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
      <div aria-live="polite" className="mt-2 min-h-5 text-xs">
        {check.state === "computing" && (
          <span className="inline-flex items-center gap-1.5 text-crm-muted-fg">
            <Loader2 className="size-3.5 animate-spin" /> Computing HMAC-SHA256…
          </span>
        )}
        {check.state === "error" && (
          <span className="inline-flex items-center gap-1.5 text-crm-danger">
            <ShieldAlert className="size-3.5" /> {check.message}
          </span>
        )}
        {check.state === "done" && (
          <div className="space-y-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-medium",
                check.valid ? "text-crm-success" : "text-crm-danger",
              )}
            >
              {check.valid ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <XCircle className="size-3.5" />
              )}
              {check.valid ? "Signature matches" : "Signature does not match"}
            </span>
            {check.skewSeconds != null && (
              <p className={check.withinTolerance ? "text-crm-muted-fg" : "text-crm-warning"}>
                Timestamp skew {check.skewSeconds}s{" "}
                {check.withinTolerance
                  ? `(within ${toleranceSeconds}s tolerance)`
                  : `exceeds ${toleranceSeconds}s tolerance, receivers will reject it as a replay`}
              </p>
            )}
            <p className="break-all font-mono text-[11px] text-crm-muted-fg">
              expected v1={check.expected}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
