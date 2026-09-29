/**
 * Request drafting for the playground: the editable draft per operation, turning it into a concrete
 * request (URL, headers, body) and executing it with timing. Pure functions with no UI dependencies.
 */
import type {
  ApiOperation,
  ApiSpec,
  SecurityScheme,
} from "@/components/crm/pro-api-playground/openapi";
import { sampleFromSchema } from "@/components/crm/pro-api-playground/openapi";
import type { BuiltRequest } from "@/components/crm/pro-api-playground/snippets";

export interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface AuthValues {
  /** Selected security scheme id, or "none". */
  scheme: string;
  token: string;
  username: string;
  password: string;
  apiKey: string;
}

export interface RequestDraft {
  operationId: string;
  server: string;
  /** Values keyed by "in:name" for declared path/query/header parameters. */
  params: Record<string, string>;
  /** Free-form extra headers. */
  headers: KeyValue[];
  body: string;
}

export interface ExecutedResponse {
  status: number;
  statusText: string;
  ok: boolean;
  headers: [string, string][];
  body: string;
  contentType: string;
  sizeBytes: number;
  durationMs: number;
  /** Time to response headers (TTFB-ish) in ms. */
  headersMs: number;
  url: string;
}

let seq = 0;
export const kvId = () => `kv${Date.now().toString(36)}${(seq++).toString(36)}`;

const str = (v: unknown) =>
  v === undefined || v === null ? "" : typeof v === "string" ? v : JSON.stringify(v);

export function initialDraft(op: ApiOperation, server: string): RequestDraft {
  const params: Record<string, string> = {};
  for (const p of op.parameters) {
    if (p.in === "cookie") continue;
    const v = p.example ?? p.schema.example ?? p.schema.default;
    params[`${p.in}:${p.name}`] = p.required || v !== undefined ? str(v) : "";
  }
  const body = op.requestBody
    ? JSON.stringify(op.requestBody.example ?? sampleFromSchema(op.requestBody.schema), null, 2)
    : "";
  return { operationId: op.id, server, params, headers: [], body };
}

export function initialAuth(spec: ApiSpec): AuthValues {
  return {
    scheme: spec.securitySchemes[0]?.id ?? "none",
    token: "",
    username: "",
    password: "",
    apiKey: "",
  };
}

/** Required path/query/header parameters that are still blank. */
export function missingParams(op: ApiOperation, draft: RequestDraft): string[] {
  return op.parameters
    .filter(
      (p) => p.required && p.in !== "cookie" && !(draft.params[`${p.in}:${p.name}`] ?? "").trim(),
    )
    .map((p) => p.name);
}

function b64(s: string) {
  try {
    return btoa(unescape(encodeURIComponent(s)));
  } catch {
    return "";
  }
}

export function buildRequest(
  op: ApiOperation,
  draft: RequestDraft,
  auth: AuthValues,
  schemes: SecurityScheme[],
  opts: { maskSecrets?: boolean } = {},
): BuiltRequest {
  const secret = (s: string) => (opts.maskSecrets && s ? "<redacted>" : s);
  let path = op.path;
  const query = new URLSearchParams();
  const headers: [string, string][] = [];
  for (const p of op.parameters) {
    const v = draft.params[`${p.in}:${p.name}`] ?? "";
    if (p.in === "path") path = path.split(`{${p.name}}`).join(encodeURIComponent(v));
    else if (!v) continue;
    else if (p.in === "query") query.append(p.name, v);
    else if (p.in === "header") headers.push([p.name, v]);
  }
  const scheme = schemes.find((s) => s.id === auth.scheme);
  if (scheme?.type === "bearer" && auth.token)
    headers.push(["Authorization", `Bearer ${secret(auth.token)}`]);
  if (scheme?.type === "basic" && (auth.username || auth.password))
    headers.push([
      "Authorization",
      `Basic ${opts.maskSecrets ? "<redacted>" : b64(`${auth.username}:${auth.password}`)}`,
    ]);
  if (scheme?.type === "apiKey" && auth.apiKey) {
    if (scheme.in === "query") query.append(scheme.name, secret(auth.apiKey));
    else if (scheme.in === "header") headers.push([scheme.name, secret(auth.apiKey)]);
    else headers.push(["Cookie", `${scheme.name}=${secret(auth.apiKey)}`]);
  }
  const hasBody =
    !!op.requestBody && draft.body.trim() !== "" && op.method !== "get" && op.method !== "head";
  if (hasBody && !headers.some(([k]) => k.toLowerCase() === "content-type"))
    headers.push(["Content-Type", op.requestBody!.contentType]);
  for (const h of draft.headers)
    if (h.enabled && h.key.trim()) headers.push([h.key.trim(), h.value]);
  const base = draft.server.replace(/\/+$/, "");
  const qs = query.toString();
  return {
    method: op.method.toUpperCase(),
    url: `${base}${path}${qs ? `?${qs}` : ""}`,
    headers,
    body: hasBody ? draft.body : undefined,
  };
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** Executes a request with the given fetcher, measuring header and total time. */
export async function executeRequest(
  req: BuiltRequest,
  fetcher: Fetcher,
  signal?: AbortSignal,
): Promise<ExecutedResponse> {
  const t0 = performance.now();
  const res = await fetcher(req.url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    signal,
  });
  const headersMs = performance.now() - t0;
  const buf = await res.arrayBuffer();
  const durationMs = performance.now() - t0;
  const headers: [string, string][] = [];
  res.headers.forEach((v, k) => headers.push([k, v]));
  return {
    status: res.status,
    statusText: res.statusText,
    ok: res.ok,
    headers,
    body: new TextDecoder().decode(buf),
    contentType: res.headers.get("content-type") ?? "",
    sizeBytes: buf.byteLength,
    durationMs,
    headersMs,
    url: req.url,
  };
}

export function formatBytes(n: number) {
  return n < 1024
    ? `${n} B`
    : n < 1024 * 1024
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1024 / 1024).toFixed(2)} MB`;
}
