export type ApiKeyEnvironment = "live" | "test";

/** Stored status. "expired" is derived at render time from `expiresAt`. */
export type ApiKeyStatus = "active" | "expired" | "revoked";

export interface ApiKeyScope {
  /** Machine id sent to the backend, e.g. "contacts:read". */
  id: string;
  label: string;
  description?: string;
  /** Scopes sharing a group render together in the create dialog. */
  group?: string;
  /** Marks scopes that grant write/destructive access (highlighted in the UI). */
  sensitive?: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  environment: ApiKeyEnvironment;
  /** Public, non-secret prefix shown in the list, e.g. "kb_live_". */
  prefix: string;
  /** Last four characters of the secret, safe to display. */
  last4: string;
  scopes: string[];
  /** ISO timestamps. */
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt?: string | null;
  createdBy?: string;
  /** Daily request counts, oldest first (drives the sparkline). */
  usage?: number[];
}

export interface CreateApiKeyInput {
  name: string;
  environment: ApiKeyEnvironment;
  scopes: string[];
  /** ISO timestamp or null for a non-expiring key. */
  expiresAt: string | null;
}

/** Returned by create/rotate. `secret` is shown exactly once and never stored by the component. */
export interface IssuedApiKey {
  key: ApiKey;
  secret: string;
}

export type ApiKeySortField = "name" | "createdAt" | "lastUsedAt" | "expiresAt" | "usage";
export type ApiKeyStatusFilter = "all" | ApiKeyStatus;
