export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

/** Endpoints that must never trigger a refresh-and-retry (it would loop or make no sense). */
const NO_REFRESH = /\/(login|logout|refresh)$/;

/** One refresh at a time per page: parallel 401s wait for the same call. */
const inFlight = new Map<string, Promise<boolean>>();
function refreshSession(path: string): Promise<boolean> {
  const url = path.startsWith("/api/admin/") ? "/api/admin/refresh" : "/api/auth/refresh";
  let p = inFlight.get(url);
  if (!p) {
    p = fetch(url, { method: "POST", credentials: "same-origin" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => inFlight.delete(url));
    inFlight.set(url, p);
  }
  return p;
}

/**
 * fetch wrapper: same-origin cookies, JSON in/out, readable errors.
 * A 401 (15-minute access cookie expired) triggers one refresh, then one retry.
 */
export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
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
    if (res.status === 401 && !NO_REFRESH.test(path) && (await refreshSession(path))) {
      res = await send();
    }
  } catch {
    throw new ApiError(0, "network", "Cannot reach the server. Check your connection.");
  }
  const type = res.headers.get("content-type") ?? "";
  const body: unknown = type.includes("json") ? await res.json() : await res.text();
  if (!res.ok) {
    const b = (typeof body === "object" && body !== null ? body : {}) as {
      error?: string;
      message?: string;
      details?: string[];
    };
    throw new ApiError(
      res.status,
      b.error ?? "error",
      b.message ?? `Request failed (${res.status})`,
      b.details,
    );
  }
  return body as T;
}

export interface PreviewPayload {
  slug: string;
  version: string;
  themeCss: string;
  files: { path: string; content: string }[];
  examples: { title: string; code: string }[];
}
