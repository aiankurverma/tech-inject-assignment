import * as React from "react";
import { Eye, EyeOff, Plus, RotateCw, Send, Webhook as WebhookIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { Input } from "@/components/crm/input";
import { Switch } from "@/components/crm/switch";
import { Tag } from "@/components/crm/tag";

export interface WebhookDelivery {
  id: string;
  event: string;
  status: number;
  /** Response time in ms. */
  duration: number;
  at: string;
  attempt: number;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  description?: string;
  events: string[];
  enabled: boolean;
  secret: string;
  deliveries: WebhookDelivery[];
}

export interface SettingsWebhooksProps {
  /** Grouped event catalog, e.g. { Deals: ["deal.created", ...] } */
  eventCatalog: Record<string, string[]>;
  endpoints?: WebhookEndpoint[];
  defaultEndpoints?: WebhookEndpoint[];
  onEndpointsChange?: (e: WebhookEndpoint[]) => void;
  /** Redeliver; resolve with the new delivery record. */
  onRetry?: (endpoint: WebhookEndpoint, d: WebhookDelivery) => Promise<WebhookDelivery>;
  /** Send a test ping; resolve with the delivery record. */
  onTest?: (endpoint: WebhookEndpoint) => Promise<WebhookDelivery>;
  className?: string;
}

/** Returns an error string for a webhook URL, or null when it is acceptable. */
export function validateWebhookUrl(raw: string, existing: string[] = []): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return "Enter a full URL, e.g. https://api.acme.com/hooks/crm";
  }
  if (u.protocol !== "https:") return "Webhooks must use HTTPS.";
  if (/^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/.test(u.hostname))
    return "Private or local hosts are not reachable.";
  if (existing.includes(u.toString())) return "This URL is already registered.";
  return null;
}

export function successRate(d: WebhookDelivery[]) {
  if (!d.length) return null;
  return Math.round((d.filter((x) => x.status >= 200 && x.status < 300).length / d.length) * 100);
}

const ok = (s: number) => s >= 200 && s < 300;

/** Webhook endpoints: HTTPS/private-host validation, grouped event subscriptions, masked signing secret, enable toggle, success rate, delivery log with retry and test ping. */
export function SettingsWebhooks({
  eventCatalog,
  endpoints,
  defaultEndpoints = [],
  onEndpointsChange,
  onRetry,
  onTest,
  className,
}: SettingsWebhooksProps) {
  const [inner, setInner] = React.useState(defaultEndpoints);
  const list = endpoints ?? inner;
  const commit = (next: WebhookEndpoint[]) => {
    if (endpoints === undefined) setInner(next);
    onEndpointsChange?.(next);
  };
  const [selectedId, setSelectedId] = React.useState(list[0]?.id ?? "");
  const [adding, setAdding] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [events, setEvents] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [reveal, setReveal] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [onlyFailed, setOnlyFailed] = React.useState(false);

  const selected = list.find((e) => e.id === selectedId) ?? list[0];
  const allEvents = Object.values(eventCatalog).flat();

  const patch = (id: string, p: Partial<WebhookEndpoint>) =>
    commit(list.map((e) => (e.id === id ? { ...e, ...p } : e)));

  function add(e: React.FormEvent) {
    e.preventDefault();
    const err = validateWebhookUrl(
      url,
      list.map((x) => x.url),
    );
    if (err) return setError(err);
    if (!events.length) return setError("Subscribe to at least one event.");
    const rand = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join(
      "",
    );
    const ep: WebhookEndpoint = {
      id: `wh_${rand.slice(0, 8)}`,
      url: new URL(url.trim()).toString(),
      events,
      enabled: true,
      secret: `whsec_${rand}`,
      deliveries: [],
    };
    commit([ep, ...list]);
    setSelectedId(ep.id);
    setAdding(false);
    setUrl("");
    setEvents([]);
    setError(null);
  }

  async function record(
    ep: WebhookEndpoint,
    key: string,
    fn: () => Promise<WebhookDelivery> | undefined,
  ) {
    setBusy(key);
    try {
      const d = await fn();
      if (d) patch(ep.id, { deliveries: [d, ...ep.deliveries] });
    } finally {
      setBusy(null);
    }
  }

  const toggleGroup = (group: string[]) => {
    const all = group.every((g) => events.includes(g));
    setEvents((cur) =>
      all ? cur.filter((x) => !group.includes(x)) : Array.from(new Set([...cur, ...group])),
    );
  };

  return (
    <section className={cn("flex flex-col gap-4 font-crm", className)} aria-labelledby="wh-h">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Developers</p>
          <h2 id="wh-h" className="text-lg font-semibold text-crm-fg">
            Webhooks
          </h2>
          <p className="text-xs text-crm-soft">Receive a signed POST when records change.</p>
        </div>
        <Button variant="primary" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          <Plus /> Add endpoint
        </Button>
      </header>

      {adding ? (
        <form
          onSubmit={add}
          aria-label="Add webhook endpoint"
          className="flex flex-col gap-3 rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised"
        >
          <Input
            aria-label="Endpoint URL"
            placeholder="https://api.acme.com/hooks/crm"
            value={url}
            invalid={!!error}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            autoFocus
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(eventCatalog).map(([group, evs]) => {
              const all = evs.every((x) => events.includes(x));
              const some = evs.some((x) => events.includes(x));
              return (
                <fieldset
                  key={group}
                  className="flex flex-col gap-1.5 rounded-crm bg-crm-raised/50 p-3"
                >
                  <legend className="sr-only">{group}</legend>
                  <label className="flex items-center gap-2 text-xs font-medium text-crm-fg">
                    <Checkbox
                      checked={all ? true : some ? "indeterminate" : false}
                      onCheckedChange={() => toggleGroup(evs)}
                    />
                    {group}
                  </label>
                  {evs.map((ev) => (
                    <label
                      key={ev}
                      className="flex items-center gap-2 pl-5 font-mono text-xs text-crm-soft"
                    >
                      <Checkbox
                        checked={events.includes(ev)}
                        onCheckedChange={(v) =>
                          setEvents((c) => (v === true ? [...c, ev] : c.filter((x) => x !== ev)))
                        }
                      />
                      {ev}
                    </label>
                  ))}
                </fieldset>
              );
            })}
          </div>
          {error ? (
            <p role="alert" className="text-xs text-crm-danger">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-crm-subtle">
              {events.length} of {allEvents.length} events
            </span>
            <span className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create endpoint
              </Button>
            </span>
          </div>
        </form>
      ) : null}

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-crm-border p-10 text-center">
          <WebhookIcon className="size-5 text-crm-subtle" aria-hidden />
          <p className="text-sm text-crm-soft">No endpoints yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <ul className="flex flex-col gap-1.5" aria-label="Endpoints">
            {list.map((ep) => {
              const rate = successRate(ep.deliveries);
              return (
                <li key={ep.id}>
                  <button
                    type="button"
                    aria-current={ep.id === selected?.id || undefined}
                    onClick={() => {
                      setSelectedId(ep.id);
                      setReveal(false);
                    }}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-xl border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                      ep.id === selected?.id
                        ? "border-crm-primary bg-crm-card shadow-crm-raised"
                        : "border-crm-border hover:bg-crm-muted",
                    )}
                  >
                    <span className="truncate font-mono text-xs text-crm-fg">{ep.url}</span>
                    <span className="flex items-center gap-2 text-xs text-crm-subtle">
                      <Tag size="sm" color={ep.enabled ? "green" : "neutral"}>
                        {ep.enabled ? "Enabled" : "Disabled"}
                      </Tag>
                      {ep.events.length} events
                      {rate !== null ? (
                        <span className={cn(rate < 90 ? "text-crm-danger" : "text-crm-success")}>
                          {rate}% ok
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected ? (
            <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-crm-border bg-crm-card p-4 shadow-crm-raised">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 truncate font-mono text-sm text-crm-fg">{selected.url}</p>
                <span className="flex items-center gap-2">
                  <Button
                    size="sm"
                    loading={busy === "test"}
                    disabled={!selected.enabled || !onTest}
                    onClick={() => record(selected, "test", () => onTest?.(selected))}
                  >
                    <Send /> Send test
                  </Button>
                  <Switch
                    aria-label="Endpoint enabled"
                    checked={selected.enabled}
                    onCheckedChange={(v) => patch(selected.id, { enabled: v })}
                  />
                </span>
              </div>
              <div>
                <p className="mb-1 text-xs text-crm-soft">Signing secret</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-crm bg-crm-raised px-3 py-2 font-mono text-xs text-crm-fg">
                    {reveal ? selected.secret : `${selected.secret.slice(0, 6)}${"•".repeat(20)}`}
                  </code>
                  <Button
                    size="lg"
                    aria-label={reveal ? "Hide secret" : "Reveal secret"}
                    onClick={() => setReveal((r) => !r)}
                  >
                    {reveal ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {selected.events.map((e) => (
                  <Tag key={e} size="sm" className="font-mono">
                    {e}
                  </Tag>
                ))}
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-crm-fg">Recent deliveries</h3>
                  <Switch
                    size="sm"
                    label="Failed only"
                    checked={onlyFailed}
                    onCheckedChange={setOnlyFailed}
                  />
                </div>
                <ul className="divide-y divide-crm-border rounded-crm border border-crm-border">
                  {selected.deliveries.filter((d) => !onlyFailed || !ok(d.status)).length === 0 ? (
                    <li className="p-4 text-center text-xs text-crm-soft">
                      {onlyFailed ? "No failed deliveries." : "No deliveries yet. Send a test."}
                    </li>
                  ) : null}
                  {selected.deliveries
                    .filter((d) => !onlyFailed || !ok(d.status))
                    .map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Tag
                            size="sm"
                            color={ok(d.status) ? "green" : d.status === 0 ? "neutral" : "red"}
                            className="font-mono tabular-nums"
                          >
                            {d.status || "timeout"}
                          </Tag>
                          <span className="truncate font-mono text-crm-fg">{d.event}</span>
                          {d.attempt > 1 ? (
                            <span className="text-crm-subtle">attempt {d.attempt}</span>
                          ) : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-3 text-crm-subtle">
                          <span
                            className={cn("tabular-nums", d.duration > 3000 && "text-crm-warning")}
                          >
                            {d.duration} ms
                          </span>
                          <span className="hidden sm:inline">
                            {new Date(d.at).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                          {!ok(d.status) && onRetry ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Retry ${d.event}`}
                              loading={busy === d.id}
                              onClick={() => record(selected, d.id, () => onRetry(selected, d))}
                            >
                              <RotateCw />
                            </Button>
                          ) : null}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
              <Button
                variant="danger"
                size="sm"
                className="self-start"
                onClick={() => {
                  commit(list.filter((e) => e.id !== selected.id));
                  setSelectedId("");
                }}
              >
                Delete endpoint
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
