/**
 * Minimal, dependency-free OpenAPI 3.x resolver for the playground: walks paths into operations,
 * merges path/operation parameters, resolves local $refs (cycle-safe) and derives example bodies.
 * Built in-house because the full-featured parsers (@scalar/*) are not approved for this component.
 * External refs ("other.yaml#/...") are not fetched; they resolve to an empty schema.
 */

export type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: unknown[];
  example?: unknown;
  examples?: unknown[];
  default?: unknown;
  format?: string;
  description?: string;
  nullable?: boolean;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  additionalProperties?: boolean | JsonSchema;
  $ref?: string;
  [k: string]: unknown;
};

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options";
export const HTTP_METHODS: HttpMethod[] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
];

export type ParamLocation = "path" | "query" | "header" | "cookie";

export interface ApiParameter {
  name: string;
  in: ParamLocation;
  required: boolean;
  description?: string;
  schema: JsonSchema;
  example?: unknown;
  deprecated?: boolean;
}

export type SecurityScheme =
  | { id: string; type: "bearer"; description?: string; bearerFormat?: string }
  | { id: string; type: "basic"; description?: string }
  | {
      id: string;
      type: "apiKey";
      description?: string;
      name: string;
      in: "header" | "query" | "cookie";
    }
  | { id: string; type: "unsupported"; description?: string; raw: string };

export interface ApiOperation {
  /** Stable key: "METHOD /path". */
  id: string;
  operationId?: string;
  method: HttpMethod;
  path: string;
  tag: string;
  summary?: string;
  description?: string;
  deprecated?: boolean;
  parameters: ApiParameter[];
  requestBody?: { required: boolean; contentType: string; schema: JsonSchema; example?: unknown };
  /** Security scheme ids that satisfy this operation ([] = public). */
  security: string[];
  responses: { status: string; description?: string }[];
}

export interface ApiSpec {
  title: string;
  version: string;
  description?: string;
  servers: { url: string; description?: string }[];
  tags: { name: string; description?: string; operations: ApiOperation[] }[];
  operations: ApiOperation[];
  securitySchemes: SecurityScheme[];
  /** Non-fatal problems found while resolving (bad refs, unsupported schemes). */
  warnings: string[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function pointer(doc: Obj, ref: string): unknown {
  if (!ref.startsWith("#/")) return undefined;
  let cur: unknown = doc;
  for (const raw of ref.slice(2).split("/")) {
    const key = decodeURIComponent(raw).replace(/~1/g, "/").replace(/~0/g, "~");
    if (!isObj(cur) && !Array.isArray(cur)) return undefined;
    cur = (cur as Obj)[key];
  }
  return cur;
}

/** Resolves a single $ref chain (non-recursive) for parameter/body/response objects. */
function shallow(doc: Obj, node: unknown, warnings: string[], depth = 0): Obj {
  if (!isObj(node)) return {};
  if (typeof node.$ref === "string") {
    if (depth > 20) return {};
    const target = pointer(doc, node.$ref);
    if (target === undefined) {
      warnings.push(`Unresolved $ref ${node.$ref}`);
      return {};
    }
    return shallow(doc, target, warnings, depth + 1);
  }
  return node;
}

/** Deep-resolves a schema. Recursive references are cut after one expansion (marked x-circular). */
export function resolveSchema(
  doc: Obj,
  node: unknown,
  warnings: string[],
  stack: string[] = [],
): JsonSchema {
  if (Array.isArray(node))
    return node.map((n) => resolveSchema(doc, n, warnings, stack)) as unknown as JsonSchema;
  if (!isObj(node)) return node as JsonSchema;
  if (typeof node.$ref === "string") {
    const ref = node.$ref;
    if (stack.includes(ref))
      return { type: "object", description: `Circular reference to ${ref}`, "x-circular": ref };
    const target = pointer(doc, ref);
    if (target === undefined) {
      warnings.push(`Unresolved $ref ${ref}`);
      return {};
    }
    return resolveSchema(doc, target, warnings, [...stack, ref]);
  }
  const out: Obj = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] =
      k === "example" || k === "default" || k === "enum"
        ? v
        : resolveSchema(doc, v, warnings, stack);
  }
  return out as JsonSchema;
}

function toParam(doc: Obj, raw: unknown, warnings: string[]): ApiParameter | null {
  const p = shallow(doc, raw, warnings);
  if (typeof p.name !== "string" || typeof p.in !== "string") return null;
  return {
    name: p.name,
    in: p.in as ParamLocation,
    required: p.in === "path" ? true : Boolean(p.required),
    description: typeof p.description === "string" ? p.description : undefined,
    schema: resolveSchema(doc, p.schema ?? { type: "string" }, warnings),
    example: p.example,
    deprecated: Boolean(p.deprecated),
  };
}

function schemes(doc: Obj, warnings: string[]): SecurityScheme[] {
  const comps = isObj(doc.components) ? doc.components : {};
  const raw = isObj(comps.securitySchemes) ? comps.securitySchemes : {};
  return Object.entries(raw).map(([id, v]) => {
    const s = shallow(doc, v, warnings);
    const description = typeof s.description === "string" ? s.description : undefined;
    const scheme = String(s.scheme ?? "").toLowerCase();
    if (s.type === "http" && scheme === "bearer")
      return {
        id,
        type: "bearer",
        description,
        bearerFormat: s.bearerFormat as string | undefined,
      };
    if (s.type === "http" && scheme === "basic") return { id, type: "basic", description };
    if (s.type === "apiKey" && typeof s.name === "string")
      return {
        id,
        type: "apiKey",
        description,
        name: s.name,
        in: (s.in as "header" | "query" | "cookie") ?? "header",
      };
    if (s.type === "oauth2" || s.type === "openIdConnect")
      // The token is still sent as a bearer header; the flow itself happens outside the playground.
      return { id, type: "bearer", description: description ?? `${String(s.type)} access token` };
    warnings.push(`Security scheme "${id}" (${String(s.type)}) is not supported`);
    return { id, type: "unsupported", description, raw: String(s.type) };
  });
}

/** Parses an OpenAPI 3.0/3.1 document (already JSON-parsed) into a navigable spec. */
export function parseOpenApi(input: unknown): ApiSpec {
  if (!isObj(input)) throw new Error("OpenAPI document must be a JSON object");
  const doc = input;
  if (typeof doc.openapi !== "string" || !doc.openapi.startsWith("3"))
    throw new Error(
      `Only OpenAPI 3.x is supported (got ${String(doc.openapi ?? doc.swagger ?? "unknown")})`,
    );
  const warnings: string[] = [];
  const info = isObj(doc.info) ? doc.info : {};
  const servers = Array.isArray(doc.servers)
    ? doc.servers.filter(isObj).map((s) => ({
        url: String(s.url ?? ""),
        description: s.description as string | undefined,
      }))
    : [];
  const globalSecurity = Array.isArray(doc.security) ? doc.security : [];
  const ops: ApiOperation[] = [];
  const paths = isObj(doc.paths) ? doc.paths : {};

  for (const [path, rawItem] of Object.entries(paths)) {
    const item = shallow(doc, rawItem, warnings);
    const shared = Array.isArray(item.parameters) ? item.parameters : [];
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (!isObj(op)) continue;
      const params = new Map<string, ApiParameter>();
      for (const raw of [...shared, ...(Array.isArray(op.parameters) ? op.parameters : [])]) {
        const p = toParam(doc, raw, warnings);
        if (p) params.set(`${p.in}:${p.name}`, p); // operation-level wins over path-level
      }
      let requestBody: ApiOperation["requestBody"];
      if (op.requestBody) {
        const rb = shallow(doc, op.requestBody, warnings);
        const content = isObj(rb.content) ? rb.content : {};
        const contentType =
          Object.keys(content).find((c) => c.includes("json")) ??
          Object.keys(content)[0] ??
          "application/json";
        const media = shallow(doc, content[contentType], warnings);
        requestBody = {
          required: Boolean(rb.required),
          contentType,
          schema: resolveSchema(doc, media.schema ?? {}, warnings),
          example:
            media.example ??
            (isObj(media.examples)
              ? shallow(doc, Object.values(media.examples)[0], warnings).value
              : undefined),
        };
      }
      const sec = Array.isArray(op.security) ? op.security : globalSecurity;
      const tags = Array.isArray(op.tags) ? op.tags : [];
      ops.push({
        id: `${method.toUpperCase()} ${path}`,
        operationId: typeof op.operationId === "string" ? op.operationId : undefined,
        method,
        path,
        tag: typeof tags[0] === "string" ? tags[0] : "default",
        summary: typeof op.summary === "string" ? op.summary : undefined,
        description: typeof op.description === "string" ? op.description : undefined,
        deprecated: Boolean(op.deprecated),
        parameters: [...params.values()],
        requestBody,
        security: sec.filter(isObj).flatMap((r) => Object.keys(r)),
        responses: Object.entries(isObj(op.responses) ? op.responses : {}).map(([status, r]) => ({
          status,
          description: shallow(doc, r, warnings).description as string | undefined,
        })),
      });
    }
  }

  const declared = Array.isArray(doc.tags) ? doc.tags.filter(isObj) : [];
  const order = new Map(declared.map((t, i) => [String(t.name), i]));
  const byTag = new Map<string, ApiOperation[]>();
  for (const op of ops) byTag.set(op.tag, [...(byTag.get(op.tag) ?? []), op]);
  const tags = [...byTag.entries()]
    .sort(([a], [b]) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9) || a.localeCompare(b))
    .map(([name, operations]) => ({
      name,
      description: declared.find((t) => t.name === name)?.description as string | undefined,
      operations,
    }));

  return {
    title: String(info.title ?? "API"),
    version: String(info.version ?? ""),
    description: info.description as string | undefined,
    servers: servers.length ? servers : [{ url: "/" }],
    tags,
    operations: ops,
    securitySchemes: schemes(doc, warnings),
    warnings: [...new Set(warnings)],
  };
}

/** Builds a plausible example value from a resolved schema (example > default > enum > type). */
export function sampleFromSchema(schema: JsonSchema | undefined, depth = 0): unknown {
  if (!schema || depth > 8) return null;
  if (schema.example !== undefined) return schema.example;
  if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0];
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema["x-circular"]) return {};
  if (schema.allOf?.length)
    return Object.assign(
      {},
      ...schema.allOf.map((s) => sampleFromSchema(s, depth + 1)).filter(isObj),
    );
  const variant = schema.oneOf?.[0] ?? schema.anyOf?.[0];
  if (variant) return sampleFromSchema(variant, depth + 1);
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== "null") : schema.type;
  switch (type ?? (schema.properties ? "object" : undefined)) {
    case "object": {
      const out: Obj = {};
      for (const [k, v] of Object.entries(schema.properties ?? {})) {
        if ((v as JsonSchema).readOnly) continue;
        out[k] = sampleFromSchema(v, depth + 1);
      }
      return out;
    }
    case "array":
      return [sampleFromSchema(schema.items, depth + 1)];
    case "integer":
    case "number":
      return typeof schema.minimum === "number" ? schema.minimum : 0;
    case "boolean":
      return false;
    case "string":
      if (schema.format === "date-time") return new Date(0).toISOString();
      if (schema.format === "date") return "2026-01-01";
      if (schema.format === "email") return "jane@example.com";
      if (schema.format === "uuid") return "00000000-0000-4000-8000-000000000000";
      if (schema.format === "uri") return "https://example.com";
      return "string";
    default:
      return null;
  }
}

/** Strips OpenAPI-only keywords so Ajv (non-strict) can compile the schema. */
export function toAjvSchema(schema: JsonSchema): JsonSchema {
  const walk = (n: unknown): unknown => {
    if (Array.isArray(n)) return n.map(walk);
    if (!isObj(n)) return n;
    const out: Obj = {};
    for (const [k, v] of Object.entries(n)) {
      if (
        k === "example" ||
        k === "xml" ||
        k === "externalDocs" ||
        k === "discriminator" ||
        k.startsWith("x-")
      )
        continue;
      if (k === "readOnly" && v === true) continue;
      out[k] = k === "enum" || k === "default" ? v : walk(v);
    }
    return out;
  };
  return walk(schema) as JsonSchema;
}
