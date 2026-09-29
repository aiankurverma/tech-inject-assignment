import * as React from "react";
import { ProApiPlayground, type Fetcher } from "@/components/crm/pro-api-playground";

// ---- Realistic OpenAPI 3.1 document: Northwind CRM API, 14 resources x CRUD + actions (~90 endpoints) ----
const RESOURCES = [
  ["contacts", "Contact", "Contacts"],
  ["companies", "Company", "Companies"],
  ["deals", "Deal", "Deals"],
  ["pipelines", "Pipeline", "Pipelines"],
  ["tasks", "Task", "Tasks"],
  ["notes", "Note", "Notes"],
  ["meetings", "Meeting", "Meetings"],
  ["invoices", "Invoice", "Billing"],
  ["subscriptions", "Subscription", "Billing"],
  ["products", "Product", "Catalog"],
  ["users", "User", "Workspace"],
  ["teams", "Team", "Workspace"],
  ["webhooks", "Webhook", "Developers"],
  ["api-keys", "ApiKey", "Developers"],
] as const;

const base = {
  id: { type: "string", format: "uuid", readOnly: true },
  createdAt: { type: "string", format: "date-time", readOnly: true },
  updatedAt: { type: "string", format: "date-time", readOnly: true },
};

const schemas: Record<string, unknown> = {
  Error: {
    type: "object",
    required: ["code", "message"],
    properties: {
      code: { type: "string", example: "not_found" },
      message: { type: "string" },
      requestId: { type: "string" },
    },
  },
  Contact: {
    type: "object",
    required: ["email", "firstName"],
    properties: {
      ...base,
      firstName: { type: "string", minLength: 1, example: "Priya" },
      lastName: { type: "string", example: "Nair" },
      email: { type: "string", format: "email", example: "priya@acme.io" },
      phone: { type: "string", example: "+1 415 555 0134" },
      lifecycleStage: {
        type: "string",
        enum: ["subscriber", "lead", "mql", "sql", "customer"],
        example: "lead",
      },
      companyId: {
        type: "string",
        format: "uuid",
        example: "0e6f3c2a-8f1b-4d6a-9b1e-2f6c3a1d9e44",
      },
      tags: { type: "array", items: { type: "string" }, example: ["enterprise", "q4-webinar"] },
    },
    additionalProperties: false,
  },
  Company: {
    type: "object",
    required: ["name", "domain"],
    properties: {
      ...base,
      name: { type: "string", example: "Acme Robotics" },
      domain: { type: "string", pattern: "^[a-z0-9.-]+\\.[a-z]{2,}$", example: "acme.io" },
      employees: { type: "integer", minimum: 1, example: 240 },
      industry: {
        type: "string",
        enum: ["saas", "fintech", "health", "retail", "manufacturing"],
        example: "saas",
      },
      parent: { $ref: "#/components/schemas/Company" },
    },
  },
  Deal: {
    type: "object",
    required: ["name", "amount", "stage"],
    properties: {
      ...base,
      name: { type: "string", example: "Acme — Enterprise renewal" },
      amount: { type: "number", minimum: 0, example: 48000 },
      currency: { type: "string", enum: ["USD", "EUR", "GBP", "INR"], default: "USD" },
      stage: {
        type: "string",
        enum: ["qualification", "discovery", "proposal", "negotiation", "won", "lost"],
        example: "proposal",
      },
      closeDate: { type: "string", format: "date", example: "2026-11-30" },
      contactIds: { type: "array", items: { type: "string", format: "uuid" }, maxItems: 20 },
    },
  },
  Webhook: {
    type: "object",
    required: ["url", "events"],
    properties: {
      ...base,
      url: { type: "string", format: "uri", example: "https://hooks.acme.io/crm" },
      events: {
        type: "array",
        minItems: 1,
        items: {
          type: "string",
          enum: ["contact.created", "deal.updated", "deal.won", "invoice.paid"],
        },
        example: ["deal.won"],
      },
      active: { type: "boolean", default: true },
    },
  },
};
for (const [, name] of RESOURCES)
  schemas[name] ??= {
    type: "object",
    required: ["name"],
    properties: {
      ...base,
      name: { type: "string", example: `Sample ${name.toLowerCase()}` },
      description: { type: "string" },
      archived: { type: "boolean", default: false },
    },
  };

const ref = (n: string) => ({ $ref: `#/components/schemas/${n}` });
const err = { description: "Error", content: { "application/json": { schema: ref("Error") } } };
const paths: Record<string, Record<string, unknown>> = {};
for (const [slug, name, tag] of RESOURCES) {
  const one = { description: `${name}`, content: { "application/json": { schema: ref(name) } } };
  paths[`/v2/${slug}`] = {
    get: {
      tags: [tag],
      operationId: `list${name}s`,
      summary: `List ${slug.replace("-", " ")}`,
      parameters: [
        { $ref: "#/components/parameters/limit" },
        { $ref: "#/components/parameters/cursor" },
        {
          name: "sort",
          in: "query",
          schema: { type: "string", enum: ["createdAt", "-createdAt", "updatedAt", "-updatedAt"] },
        },
        { name: "q", in: "query", description: "Full-text search", schema: { type: "string" } },
      ],
      responses: { "200": { description: "Page of results" }, "401": err },
    },
    post: {
      tags: [tag],
      operationId: `create${name}`,
      summary: `Create a ${name.toLowerCase()}`,
      parameters: [
        {
          name: "Idempotency-Key",
          in: "header",
          description: "Safely retry POSTs",
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: { required: true, content: { "application/json": { schema: ref(name) } } },
      responses: { "201": one, "422": err },
    },
  };
  paths[`/v2/${slug}/{id}`] = {
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        example: "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
      },
    ],
    get: {
      tags: [tag],
      operationId: `get${name}`,
      summary: `Retrieve a ${name.toLowerCase()}`,
      responses: { "200": one, "404": err },
    },
    patch: {
      tags: [tag],
      operationId: `update${name}`,
      summary: `Update a ${name.toLowerCase()}`,
      requestBody: { content: { "application/json": { schema: ref(name) } } },
      responses: { "200": one, "404": err, "422": err },
    },
    delete: {
      tags: [tag],
      operationId: `delete${name}`,
      summary: `Delete a ${name.toLowerCase()}`,
      responses: { "204": { description: "Deleted" } },
    },
  };
  paths[`/v2/${slug}/{id}/activity`] = {
    get: {
      tags: [tag],
      operationId: `list${name}Activity`,
      summary: `Activity timeline for a ${name.toLowerCase()}`,
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          example: "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
        },
        { $ref: "#/components/parameters/limit" },
      ],
      responses: { "200": { description: "Activity" } },
    },
  };
}
paths["/v2/deals/{id}/move"] = {
  post: {
    tags: ["Deals"],
    operationId: "moveDeal",
    summary: "Move a deal to another stage",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
        example: "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["stage"],
            properties: {
              stage: {
                type: "string",
                enum: ["discovery", "proposal", "negotiation", "won", "lost"],
              },
              reason: { type: "string", maxLength: 280 },
            },
          },
          example: { stage: "negotiation", reason: "Legal review started" },
        },
      },
    },
    responses: { "200": { description: "Moved" } },
  },
};
paths["/v1/contacts/export"] = {
  get: {
    tags: ["Contacts"],
    deprecated: true,
    summary: "Legacy CSV export (use /v2/exports)",
    responses: { "200": { description: "CSV" } },
  },
};
paths["/health"] = {
  get: {
    tags: ["System"],
    summary: "Liveness probe",
    security: [],
    responses: { "200": { description: "OK" } },
  },
};

const SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Northwind CRM API",
    version: "2.14.0",
    description: "Contacts, deals, billing and workspace administration.",
  },
  servers: [
    { url: "https://api.northwind.dev", description: "Production" },
    { url: "https://sandbox.northwind.dev", description: "Sandbox" },
  ],
  security: [{ bearerAuth: [] }, { apiKey: [] }],
  tags: [
    { name: "Contacts" },
    { name: "Companies" },
    { name: "Deals" },
    { name: "Pipelines" },
    { name: "Billing" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Workspace access token from Settings → API.",
      },
      apiKey: { type: "apiKey", in: "header", name: "X-Api-Key" },
      basicAuth: { type: "http", scheme: "basic" },
    },
    parameters: {
      limit: {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 200, default: 25 },
      },
      cursor: {
        name: "cursor",
        in: "query",
        description: "Opaque cursor from the previous page",
        schema: { type: "string" },
      },
    },
    schemas,
  },
  paths,
};

// ---- Mock network (the preview sandbox cannot reach real APIs) ----
const FIRST = [
  "Priya",
  "Marcus",
  "Dana",
  "Tomás",
  "Aisha",
  "Jonas",
  "Mei",
  "Owen",
  "Lena",
  "Rahul",
];
const LAST = [
  "Nair",
  "Chen",
  "Whitfield",
  "Alvarez",
  "Bello",
  "Berg",
  "Tanaka",
  "Clarke",
  "Fischer",
  "Mehta",
];
const uuid = (i: number) =>
  `${(0x10000000 + i * 7919).toString(16)}-4a5b-4c6d-8e7f-${(1e11 + i * 104729).toString(16).padStart(12, "0").slice(-12)}`;

const mockFetch: Fetcher = async (url, init) => {
  const u = new URL(url);
  const method = (init.method ?? "GET").toUpperCase();
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, 120 + Math.random() * 380);
    init.signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
  const headers = new Headers(init.headers);
  const reply = (status: number, body: unknown, statusText = "") =>
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      statusText,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-request-id": `req_${Math.random().toString(36).slice(2, 12)}`,
        "x-ratelimit-remaining": String(900 + Math.floor(Math.random() * 99)),
        "cache-control": "no-store",
      },
    });
  if (u.pathname === "/health")
    return reply(200, { status: "ok", region: "us-east-1", version: "2.14.0" }, "OK");
  if (!headers.get("authorization") && !headers.get("x-api-key"))
    return reply(
      401,
      {
        code: "unauthorized",
        message: "Missing bearer token or X-Api-Key header",
        requestId: "req_7f3a",
      },
      "Unauthorized",
    );
  const [, , resource, id] = u.pathname.split("/");
  if (method === "DELETE") return reply(204, null, "No Content");
  if (method === "POST" || method === "PATCH") {
    let body: unknown = {};
    try {
      body = JSON.parse(String(init.body ?? "{}"));
    } catch {
      return reply(400, { code: "invalid_json", message: "Body is not valid JSON" }, "Bad Request");
    }
    return reply(
      method === "POST" ? 201 : 200,
      {
        id: id ?? uuid(Date.now() % 1e5),
        ...(body as object),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      method === "POST" ? "Created" : "OK",
    );
  }
  const limit = Math.min(200, Number(u.searchParams.get("limit") ?? 25));
  const row = (i: number) => ({
    id: uuid(i),
    firstName: FIRST[i % 10],
    lastName: LAST[(i * 3) % 10],
    email: `${FIRST[i % 10]!.toLowerCase()}.${LAST[(i * 3) % 10]!.toLowerCase()}@${["acme.io", "globex.com", "initech.co"][i % 3]}`,
    lifecycleStage: ["lead", "mql", "sql", "customer"][i % 4],
    createdAt: new Date(Date.UTC(2026, 0, 1) + i * 36e5 * 7).toISOString(),
  });
  if (id) return reply(200, { ...row(7), resource }, "OK");
  return reply(
    200,
    {
      object: "list",
      resource,
      data: Array.from({ length: limit }, (_, i) => row(i)),
      nextCursor: "eyJvZmZzZXQiOjI1fQ",
      total: 18_342,
    },
    "OK",
  );
};

export default function ProApiPlaygroundExample() {
  return (
    <div className="bg-crm-bg p-4">
      <ProApiPlayground
        spec={SPEC}
        fetcher={mockFetch}
        defaultOperation="createDeal"
        historyStorageKey="northwind-api-history"
        height={640}
      />
    </div>
  );
}
