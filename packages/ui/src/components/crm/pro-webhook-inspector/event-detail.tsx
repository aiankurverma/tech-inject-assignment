import { useEffect, useId, useState } from "react";
import { format, formatDistanceStrict } from "date-fns";
import { Clock, Hand, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeView, HeaderTable } from "@/components/crm/pro-webhook-inspector/code-view";
import { SignatureVerifier } from "@/components/crm/pro-webhook-inspector/signature-verifier";
import { OutcomeChip, StatusCodeChip } from "@/components/crm/pro-webhook-inspector/status-chip";
import {
  toMs,
  type DeliveryOutcome,
  type WebhookAttempt,
  type WebhookEndpoint,
  type WebhookEvent,
} from "@/components/crm/pro-webhook-inspector/types";

export interface EventDetailProps {
  event: WebhookEvent;
  attempts: WebhookAttempt[];
  outcome: DeliveryOutcome;
  endpoint: WebhookEndpoint | undefined;
  now: number;
  signatureHeader: string;
  toleranceSeconds: number;
  getSigningSecret?: (endpointId: string) => string | undefined;
  canReplay: boolean;
  replaying: boolean;
  replayError: string | null;
  onReplay: () => void;
}

type Tab = "request" | "response";

export function EventDetail({
  event,
  attempts,
  outcome,
  endpoint,
  now,
  signatureHeader,
  toleranceSeconds,
  getSigningSecret,
  canReplay,
  replaying,
  replayError,
  onReplay,
}: EventDetailProps) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("request");
  const id = useId();
  // Follow the newest attempt when the event changes or a replay lands.
  const newest = attempts[attempts.length - 1]?.id ?? null;
  useEffect(() => setAttemptId(newest), [event.id, newest]);
  const attempt = attempts.find((a) => a.id === attemptId) ?? attempts[attempts.length - 1];
  const sigHeaderValue = attempt
    ? Object.entries(attempt.requestHeaders).find(
        ([k]) => k.toLowerCase() === signatureHeader.toLowerCase(),
      )?.[1]
    : undefined;
  const nextRetry = toMs(event.nextRetryAt);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-crm-border p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-crm-fg">{event.type}</h3>
            <OutcomeChip outcome={outcome} />
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-crm-muted-fg">
            {event.id} → {endpoint?.url ?? event.endpointId}
          </p>
          {Number.isFinite(nextRetry) && (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-crm-warning">
              <Clock className="size-3" /> Next automatic retry{" "}
              {nextRetry > now ? `in ${formatDistanceStrict(nextRetry, now)}` : "imminent"}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={onReplay}
            disabled={!canReplay || replaying}
            className="inline-flex items-center gap-1.5 rounded-md bg-crm-primary px-3 py-1.5 text-xs font-medium text-crm-primary-fg shadow-crm-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {replaying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
            {replaying ? "Replaying…" : "Replay"}
          </button>
          {replayError && (
            <p role="alert" className="max-w-56 text-right text-[11px] text-crm-danger">
              {replayError}
            </p>
          )}
        </div>
      </header>

      <section aria-labelledby={`${id}-att`} className="border-b border-crm-border p-4">
        <h4
          id={`${id}-att`}
          className="mb-2 text-[11px] font-medium uppercase tracking-wide text-crm-muted-fg"
        >
          Delivery attempts ({attempts.length})
        </h4>
        {attempts.length === 0 ? (
          <p className="text-xs text-crm-muted-fg">Queued, no attempt yet.</p>
        ) : (
          <ol role="listbox" aria-label="Delivery attempts" className="relative space-y-1 pl-4">
            <span aria-hidden className="absolute bottom-2 left-[5px] top-2 w-px bg-crm-border" />
            {attempts.map((a, i) => {
              const ok = a.statusCode != null && a.statusCode < 300;
              const sel = a.id === attempt?.id;
              return (
                <li key={a.id} role="option" aria-selected={sel} className="relative">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -left-[14px] top-2.5 size-2 rounded-full ring-2 ring-crm-card",
                      ok ? "bg-crm-success" : "bg-crm-danger",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setAttemptId(a.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs",
                      sel ? "bg-crm-muted text-crm-fg" : "text-crm-soft hover:bg-crm-raised",
                    )}
                  >
                    <StatusCodeChip code={a.statusCode} />
                    <span className="font-medium">#{i + 1}</span>
                    {a.manual && (
                      <Hand className="size-3 text-crm-muted-fg" aria-label="Manual replay" />
                    )}
                    <span className="truncate text-crm-muted-fg">
                      {format(toMs(a.attemptedAt), "MMM d, HH:mm:ss")}
                    </span>
                    <span className="ml-auto tabular-nums text-crm-muted-fg">
                      {a.durationMs != null ? `${a.durationMs} ms` : (a.error ?? "-")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {attempt && (
        <section className="space-y-3 p-4">
          <div
            role="tablist"
            aria-label="Attempt payload"
            className="inline-flex rounded-md border border-crm-border p-0.5"
          >
            {(["request", "response"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                id={`${id}-tab-${t}`}
                aria-selected={tab === t}
                aria-controls={`${id}-panel`}
                onClick={() => setTab(t)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    const n = t === "request" ? "response" : "request";
                    setTab(n);
                    document.getElementById(`${id}-tab-${n}`)?.focus();
                  }
                }}
                tabIndex={tab === t ? 0 : -1}
                className={cn(
                  "rounded px-3 py-1 text-xs capitalize",
                  tab === t ? "bg-crm-muted text-crm-fg" : "text-crm-muted-fg hover:text-crm-fg",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div
            id={`${id}-panel`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${tab}`}
            className="space-y-3"
          >
            {tab === "request" ? (
              <>
                <HeaderTable headers={attempt.requestHeaders} label="Request headers" />
                <CodeView value={event.payload} label="Request body" />
                <SignatureVerifier
                  key={event.endpointId}
                  payload={event.payload}
                  header={sigHeaderValue}
                  headerName={signatureHeader}
                  attemptedAtMs={toMs(attempt.attemptedAt)}
                  defaultSecret={getSigningSecret?.(event.endpointId)}
                  toleranceSeconds={toleranceSeconds}
                />
              </>
            ) : attempt.statusCode == null ? (
              <p className="rounded-crm border border-tag-red-border bg-tag-red-bg p-3 font-mono text-xs text-tag-red-text">
                {attempt.error ?? "No response received"}
              </p>
            ) : (
              <>
                <HeaderTable headers={attempt.responseHeaders} label="Response headers" />
                <CodeView value={attempt.responseBody} label="Response body" />
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
