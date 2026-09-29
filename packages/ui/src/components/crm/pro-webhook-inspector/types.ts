/** A single HTTP delivery attempt of a webhook event to an endpoint. */
export interface WebhookAttempt {
  id: string;
  /** ISO string, epoch ms or Date. */
  attemptedAt: string | number | Date;
  /** HTTP status returned by the endpoint; null when no response (timeout, DNS, TLS). */
  statusCode: number | null;
  durationMs: number | null;
  /** Transport-level error when statusCode is null, e.g. "ETIMEDOUT after 30s". */
  error?: string;
  requestHeaders: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  /** True when the attempt was triggered manually from the inspector. */
  manual?: boolean;
}

export interface WebhookEvent {
  id: string;
  /** Event type, e.g. "invoice.paid". */
  type: string;
  endpointId: string;
  createdAt: string | number | Date;
  /** Raw request body exactly as signed and sent (usually JSON). */
  payload: string;
  attempts: WebhookAttempt[];
  /** When the next automatic retry is scheduled; null / undefined when retries are exhausted. */
  nextRetryAt?: string | number | Date | null;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  description?: string;
}

export type DeliveryOutcome = "succeeded" | "retrying" | "failed" | "pending";

/** Flattened, precomputed row the table works with (computed once per event). */
export interface WebhookRow {
  event: WebhookEvent;
  id: string;
  type: string;
  endpointId: string;
  endpointUrl: string;
  outcome: DeliveryOutcome;
  lastStatus: number | null;
  attemptCount: number;
  lastAttemptAt: number;
  createdAt: number;
}

export const toMs = (v: string | number | Date | null | undefined): number =>
  v == null ? NaN : v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v);

export function outcomeOf(event: WebhookEvent, attempts = event.attempts): DeliveryOutcome {
  const last = attempts[attempts.length - 1];
  if (!last) return "pending";
  if (last.statusCode != null && last.statusCode >= 200 && last.statusCode < 300)
    return "succeeded";
  return event.nextRetryAt != null ? "retrying" : "failed";
}
