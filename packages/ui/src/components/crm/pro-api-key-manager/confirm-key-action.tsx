import * as React from "react";
import { Loader2 } from "lucide-react";
import { KeyButton, KeyModal } from "@/components/crm/pro-api-key-manager/modal";
import type { ApiKey } from "@/components/crm/pro-api-key-manager/types";

export interface ConfirmKeyActionProps {
  action: { type: "rotate" | "revoke"; key: ApiKey } | null;
  onCancel: () => void;
  onConfirm: (action: { type: "rotate" | "revoke"; key: ApiKey }) => Promise<void>;
  container?: HTMLElement | null;
}

/**
 * Rotate / revoke confirmation. Revoking a live key requires typing its name (GitHub-style guard),
 * errors from the backend are shown inline and the dialog stays open so the user can retry.
 */
export function ConfirmKeyAction({
  action,
  onCancel,
  onConfirm,
  container,
}: ConfirmKeyActionProps) {
  const [typed, setTyped] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTyped("");
    setError(null);
    setPending(false);
  }, [action]);

  if (!action) return null;
  const { type, key } = action;
  const needsTyping = type === "revoke" && key.environment === "live";
  const canConfirm = !pending && (!needsTyping || typed.trim() === key.name);

  const run = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm(action);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setPending(false);
    }
  };

  return (
    <KeyModal
      open
      onOpenChange={(o) => !o && onCancel()}
      locked={pending}
      container={container}
      title={type === "rotate" ? `Rotate "${key.name}"?` : `Revoke "${key.name}"?`}
      description={
        type === "rotate"
          ? "A new secret with the same scopes and expiry is issued and the current secret stops working immediately."
          : "Requests using this key will fail with 401. This cannot be undone."
      }
      footer={
        <>
          <KeyButton onClick={onCancel} disabled={pending}>
            Cancel
          </KeyButton>
          <KeyButton
            variant={type === "revoke" ? "danger" : "primary"}
            disabled={!canConfirm}
            onClick={run}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            {type === "rotate" ? "Rotate key" : "Revoke key"}
          </KeyButton>
        </>
      }
    >
      <form
        className="space-y-3 text-[13px]"
        onSubmit={(e) => {
          e.preventDefault();
          if (canConfirm) void run();
        }}
      >
        <div className="rounded-md border border-crm-border bg-crm-raised px-3 py-2 font-mono text-xs">
          {key.prefix}
          {"•".repeat(12)}
          {key.last4}
          <span className="ml-2 font-sans text-crm-muted-fg">
            last used {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "never"}
          </span>
        </div>
        {needsTyping ? (
          <div className="space-y-1.5">
            <label htmlFor="ak-confirm">
              Type <span className="font-mono font-semibold">{key.name}</span> to confirm
            </label>
            <input
              id="ak-confirm"
              autoFocus
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="h-9 w-full rounded-md border border-crm-input bg-crm-bg px-3 text-[13px] focus:border-crm-ring focus:outline-none"
            />
          </div>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-crm-danger/40 bg-crm-danger/10 px-3 py-2 text-xs text-crm-danger"
          >
            {error}
          </p>
        ) : null}
      </form>
    </KeyModal>
  );
}
