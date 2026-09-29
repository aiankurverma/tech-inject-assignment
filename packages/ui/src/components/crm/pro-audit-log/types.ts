export type AuditActorKind = "user" | "service" | "api_key" | "system";
export type AuditOutcome = "success" | "failure" | "denied";
export type AuditTimeMode = "relative" | "absolute";

export interface AuditActor {
  id: string;
  name: string;
  email?: string;
  kind?: AuditActorKind;
}

export interface AuditResource {
  /** Resource type, used by the "Resource" facet, e.g. "deal", "api_key", "role". */
  type: string;
  id: string;
  name?: string;
}

export interface AuditEvent {
  id: string;
  /** ISO 8601 timestamp (or epoch ms). */
  occurredAt: string | number;
  actor: AuditActor;
  /** Dotted verb such as "deal.updated" or "member.role_changed". */
  action: string;
  resource: AuditResource;
  outcome?: AuditOutcome;
  ip?: string;
  location?: string;
  userAgent?: string;
  requestId?: string;
  /** Snapshot before the change (omit for create events). */
  before?: unknown;
  /** Snapshot after the change (omit for delete events). */
  after?: unknown;
  metadata?: Record<string, unknown>;
}

export interface AuditFilters {
  q: string;
  actors: string[];
  actions: string[];
  resources: string[];
  /** Inclusive yyyy-MM-dd lower bound, or null. */
  from: string | null;
  /** Inclusive yyyy-MM-dd upper bound, or null. */
  to: string | null;
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  q: "",
  actors: [],
  actions: [],
  resources: [],
  from: null,
  to: null,
};

export interface AuditFacetBucket {
  value: string;
  label?: string;
  count: number;
}

export interface AuditFacets {
  actors?: AuditFacetBucket[];
  actions?: AuditFacetBucket[];
  resources?: AuditFacetBucket[];
}

export interface AuditPage {
  events: AuditEvent[];
  /** Opaque cursor for the next page, or null when exhausted. */
  nextCursor: string | null;
  /** Total matching events (used for aria-rowcount and the counter). */
  total?: number;
  /** Server-side facet counts. Falls back to counts over loaded rows when omitted. */
  facets?: AuditFacets;
}

export interface AuditFetchArgs {
  cursor: string | null;
  filters: AuditFilters;
  pageSize: number;
  signal: AbortSignal;
}

export type AuditFetchPage = (args: AuditFetchArgs) => Promise<AuditPage>;

export type AuditColumnId = "time" | "actor" | "action" | "resource" | "outcome" | "source";
