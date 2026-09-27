/** Fetch helpers for the feature-radar plugin (same-origin, credentials same-origin). */

export class FeatureApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "FeatureApiError";
  }
}

async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const send = () =>
    fetch(path, {
      credentials: "same-origin",
      ...rest,
      headers: {
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  let res: Response;
  try {
    res = await send();
    // Admin access cookie lasts 15 minutes: renew it once from the refresh cookie, then retry.
    if (res.status === 401 && path.startsWith("/api/admin/")) {
      const renewed = await fetch("/api/admin/refresh", {
        method: "POST",
        credentials: "same-origin",
      });
      if (renewed.ok) res = await send();
    }
  } catch {
    throw new FeatureApiError(0, "network", "Cannot reach the server.");
  }
  const contentType = res.headers.get("content-type") ?? "";
  const body: unknown = contentType.includes("json") ? await res.json() : await res.text();
  if (!res.ok) {
    const b =
      typeof body === "object" && body !== null
        ? (body as { error?: string; message?: string })
        : {};
    throw new FeatureApiError(
      res.status,
      b.error ?? "error",
      b.message ?? `Request failed (${res.status})`,
    );
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LookupBuilding {
  status: "building";
  term: string;
  eta: string | null; // ISO date
  interested: number | null;
}

export interface LookupNone {
  status: "none";
}

export type LookupResult = LookupBuilding | LookupNone;

export interface FeatureRequestRow {
  id: string;
  term: string;
  searchCount: number;
  status: "new" | "valid" | "rejected" | "building";
  eta: string | null; // ISO date
  lastSearchedAt: string;
  createdAt: string;
  buildStatus: "idle" | "running" | "done" | "failed";
  buildError: string | null;
  draftSlug: string | null;
}

export interface PatchBody {
  status: FeatureRequestRow["status"];
  etaDays?: number;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Report a failed search term. Fire-and-forget safe; ignores 429 silently. */
export async function reportSearch(term: string): Promise<void> {
  await apiFetch<void>("/api/features/searches", {
    method: "POST",
    json: { term },
  });
}

/** Check if a term is being built. */
export async function lookupFeature(term: string): Promise<LookupResult> {
  return apiFetch<LookupResult>(`/api/features/lookup?term=${encodeURIComponent(term)}`);
}

// ---------------------------------------------------------------------------
// Admin helpers
// ---------------------------------------------------------------------------

export async function listFeatureRequests(): Promise<FeatureRequestRow[]> {
  return apiFetch<FeatureRequestRow[]>("/api/admin/features");
}

export async function patchFeatureRequest(id: string, body: PatchBody): Promise<FeatureRequestRow> {
  return apiFetch<FeatureRequestRow>(`/api/admin/features/${id}`, {
    method: "PATCH",
    json: body,
  });
}

export async function deleteFeatureRequest(id: string): Promise<void> {
  await apiFetch<void>(`/api/admin/features/${id}`, { method: "DELETE" });
}

/** Start an AI draft build for a "building" feature request (202; poll the list). */
export async function generateDraft(id: string): Promise<{ buildStatus: "running" }> {
  return apiFetch<{ buildStatus: "running" }>(`/api/admin/features/${id}/generate`, {
    method: "POST",
  });
}
