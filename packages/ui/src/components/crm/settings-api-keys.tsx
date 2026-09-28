import * as React from "react";
import { Check, Copy, KeyRound, Plus, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { Input } from "@/components/crm/input";
import { Select } from "@/components/crm/select";
import { Tag } from "@/components/crm/tag";

export interface ApiScope {
  key: string;
  label: string;
  /** Write/admin scopes are flagged in the UI. */
  sensitive?: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  /** Visible prefix only, e.g. "kb_live_3f9a". The secret is never stored client-side. */
  prefix: string;
  scopes: string[];
  createdAt: string;
  createdBy: string;
  lastUsedAt?: string;
  /** ISO date or undefined for no expiry. */
  expiresAt?: string;
  revoked?: boolean;
}

export interface NewApiKeyInput {
  name: string;
  scopes: string[];
  expiresInDays: number | null;
}

export interface SettingsApiKeysProps {
  scopes: ApiScope[];
  keys?: ApiKey[];
  defaultKeys?: ApiKey[];
  onKeysChange?: (keys: ApiKey[]) => void;
  /** Create on the server; resolve with the stored key and the one-time plaintext secret. */
  onCreate: (input: NewApiKeyInput) => Promise<{ key: ApiKey; secret: string }>;
  onRevoke?: (key: ApiKey) => Promise<void> | void;
  maxKeys?: number;
  className?: string;
}

export function keyState(
  k: ApiKey,
  now = Date.now(),
): "active" | "expiring" | "expired" | "revoked" {
  if (k.revoked) return "revoked";
  if (!k.expiresAt) return "active";
  const left = new Date(k.expiresAt).getTime() - now;
  if (left <= 0) return "expired";
  return left < 14 * 86_400_000 ? "expiring" : "active";
}

const STATE_TAG = {
  active: { color: "green", label: "Active" },
  expiring: { color: "amber", label: "Expiring soon" },
  expired: { color: "red", label: "Expired" },
  revoked: { color: "neutral", label: "Revoked" },
} as const;

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";

/** API key manager: scoped key creation with expiry, one-time secret reveal + copy, usage/expiry states, confirm-to-revoke, key cap. */
export function SettingsApiKeys({
  scopes,
  keys,
  defaultKeys = [],
  onKeysChange,
  onCreate,
  onRevoke,
  maxKeys = 10,
  className,
}: SettingsApiKeysProps) {
  const [inner, setInner] = React.useState(defaultKeys);
  const list = keys ?? inner;
  const commit = (next: ApiKey[]) => {
    if (keys === undefined) setInner(next);
    onKeysChange?.(next);
  };
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [expiry, setExpiry] = React.useState("90");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<{ name: string; value: string } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);

  const activeCount = list.filter((k) => !k.revoked).length;
  const atCap = activeCount >= maxKeys;
  const sorted = [...list].sort(
    (a, b) => Number(!!a.revoked) - Number(!!b.revoked) || b.createdAt.localeCompare(a.createdAt),
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError("Name is required.");
    if (list.some((k) => !k.revoked && k.name.toLowerCase() === n.toLowerCase()))
      return setError("An active key already has this name.");
    if (!picked.length) return setError("Pick at least one scope.");
    setBusy(true);
    setError(null);
    try {
      const res = await onCreate({
        name: n,
        scopes: picked,
        expiresInDays: expiry === "never" ? null : Number(expiry),
      });
      commit([res.key, ...list]);
      setSecret({ name: n, value: res.secret });
      setCopied(false);
      setCreating(false);
      setName("");
      setPicked([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create key.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function revoke(k: ApiKey) {
    await onRevoke?.(k);
    commit(list.map((x) => (x.id === k.id ? { ...x, revoked: true } : x)));
    setConfirmId(null);
  }

  return (
    <section className={cn("flex flex-col gap-4 font-crm", className)} aria-labelledby="keys-h">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Developers</p>
          <h2 id="keys-h" className="text-lg font-semibold text-crm-fg">
            API keys
          </h2>
          <p className="text-xs text-crm-soft">
            {activeCount} of {maxKeys} active keys
          </p>
        </div>
        <Button
          variant="primary"
          disabled={atCap || creating}
          title={atCap ? "Revoke a key to create another" : undefined}
          onClick={() => setCreating(true)}
        >
          <Plus /> New key
        </Button>
      </header>

      {secret ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-crm-warning/50 bg-crm-warning/10 p-4"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-crm-fg">
            <TriangleAlert className="size-4 text-crm-warning" aria-hidden />
            Copy “{secret.name}” now. You will not see it again.
          </p>
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded-crm bg-crm-raised px-3 py-2 font-mono text-xs text-crm-fg">
              {secret.value}
            </code>
            <Button onClick={copy} size="lg" aria-label="Copy secret">
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="self-end" onClick={() => setSecret(null)}>
            I stored it safely
          </Button>
        </div>
      ) : null}

      {creating ? (
        <form
          onSubmit={create}
          className="flex flex-col gap-3 rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised"
          aria-label="Create API key"
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <Input
              aria-label="Key name"
              placeholder="e.g. Zapier production"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <Select
              aria-label="Expires"
              value={expiry}
              onValueChange={setExpiry}
              options={[
                { value: "30", label: "Expires in 30 days" },
                { value: "90", label: "Expires in 90 days" },
                { value: "365", label: "Expires in 1 year" },
                { value: "never", label: "Never expires" },
              ]}
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 flex w-full items-center justify-between text-xs text-crm-soft">
              Scopes
              <button
                type="button"
                className="text-crm-subtle hover:text-crm-fg"
                onClick={() =>
                  setPicked(picked.length === scopes.length ? [] : scopes.map((s) => s.key))
                }
              >
                {picked.length === scopes.length ? "Clear all" : "Select all"}
              </button>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {scopes.map((s) => (
                <label
                  key={s.key}
                  className="flex cursor-pointer items-center gap-2 text-sm text-crm-fg"
                >
                  <Checkbox
                    checked={picked.includes(s.key)}
                    onCheckedChange={(v) =>
                      setPicked((p) => (v === true ? [...p, s.key] : p.filter((x) => x !== s.key)))
                    }
                  />
                  <span className="font-mono text-xs">{s.key}</span>
                  <span className="truncate text-xs text-crm-soft">{s.label}</span>
                  {s.sensitive ? (
                    <Tag size="sm" color="orange">
                      write
                    </Tag>
                  ) : null}
                </label>
              ))}
            </div>
          </fieldset>
          {expiry === "never" ? (
            <p className="text-xs text-crm-warning">
              Keys without expiry are a common leak risk. Rotate them regularly.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-xs text-crm-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Create key
            </Button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-crm-border bg-crm-card shadow-crm-raised">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <KeyRound className="size-5 text-crm-subtle" aria-hidden />
            <p className="text-sm text-crm-soft">
              No API keys yet. Create one to call the REST API.
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-crm-border text-left text-xs text-crm-subtle">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Name
                </th>
                <th scope="col" className="px-2 py-2.5 font-medium">
                  Scopes
                </th>
                <th scope="col" className="px-2 py-2.5 font-medium">
                  Last used
                </th>
                <th scope="col" className="px-2 py-2.5 font-medium">
                  Expires
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-crm-border">
              {sorted.map((k) => {
                const st = keyState(k);
                return (
                  <tr key={k.id} className={cn(k.revoked && "opacity-50")}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-crm-fg">
                        {k.name}
                        <Tag size="sm" color={STATE_TAG[st].color}>
                          {STATE_TAG[st].label}
                        </Tag>
                      </span>
                      <span className="font-mono text-xs text-crm-subtle">{k.prefix}••••••••</span>
                      <span className="block text-xs text-crm-subtle">
                        by {k.createdBy} · {fmt(k.createdAt)}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <span className="flex flex-wrap gap-1">
                        {k.scopes.slice(0, 3).map((s) => (
                          <Tag key={s} size="sm">
                            {s}
                          </Tag>
                        ))}
                        {k.scopes.length > 3 ? (
                          <Tag size="sm" title={k.scopes.slice(3).join(", ")}>
                            +{k.scopes.length - 3}
                          </Tag>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-xs text-crm-soft">
                      {k.lastUsedAt ? fmt(k.lastUsedAt) : "Never used"}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-3 text-xs",
                        st === "expiring" || st === "expired"
                          ? "text-crm-warning"
                          : "text-crm-soft",
                      )}
                    >
                      {k.expiresAt ? fmt(k.expiresAt) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {k.revoked ? null : confirmId === k.id ? (
                        <span className="inline-flex gap-1">
                          <Button size="sm" variant="danger" onClick={() => revoke(k)}>
                            Revoke
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                            Cancel
                          </Button>
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmId(k.id)}
                          aria-label={`Revoke ${k.name}`}
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
