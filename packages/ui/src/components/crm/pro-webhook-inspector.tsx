import { useCallback, useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { AlertTriangle, Inbox, Loader2, Search, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";
import { EventTable } from "@/components/crm/pro-webhook-inspector/event-table";
import { EventDetail } from "@/components/crm/pro-webhook-inspector/event-detail";
import { OUTCOME_LABEL } from "@/components/crm/pro-webhook-inspector/status-chip";
import {
  outcomeOf,
  toMs,
  type DeliveryOutcome,
  type WebhookAttempt,
  type WebhookEndpoint,
  type WebhookEvent,
  type WebhookRow,
} from "@/components/crm/pro-webhook-inspector/types";

export type {
  DeliveryOutcome,
  WebhookAttempt,
  WebhookEndpoint,
  WebhookEvent,
} from "@/components/crm/pro-webhook-inspector/types";

export type OutcomeFilter = DeliveryOutcome | "all";

export interface ProWebhookInspectorProps {
  events: WebhookEvent[];
  endpoints: WebhookEndpoint[];
  /** Shows a skeleton instead of the table. */
  loading?: boolean;
  /** Error message; renders an error state with an optional retry. */
  error?: string | null;
  onRetryLoad?: () => void;
  /**
   * Re-sends the event. Resolve with the new attempt to append it to the timeline immediately;
   * reject to surface the error. When omitted the Replay button is disabled.
   */
  onReplay?: (event: WebhookEvent) => Promise<WebhookAttempt | void>;
  /** Supplies the signing secret for an endpoint to prefill the verifier. */
  getSigningSecret?: (endpointId: string) => string | undefined;
  /** Header carrying "t=…,v1=…". */
  signatureHeader?: string;
  toleranceSeconds?: number;
  endpointId?: string | "all";
  defaultEndpointId?: string | "all";
  onEndpointChange?: (id: string | "all") => void;
  outcome?: OutcomeFilter;
  defaultOutcome?: OutcomeFilter;
  onOutcomeChange?: (o: OutcomeFilter) => void;
  selectedEventId?: string | null;
  defaultSelectedEventId?: string | null;
  onSelectedEventChange?: (id: string | null) => void;
  /** Reference time for relative labels; defaults to the time of mount. */
  now?: number;
  /** Reuse the app's React Query client; one is created otherwise. */
  queryClient?: QueryClient;
  height?: number;
  title?: ReactNode;
  className?: string;
}

function useControlled<T>(value: T | undefined, initial: T, onChange?: (v: T) => void) {
  const [inner, setInner] = useState(initial);
  const current = value !== undefined ? value : inner;
  const set = useCallback(
    (v: T) => {
      if (value === undefined) setInner(v);
      onChange?.(v);
    },
    [value, onChange],
  );
  return [current, set] as const;
}

/** Webhook delivery inspector: filterable 10k+ event log, attempt timeline, bodies, HMAC check, replay. */
export function ProWebhookInspector({ queryClient, ...props }: ProWebhookInspectorProps) {
  const [fallback] = useState(() => queryClient ?? new QueryClient());
  return (
    <QueryClientProvider client={queryClient ?? fallback}>
      <Inspector {...props} />
    </QueryClientProvider>
  );
}

const OUTCOMES: OutcomeFilter[] = ["all", "succeeded", "retrying", "failed", "pending"];

function Inspector({
  events,
  endpoints,
  loading = false,
  error = null,
  onRetryLoad,
  onReplay,
  getSigningSecret,
  signatureHeader = "Webhook-Signature",
  toleranceSeconds = 300,
  endpointId: endpointProp,
  defaultEndpointId = "all",
  onEndpointChange,
  outcome: outcomeProp,
  defaultOutcome = "all",
  onOutcomeChange,
  selectedEventId,
  defaultSelectedEventId = null,
  onSelectedEventChange,
  now: nowProp,
  height = 680,
  title = "Webhook deliveries",
  className,
}: Omit<ProWebhookInspectorProps, "queryClient">) {
  const [mountNow] = useState(() => Date.now());
  const now = nowProp ?? mountNow;
  const [endpointId, setEndpointId] = useControlled(
    endpointProp,
    defaultEndpointId,
    onEndpointChange,
  );
  const [outcome, setOutcome] = useControlled(outcomeProp, defaultOutcome, onOutcomeChange);
  const [selectedId, setSelectedId] = useControlled<string | null>(
    selectedEventId,
    defaultSelectedEventId,
    onSelectedEventChange,
  );
  const [sorting, setSorting] = useState<SortingState>([{ id: "lastAttemptAt", desc: true }]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [visible, setVisible] = useState(0);
  /** Attempts appended by replays, keyed by event id, until the parent refetches. */
  const [extra, setExtra] = useState<Record<string, WebhookAttempt[]>>({});

  const endpointById = useMemo(() => new Map(endpoints.map((e) => [e.id, e])), [endpoints]);

  const rows = useMemo<WebhookRow[]>(
    () =>
      events.map((ev) => {
        const attempts = extra[ev.id] ? [...ev.attempts, ...extra[ev.id]!] : ev.attempts;
        const last = attempts[attempts.length - 1];
        return {
          event: ev,
          id: ev.id,
          type: ev.type,
          endpointId: ev.endpointId,
          endpointUrl: endpointById.get(ev.endpointId)?.url ?? ev.endpointId,
          outcome: outcomeOf(ev, attempts),
          lastStatus: last?.statusCode ?? null,
          attemptCount: attempts.length,
          lastAttemptAt: last ? toMs(last.attemptedAt) : NaN,
          createdAt: toMs(ev.createdAt),
        };
      }),
    [events, extra, endpointById],
  );

  const counts = useMemo(() => {
    const c: Record<OutcomeFilter, number> = {
      all: 0,
      succeeded: 0,
      retrying: 0,
      failed: 0,
      pending: 0,
    };
    for (const r of rows) {
      if (endpointId !== "all" && r.endpointId !== endpointId) continue;
      c.all++;
      c[r.outcome]++;
    }
    return c;
  }, [rows, endpointId]);

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const f: ColumnFiltersState = [];
    if (endpointId !== "all") f.push({ id: "endpointId", value: endpointId });
    if (outcome !== "all") f.push({ id: "outcome", value: outcome });
    return f;
  }, [endpointId, outcome]);

  const selectedRow = useMemo(() => rows.find((r) => r.id === selectedId), [rows, selectedId]);

  const replay = useMutation({
    mutationFn: async (ev: WebhookEvent) => {
      if (!onReplay) throw new Error("Replay is not configured");
      return onReplay(ev);
    },
    onSuccess: (attempt, ev) => {
      if (attempt)
        setExtra((x) => ({ ...x, [ev.id]: [...(x[ev.id] ?? []), { ...attempt, manual: true }] }));
    },
  });

  const successRate = counts.all ? Math.round((counts.succeeded / counts.all) * 1000) / 10 : 0;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
      style={{ height }}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-crm-border px-4 py-3">
        <Webhook className="size-4 text-crm-icon" aria-hidden />
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-crm-muted-fg">
          {counts.all.toLocaleString()} events · {successRate}% delivered
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="wh-endpoint">
            Endpoint
          </label>
          <select
            id="wh-endpoint"
            value={endpointId}
            onChange={(e) => setEndpointId(e.target.value)}
            className="max-w-56 rounded-md border border-crm-input bg-crm-bg px-2 py-1.5 text-xs text-crm-fg outline-none focus:border-crm-ring"
          >
            <option value="all">All endpoints</option>
            {endpoints.map((e) => (
              <option key={e.id} value={e.id}>
                {e.description ? `${e.description} · ` : ""}
                {e.url.replace(/^https?:\/\//, "")}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 rounded-md border border-crm-input bg-crm-bg px-2 focus-within:border-crm-ring">
            <Search className="size-3.5 text-crm-muted-fg" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Event id or type"
              aria-label="Search events"
              className="w-40 bg-transparent py-1.5 text-xs text-crm-fg outline-none placeholder:text-crm-subtle"
            />
          </div>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="Delivery status"
        className="flex gap-1 overflow-x-auto border-b border-crm-border px-4 py-2"
      >
        {OUTCOMES.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={outcome === o}
            onClick={() => setOutcome(o)}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1 text-xs",
              outcome === o ? "bg-crm-muted text-crm-fg" : "text-crm-muted-fg hover:text-crm-fg",
            )}
          >
            {o === "all" ? "All" : OUTCOME_LABEL[o]}{" "}
            <span className="tabular-nums text-crm-subtle">{counts[o].toLocaleString()}</span>
          </button>
        ))}
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
        >
          <AlertTriangle className="size-6 text-crm-danger" />
          <p className="text-sm text-crm-fg">Could not load webhook events</p>
          <p className="max-w-sm text-xs text-crm-muted-fg">{error}</p>
          {onRetryLoad && (
            <button
              type="button"
              onClick={onRetryLoad}
              className="rounded-md border border-crm-input px-3 py-1.5 text-xs hover:bg-crm-raised"
            >
              Try again
            </button>
          )}
        </div>
      ) : loading ? (
        <div aria-busy="true" aria-label="Loading events" className="flex-1 space-y-2 p-4">
          <span className="inline-flex items-center gap-2 text-xs text-crm-muted-fg">
            <Loader2 className="size-3.5 animate-spin" /> Loading deliveries…
          </span>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-crm-raised" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <Inbox className="size-6 text-crm-muted-fg" />
          <p className="text-sm">No webhook events yet</p>
          <p className="text-xs text-crm-muted-fg">
            Events appear here as soon as the first one is sent.
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1.25fr)_minmax(320px,1fr)]">
          <div className="flex min-h-0 flex-col border-crm-border md:border-r">
            <EventTable
              rows={rows}
              sorting={sorting}
              onSortingChange={setSorting}
              columnFilters={columnFilters}
              globalFilter={deferredQuery}
              selectedId={selectedId}
              onSelect={setSelectedId}
              now={now}
              onVisibleCountChange={setVisible}
            />
            <div
              className="border-t border-crm-border px-3 py-1.5 text-[11px] text-crm-muted-fg"
              aria-live="polite"
            >
              {visible.toLocaleString()} shown · ↑↓ / j k to move
            </div>
          </div>
          <div className="hidden min-h-0 flex-col md:flex">
            {selectedRow ? (
              <EventDetail
                event={selectedRow.event}
                attempts={
                  extra[selectedRow.id]
                    ? [...selectedRow.event.attempts, ...extra[selectedRow.id]!]
                    : selectedRow.event.attempts
                }
                outcome={selectedRow.outcome}
                endpoint={endpointById.get(selectedRow.endpointId)}
                now={now}
                signatureHeader={signatureHeader}
                toleranceSeconds={toleranceSeconds}
                getSigningSecret={getSigningSecret}
                canReplay={!!onReplay}
                replaying={replay.isPending && replay.variables?.id === selectedRow.id}
                replayError={
                  replay.isError && replay.variables?.id === selectedRow.id
                    ? replay.error instanceof Error
                      ? replay.error.message
                      : "Replay failed"
                    : null
                }
                onReplay={() => replay.mutate(selectedRow.event)}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-xs text-crm-muted-fg">
                Select an event to inspect its attempts, payload and signature.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
