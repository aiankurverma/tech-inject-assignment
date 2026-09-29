import * as React from "react";
import type { SortingState } from "@tanstack/react-table";
import { Loader2, Plus, Search, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiKeyManager, keyStatus } from "@/hooks/use-api-key-manager";
import { KeyTable } from "@/components/crm/pro-api-key-manager/key-table";
import { CreateKeyDialog } from "@/components/crm/pro-api-key-manager/create-key-dialog";
import { RevealKeyDialog } from "@/components/crm/pro-api-key-manager/reveal-key-dialog";
import { ConfirmKeyAction } from "@/components/crm/pro-api-key-manager/confirm-key-action";
import { KeyButton } from "@/components/crm/pro-api-key-manager/modal";
import type {
  ApiKey,
  ApiKeyEnvironment,
  ApiKeyScope,
  ApiKeyStatusFilter,
  CreateApiKeyInput,
  IssuedApiKey,
} from "@/components/crm/pro-api-key-manager/types";

export type { ApiKey, ApiKeyScope, CreateApiKeyInput, IssuedApiKey };

export interface ProApiKeyManagerProps {
  /** Controlled key list. Omit and use `defaultKeys` for uncontrolled mode. */
  keys?: ApiKey[];
  defaultKeys?: ApiKey[];
  onKeysChange?: (keys: ApiKey[]) => void;
  /** Scopes offered in the create dialog. */
  scopes: ApiKeyScope[];
  /** Backend create. Must return the full secret once. Defaults to a local crypto-random issuer. */
  onCreate?: (input: CreateApiKeyInput) => Promise<IssuedApiKey> | IssuedApiKey;
  onRotate?: (key: ApiKey) => Promise<IssuedApiKey> | IssuedApiKey;
  onRevoke?: (key: ApiKey) => Promise<void> | void;
  /** Hide the "No expiry" option (org policy). */
  allowNoExpiry?: boolean;
  defaultExpiry?: "7" | "30" | "90" | "365" | "never";
  loading?: boolean;
  error?: React.ReactNode;
  onRetry?: () => void;
  /** Read-only mode: hides create and disables rotate/revoke. */
  disabled?: boolean;
  /** Height of the scrollable list body in px. */
  height?: number;
  title?: React.ReactNode;
  description?: React.ReactNode;
  currentUser?: string;
  /** Portal container for dialogs (useful inside iframes / shadow roots). */
  portalContainer?: HTMLElement | null;
  className?: string;
}

const FILTERS: { value: ApiKeyStatusFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
  { value: "all", label: "All" },
];

export function ProApiKeyManager({
  keys: keysProp,
  defaultKeys,
  onKeysChange,
  scopes,
  onCreate,
  onRotate,
  onRevoke,
  allowNoExpiry = true,
  defaultExpiry = "90",
  loading,
  error,
  onRetry,
  disabled,
  height = 420,
  title = "API keys",
  description = "Authenticate server-to-server requests. Secrets are shown once at creation.",
  currentUser,
  portalContainer,
  className,
}: ProApiKeyManagerProps) {
  const store = useApiKeyManager({
    keys: keysProp,
    defaultKeys,
    onKeysChange,
    onCreate,
    onRotate,
    onRevoke,
    currentUser,
  });
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [status, setStatus] = React.useState<ApiKeyStatusFilter>("active");
  const [env, setEnv] = React.useState<"all" | ApiKeyEnvironment>("all");
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [issued, setIssued] = React.useState<{
    key: IssuedApiKey;
    reason: "created" | "rotated";
  } | null>(null);
  const [pendingAction, setPendingAction] = React.useState<{
    type: "rotate" | "revoke";
    key: ApiKey;
  } | null>(null);
  const [announce, setAnnounce] = React.useState("");

  // "now" ticks each minute so expiry badges stay correct in long-lived dashboards.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const scopeLabel = React.useCallback((id: string) => id, []);

  const counts = React.useMemo(() => {
    const c = { all: 0, active: 0, expired: 0, revoked: 0 };
    for (const k of store.keys) {
      c.all++;
      c[keyStatus(k, now)]++;
    }
    return c;
  }, [store.keys, now]);

  const filtered = React.useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return store.keys.filter((k) => {
      if (status !== "all" && keyStatus(k, now) !== status) return false;
      if (env !== "all" && k.environment !== env) return false;
      if (!q) return true;
      return (
        k.name.toLowerCase().includes(q) ||
        k.last4.toLowerCase() === q ||
        (k.prefix + k.last4).toLowerCase().includes(q) ||
        k.scopes.some((s) => s.includes(q)) ||
        (k.createdBy?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [store.keys, deferredQuery, status, env, now]);

  const activeNames = React.useMemo(
    () => store.keys.filter((k) => keyStatus(k, now) === "active").map((k) => k.name),
    [store.keys, now],
  );

  const handleCreate = async (input: CreateApiKeyInput) => {
    const res = await store.create(input);
    setCreateOpen(false);
    setIssued({ key: res, reason: "created" });
    setAnnounce(`Key ${res.key.name} created`);
  };

  const handleConfirm = async (a: { type: "rotate" | "revoke"; key: ApiKey }) => {
    if (a.type === "rotate") {
      const res = await store.rotate(a.key);
      setPendingAction(null);
      setIssued({ key: res, reason: "rotated" });
      setAnnounce(`Key ${a.key.name} rotated`);
    } else {
      await store.revoke(a.key);
      setPendingAction(null);
      setAnnounce(`Key ${a.key.name} revoked`);
    }
  };

  return (
    <section
      aria-labelledby="ak-title"
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-start gap-3 border-b border-crm-border px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 id="ak-title" className="text-[15px] font-semibold">
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] text-crm-muted-fg">{description}</p>
        </div>
        {!disabled ? (
          <KeyButton
            variant="primary"
            onClick={() => setCreateOpen(true)}
            disabled={loading || !!error}
          >
            <Plus className="size-3.5" aria-hidden /> Create key
          </KeyButton>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border px-4 py-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-crm-subtle"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, scope, last 4 or owner"
            aria-label="Search API keys"
            className="h-8 w-full rounded-md border border-crm-input bg-crm-bg pl-8 pr-3 text-[13px] placeholder:text-crm-subtle focus:border-crm-ring focus:outline-none"
          />
        </div>
        <div
          role="radiogroup"
          aria-label="Status"
          className="flex rounded-md border border-crm-border bg-crm-raised p-0.5"
        >
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={status === f.value}
              onClick={() => setStatus(f.value)}
              className={cn(
                "rounded px-2.5 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-crm-ring",
                status === f.value
                  ? "bg-crm-muted text-crm-fg"
                  : "text-crm-muted-fg hover:text-crm-fg",
              )}
            >
              {f.label}
              <span className="ml-1 tabular-nums text-crm-subtle">
                {counts[f.value].toLocaleString()}
              </span>
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="ak-env">
          Environment
        </label>
        <select
          id="ak-env"
          value={env}
          onChange={(e) => setEnv(e.target.value as typeof env)}
          className="h-8 rounded-md border border-crm-input bg-crm-bg px-2 text-xs focus:border-crm-ring focus:outline-none"
        >
          <option value="all">All environments</option>
          <option value="live">Live</option>
          <option value="test">Test</option>
        </select>
      </div>

      <div className="relative overflow-x-auto">
        {error ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-3 p-6 text-center"
            style={{ height: height + 36 }}
          >
            <TriangleAlert className="size-6 text-crm-danger" aria-hidden />
            <div className="text-[13px]">{error}</div>
            {onRetry ? <KeyButton onClick={onRetry}>Retry</KeyButton> : null}
          </div>
        ) : loading ? (
          <div
            aria-busy="true"
            aria-label="Loading API keys"
            className="space-y-px p-3"
            style={{ height: height + 36 }}
          >
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-md bg-crm-raised"
                style={{ opacity: 1 - i * 0.12 }}
              />
            ))}
            <Loader2 className="sr-only" />
          </div>
        ) : (
          <KeyTable
            keys={filtered}
            now={now}
            height={height}
            scopeLabel={scopeLabel}
            disabled={disabled}
            sorting={sorting}
            onSortingChange={setSorting}
            onRotate={(k) => setPendingAction({ type: "rotate", key: k })}
            onRevoke={(k) => setPendingAction({ type: "revoke", key: k })}
            empty={
              store.keys.length === 0 ? (
                <div className="space-y-2">
                  <p className="font-medium text-crm-fg">No API keys yet</p>
                  <p className="text-xs">Create a key to start calling the API.</p>
                </div>
              ) : (
                <p>No keys match these filters.</p>
              )
            }
          />
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-crm-border px-4 py-2 text-xs text-crm-muted-fg">
        <span>
          Showing {filtered.length.toLocaleString()} of {store.keys.length.toLocaleString()} keys
        </span>
        <span aria-live="polite" className="sr-only">
          {announce}
        </span>
      </footer>

      <CreateKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        scopes={scopes}
        existingNames={activeNames}
        allowNoExpiry={allowNoExpiry}
        defaultExpiry={defaultExpiry}
        onSubmit={handleCreate}
        container={portalContainer}
      />
      <ConfirmKeyAction
        action={pendingAction}
        onCancel={() => setPendingAction(null)}
        onConfirm={handleConfirm}
        container={portalContainer}
      />
      <RevealKeyDialog
        issued={issued?.key ?? null}
        reason={issued?.reason ?? "created"}
        onDone={() => setIssued(null)}
        container={portalContainer}
      />
    </section>
  );
}
