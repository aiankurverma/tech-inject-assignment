import * as React from "react";
import { AlertCircle, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Input } from "@/components/crm/input";
import { Tag } from "@/components/crm/tag";

export type IntegrationStatus = "connected" | "disconnected" | "error" | "syncing";

export interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  /** Logo node (img or svg). Falls back to initials. */
  logo?: React.ReactNode;
  status: IntegrationStatus;
  /** Account label shown when connected, e.g. "sales@acme.com". */
  account?: string;
  lastSyncedAt?: string;
  errorMessage?: string;
  /** Requires a higher plan; connect is disabled. */
  locked?: boolean;
  beta?: boolean;
}

export interface SettingsIntegrationsProps {
  integrations?: Integration[];
  defaultIntegrations?: Integration[];
  onIntegrationsChange?: (next: Integration[]) => void;
  /** Resolve to connect; reject to show an error on the card. */
  onConnect?: (i: Integration) => Promise<{ account?: string } | void>;
  onDisconnect?: (i: Integration) => Promise<void> | void;
  onSync?: (i: Integration) => Promise<void> | void;
  className?: string;
}

function since(iso?: string) {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

const STATUS = {
  connected: { color: "green", label: "Connected" },
  disconnected: { color: "neutral", label: "Not connected" },
  error: { color: "red", label: "Needs attention" },
  syncing: { color: "blue", label: "Syncing" },
} as const;

/** Integrations marketplace: category tabs with counts, search, connect/disconnect/re-sync with per-card pending + error states. */
export function SettingsIntegrations({
  integrations,
  defaultIntegrations = [],
  onIntegrationsChange,
  onConnect,
  onDisconnect,
  onSync,
  className,
}: SettingsIntegrationsProps) {
  const [inner, setInner] = React.useState(defaultIntegrations);
  const list = integrations ?? inner;
  const latest = React.useRef(list);
  React.useLayoutEffect(() => {
    latest.current = list;
  }, [list]);
  const [cat, setCat] = React.useState("All");
  const [query, setQuery] = React.useState("");
  const [pending, setPending] = React.useState<Record<string, boolean>>({});
  const [announce, setAnnounce] = React.useState("");

  const patch = (id: string, p: Partial<Integration>) => {
    const next = latest.current.map((x) => (x.id === id ? { ...x, ...p } : x));
    latest.current = next;
    if (integrations === undefined) setInner(next);
    onIntegrationsChange?.(next);
  };

  const categories = [
    "All",
    "Connected",
    ...Array.from(new Set(list.map((i) => i.category))).sort(),
  ];
  const count = (c: string) =>
    c === "All"
      ? list.length
      : c === "Connected"
        ? list.filter((i) => i.status !== "disconnected").length
        : list.filter((i) => i.category === c).length;

  const q = query.trim().toLowerCase();
  const visible = list.filter(
    (i) =>
      (cat === "All" || (cat === "Connected" ? i.status !== "disconnected" : i.category === cat)) &&
      (!q || `${i.name} ${i.description} ${i.category}`.toLowerCase().includes(q)),
  );

  async function run(i: Integration, kind: "connect" | "disconnect" | "sync") {
    setPending((p) => ({ ...p, [i.id]: true }));
    try {
      if (kind === "connect") {
        const res = await onConnect?.(i);
        patch(i.id, {
          status: "connected",
          account: (res && res.account) || i.account,
          lastSyncedAt: new Date().toISOString(),
          errorMessage: undefined,
        });
        setAnnounce(`${i.name} connected.`);
      } else if (kind === "disconnect") {
        await onDisconnect?.(i);
        patch(i.id, { status: "disconnected", account: undefined, errorMessage: undefined });
        setAnnounce(`${i.name} disconnected.`);
      } else {
        patch(i.id, { status: "syncing" });
        await onSync?.(i);
        patch(i.id, {
          status: "connected",
          lastSyncedAt: new Date().toISOString(),
          errorMessage: undefined,
        });
        setAnnounce(`${i.name} synced.`);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Something went wrong.";
      patch(i.id, { status: kind === "connect" ? "disconnected" : "error", errorMessage });
      setAnnounce(`${i.name}: ${errorMessage}`);
    } finally {
      setPending((p) => ({ ...p, [i.id]: false }));
    }
  }

  return (
    <section className={cn("flex flex-col gap-4 font-crm", className)} aria-labelledby="int-h">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Settings</p>
          <h2 id="int-h" className="text-lg font-semibold text-crm-fg">
            Integrations
          </h2>
          <p className="text-xs text-crm-soft">
            {count("Connected")} of {list.length} apps connected
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-crm-subtle"
            aria-hidden
          />
          <Input
            aria-label="Search integrations"
            placeholder="Search apps"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </header>

      <div role="tablist" aria-label="Categories" className="flex gap-1 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={cat === c}
            onClick={() => setCat(c)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
              cat === c
                ? "bg-crm-raised text-crm-fg shadow-crm-raised"
                : "text-crm-soft hover:bg-crm-muted",
            )}
          >
            {c}
            <span className="text-crm-subtle tabular-nums">{count(c)}</span>
          </button>
        ))}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-crm-border p-10 text-center text-sm text-crm-soft">
          No integrations match “{query || cat}”.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((i) => {
            const busy = !!pending[i.id];
            const on = i.status !== "disconnected";
            return (
              <li
                key={i.id}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border bg-crm-card p-4 shadow-crm-raised",
                  i.status === "error" ? "border-crm-danger/50" : "border-crm-border",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-crm-raised text-sm font-semibold text-crm-fg shadow-crm-raised [&_img]:size-6 [&_svg]:size-6"
                    aria-hidden
                  >
                    {i.logo ?? i.name.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-crm-fg">
                      <span className="truncate">{i.name}</span>
                      {i.beta ? (
                        <Tag size="sm" color="purple">
                          Beta
                        </Tag>
                      ) : null}
                    </p>
                    <p className="text-xs text-crm-subtle">{i.category}</p>
                  </div>
                  <Tag size="sm" color={STATUS[i.status].color}>
                    {STATUS[i.status].label}
                  </Tag>
                </div>
                <p className="line-clamp-2 text-xs leading-5 text-crm-soft">{i.description}</p>
                {i.errorMessage ? (
                  <p className="flex items-start gap-1.5 text-xs text-crm-danger">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {i.errorMessage}
                  </p>
                ) : on ? (
                  <p className="truncate text-xs text-crm-subtle">
                    {i.account ? `${i.account} · ` : ""}Last sync {since(i.lastSyncedAt)}
                  </p>
                ) : null}
                <div className="mt-auto flex items-center justify-end gap-1.5">
                  {on ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busy && i.status === "syncing"}
                        disabled={busy}
                        onClick={() => run(i, "sync")}
                        aria-label={`Sync ${i.name} now`}
                      >
                        <RefreshCw /> {i.status === "error" ? "Retry" : "Sync"}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => run(i, "disconnect")}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={busy}
                      disabled={i.locked}
                      title={i.locked ? "Upgrade your plan to use this app" : undefined}
                      onClick={() => run(i, "connect")}
                    >
                      {i.locked ? "Upgrade to connect" : "Connect"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
