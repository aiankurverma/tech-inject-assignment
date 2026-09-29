import * as React from "react";
import {
  ProApiKeyManager,
  type ApiKey,
  type ApiKeyScope,
} from "@/components/crm/pro-api-key-manager";

const scopes: ApiKeyScope[] = [
  {
    id: "contacts:read",
    label: "Read contacts",
    group: "CRM",
    description: "List and fetch contacts",
  },
  {
    id: "contacts:write",
    label: "Write contacts",
    group: "CRM",
    description: "Create, update, merge",
    sensitive: true,
  },
  { id: "deals:read", label: "Read deals", group: "CRM", description: "Pipelines and deal stages" },
  {
    id: "deals:write",
    label: "Write deals",
    group: "CRM",
    description: "Move and edit deals",
    sensitive: true,
  },
  {
    id: "invoices:read",
    label: "Read invoices",
    group: "Billing",
    description: "Invoices and line items",
  },
  {
    id: "payments:write",
    label: "Create refunds",
    group: "Billing",
    description: "Issue refunds and credits",
    sensitive: true,
  },
  {
    id: "webhooks:manage",
    label: "Manage webhooks",
    group: "Platform",
    description: "Endpoints and secrets",
    sensitive: true,
  },
  {
    id: "events:read",
    label: "Read events",
    group: "Platform",
    description: "Audit and activity stream",
  },
];

const services = [
  "Billing sync",
  "Zapier bridge",
  "Data warehouse ETL",
  "Mobile backend",
  "Support bot",
  "Partner portal",
  "Lead enrichment",
  "Churn model",
  "Slack alerts",
  "Nightly export",
];
const owners = ["priya@acme.io", "marco@acme.io", "lena@acme.io", "sam@acme.io", "ops-bot"];
const regions = ["us-east", "eu-west", "ap-south", "staging", "ci"];

/** Deterministic PRNG so the demo renders identically every time. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function makeKeys(count: number): ApiKey[] {
  const r = rng(42);
  const now = Date.now();
  const day = 864e5;
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: count }, (_, i) => {
    const env = r() < 0.55 ? "live" : "test";
    const created = now - Math.floor(r() * 720) * day - Math.floor(r() * day);
    const expRoll = r();
    const expiresAt =
      expRoll < 0.2
        ? null
        : new Date(created + [30, 90, 180, 365][Math.floor(r() * 4)]! * day).toISOString();
    const revoked = r() < 0.12;
    const used = r() < 0.9;
    const base = Math.floor(r() * 4000);
    const usage = Array.from({ length: 14 }, (_, d) =>
      Math.max(0, Math.round(base * (0.6 + r() * 0.8) * (d > 9 && r() < 0.3 ? 1.8 : 1))),
    );
    const scopeCount = 1 + Math.floor(r() * 4);
    const picked = [...scopes]
      .sort(() => r() - 0.5)
      .slice(0, scopeCount)
      .map((s) => s.id);
    return {
      id: `key_${i.toString(36).padStart(6, "0")}`,
      name: `${services[i % services.length]} ${regions[Math.floor(i / services.length) % regions.length]} #${Math.floor(i / 50) + 1}`,
      environment: env,
      prefix: `kb_${env}_`,
      last4: Array.from({ length: 4 }, () => chars[Math.floor(r() * chars.length)]).join(""),
      scopes: picked,
      createdAt: new Date(created).toISOString(),
      expiresAt,
      lastUsedAt: used ? new Date(now - Math.floor(r() * 30 * day)).toISOString() : null,
      revokedAt: revoked ? new Date(created + day).toISOString() : null,
      createdBy: owners[Math.floor(r() * owners.length)],
      usage: used && !revoked ? usage : [],
    } satisfies ApiKey;
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Example() {
  const [keys, setKeys] = React.useState(() => makeKeys(10_000));
  return (
    <div className="bg-crm-bg p-4 font-crm text-crm-fg">
      <ProApiKeyManager
        keys={keys}
        onKeysChange={setKeys}
        scopes={scopes}
        currentUser="priya@acme.io"
        height={460}
        onRevoke={async () => {
          await sleep(500);
        }}
      />
    </div>
  );
}
