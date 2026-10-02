// Thin client for the public Kitbase API (same endpoints the catalogue and CLI use).

export const DEFAULT_API = "https://kitbase.onrender.com";

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface ApiOptions {
  api?: string;
  token?: string;
  fetch?: FetchLike;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function createApi(opts: ApiOptions = {}) {
  const base = (opts.api || DEFAULT_API).replace(/\/+$/, "");
  const token = opts.token || undefined;
  const doFetch: FetchLike = opts.fetch ?? ((url, init) => fetch(url, init));

  async function get<T>(path: string): Promise<T> {
    const res = await doFetch(`${base}/api${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: unknown };
      const message =
        typeof body.message === "string" ? body.message : `Request failed (${res.status}).`;
      const hint =
        (res.status === 401 || res.status === 403) && !token
          ? " Set KITBASE_TOKEN to a token from your Kitbase Account page."
          : "";
      throw new ApiError(`${message}${hint}`, res.status);
    }
    return (await res.json()) as T;
  }

  return { base, hasToken: Boolean(token), get };
}

export type Api = ReturnType<typeof createApi>;
