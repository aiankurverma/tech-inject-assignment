import * as React from "react";
import { Check, Copy, Eye, EyeOff, TriangleAlert } from "lucide-react";
import { KeyButton, KeyModal } from "@/components/crm/pro-api-key-manager/modal";
import type { IssuedApiKey } from "@/components/crm/pro-api-key-manager/types";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for sandboxed iframes / insecure origins without the async clipboard API.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export interface RevealKeyDialogProps {
  issued: IssuedApiKey | null;
  /** "created" or "rotated" changes the copy. */
  reason: "created" | "rotated";
  onDone: () => void;
  container?: HTMLElement | null;
}

/**
 * Show-once secret reveal. The dialog cannot be dismissed until the user confirms they stored the
 * key; the secret lives only in this component's props and is dropped as soon as it closes.
 */
export function RevealKeyDialog({ issued, reason, onDone, container }: RevealKeyDialogProps) {
  const [ack, setAck] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [copied, setCopied] = React.useState<"idle" | "ok" | "fail">("idle");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setAck(false);
    setVisible(false);
    setCopied("idle");
  }, [issued]);

  React.useEffect(() => {
    if (copied === "idle") return;
    const t = setTimeout(() => setCopied("idle"), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  if (!issued) return null;
  const secret = issued.secret;
  const masked =
    issued.key.prefix +
    "•".repeat(Math.max(8, secret.length - issued.key.prefix.length - 4)) +
    issued.key.last4;

  return (
    <KeyModal
      open
      onOpenChange={(o) => !o && ack && onDone()}
      locked={!ack}
      container={container}
      title={reason === "created" ? "Save your new API key" : "Save your rotated API key"}
      description={
        <>
          <span className="font-medium text-crm-fg">{issued.key.name}</span> is ready. This is the
          only time the full secret will be shown.
        </>
      }
      footer={
        <KeyButton variant="primary" disabled={!ack} onClick={onDone}>
          Done
        </KeyButton>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-crm-warning/40 bg-crm-warning/10 px-3 py-2 text-xs text-crm-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Store it in a secrets manager. We only keep a hash, so a lost key has to be rotated.
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="ak-secret" className="sr-only">
            API key secret
          </label>
          <input
            id="ak-secret"
            ref={inputRef}
            readOnly
            value={visible ? secret : masked}
            onFocus={(e) => visible && e.currentTarget.select()}
            className="h-10 min-w-0 flex-1 rounded-md border border-crm-input bg-crm-bg px-3 font-mono text-[13px] text-crm-fg focus:border-crm-ring focus:outline-none"
          />
          <KeyButton
            variant="ghost"
            aria-label={visible ? "Hide secret" : "Show secret"}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
            className="h-10 px-2.5"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </KeyButton>
          <KeyButton
            className="h-10"
            onClick={async () => {
              const ok = await copyText(secret);
              setCopied(ok ? "ok" : "fail");
              if (!ok) {
                setVisible(true);
                requestAnimationFrame(() => inputRef.current?.select());
              }
            }}
          >
            {copied === "ok" ? (
              <Check className="size-4 text-crm-success" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied === "ok" ? "Copied" : "Copy"}
          </KeyButton>
        </div>
        <p aria-live="polite" className="min-h-4 text-xs text-crm-muted-fg">
          {copied === "ok"
            ? "Copied to clipboard."
            : copied === "fail"
              ? "Clipboard blocked. The key is selected, press Ctrl+C / Cmd+C."
              : null}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-crm-muted-fg">Scopes</dt>
          <dd className="font-mono">{issued.key.scopes.join(", ")}</dd>
          <dt className="text-crm-muted-fg">Expires</dt>
          <dd>
            {issued.key.expiresAt ? new Date(issued.key.expiresAt).toLocaleDateString() : "Never"}
          </dd>
        </dl>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="size-3.5 accent-[var(--color-crm-primary)]"
          />
          I have stored this key somewhere safe
        </label>
      </div>
    </KeyModal>
  );
}
