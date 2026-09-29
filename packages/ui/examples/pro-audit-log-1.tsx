import * as React from "react";
import { NuqsAdapter } from "nuqs/adapters/react";
import {
  ProAuditLog,
  type AuditEvent,
  type AuditFacetBucket,
  type AuditFetchPage,
  type AuditFilters,
} from "@/components/crm/pro-audit-log";
import { useAuditLogUrlState } from "@/hooks/use-audit-log-url-state";

// ---- Deterministic mock workspace: 25,000 events over the last 120 days ----
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
const rand = rng(42);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;

const PEOPLE = [
  ["Priya Nair", "priya@northwind.io"],
  ["Marcus Chen", "marcus@northwind.io"],
  ["Dana Whitfield", "dana@northwind.io"],
  ["Tomás Alvarez", "tomas@northwind.io"],
  ["Aisha Bello", "aisha@northwind.io"],
  ["Jonas Berg", "jonas@northwind.io"],
  ["Mei Tanaka", "mei@northwind.io"],
  ["Owen Clarke", "owen@northwind.io"],
] as const;
const ACTORS = [
  ...PEOPLE.map(([name, email], i) => ({
    id: `usr_${1000 + i}`,
    name,
    email,
    kind: "user" as const,
  })),
  { id: "svc_sync", name: "Salesforce sync", kind: "service" as const },
  { id: "key_ci", name: "CI deploy key", kind: "api_key" as const },
  { id: "sys", name: "System", kind: "system" as const },
];
const STAGES = ["Discovery", "Qualified", "Proposal", "Negotiation", "Closed won", "Closed lost"];
const ROLES = ["viewer", "member", "admin", "owner"];
const COMPANIES = [
  "Acme Corp",
  "Globex",
  "Initech",
  "Umbrella Health",
  "Stark Freight",
  "Wayne Energy",
  "Hooli",
  "Vandelay Imports",
  "Soylent Foods",
  "Tyrell Robotics",
];
const PLACES = [
  ["52.14.88.201", "Columbus, US"],
  ["81.2.69.160", "London, GB"],
  ["103.21.244.9", "Bengaluru, IN"],
  ["18.197.4.77", "Frankfurt, DE"],
  ["13.54.2.19", "Sydney, AU"],
];
const UAS = [
  "Chrome 131 · macOS",
  "Firefox 133 · Windows",
  "Safari 18 · iOS",
  "node-fetch/3.3 (integration)",
];

function makeEvent(i: number, at: number): AuditEvent {
  const actor = pick(ACTORS);
  const [ip, location] = pick(PLACES);
  const kind = rand();
  const base = {
    id: `evt_${(900000 - i).toString(36)}`,
    occurredAt: new Date(at).toISOString(),
    actor,
    ip: actor.kind === "system" ? undefined : ip,
    location: actor.kind === "system" ? undefined : location,
    userAgent: actor.kind === "user" ? pick(UAS) : undefined,
    requestId: `req_${Math.floor(rand() * 1e12).toString(16)}`,
  };
  if (kind < 0.42) {
    const company = pick(COMPANIES);
    const amount = Math.round(rand() * 180 + 20) * 500;
    const before = {
      name: `${company} expansion`,
      stage: pick(STAGES),
      amount,
      owner: pick(PEOPLE)[0],
      tags: ["enterprise", "q4"],
      contacts: [{ id: "c1", name: "Lena Park", role: "Champion" }],
    };
    const after = {
      ...before,
      stage: pick(STAGES),
      amount: rand() < 0.5 ? amount : amount + 5000,
      tags: rand() < 0.3 ? ["enterprise", "q4", "at-risk"] : before.tags,
      contacts:
        rand() < 0.3
          ? [...before.contacts, { id: "c2", name: "Raj Patel", role: "Economic buyer" }]
          : before.contacts,
    };
    return {
      ...base,
      action: "deal.updated",
      resource: { type: "deal", id: `deal_${2000 + (i % 900)}`, name: before.name },
      before,
      after,
    };
  }
  if (kind < 0.55) {
    const name = `${pick(PEOPLE)[0].split(" ")[0]} @ ${pick(COMPANIES)}`;
    return {
      ...base,
      action: "contact.created",
      resource: { type: "contact", id: `con_${i}`, name },
      after: { name, lifecycle: "lead", source: "Web form" },
    };
  }
  if (kind < 0.62) {
    return {
      ...base,
      action: "contact.deleted",
      resource: { type: "contact", id: `con_${i}`, name: `Duplicate · ${pick(COMPANIES)}` },
      before: { name: "Duplicate", email: "old@example.com", lifecycle: "lead" },
    };
  }
  if (kind < 0.8) {
    const failed = rand() < 0.12;
    return {
      ...base,
      action: failed ? "user.login_failed" : "user.login",
      resource: { type: "session", id: `ses_${i}` },
      outcome: failed ? "failure" : "success",
      metadata: { method: pick(["password", "sso", "passkey"]) },
    };
  }
  if (kind < 0.88) {
    const from = pick(ROLES);
    const target = pick(PEOPLE);
    return {
      ...base,
      action: "member.role_changed",
      resource: { type: "member", id: `mem_${target[1]}`, name: target[0] },
      outcome: rand() < 0.08 ? "denied" : "success",
      before: { role: from, permissions: ["deals:read"] },
      after: { role: pick(ROLES), permissions: ["deals:read", "deals:write"] },
    };
  }
  if (kind < 0.94) {
    const verb = rand() < 0.5 ? "api_key.created" : "api_key.revoked";
    return {
      ...base,
      action: verb,
      resource: { type: "api_key", id: `key_${i}`, name: `sk_live_…${Math.floor(rand() * 9999)}` },
      after: verb.endsWith("created")
        ? { scopes: ["contacts:read", "deals:read"], expiresIn: "90d" }
        : undefined,
    };
  }
  return {
    ...base,
    action: "report.exported",
    resource: {
      type: "report",
      id: `rep_${i % 40}`,
      name: pick(["Pipeline by owner", "Churn cohort", "Win rate Q3", "Revenue forecast"]),
    },
    metadata: { rows: Math.floor(rand() * 20000), format: "csv" },
  };
}

const ALL: AuditEvent[] = (() => {
  const out: AuditEvent[] = [];
  let t = Date.now() - 45_000;
  for (let i = 0; i < 25_000; i++) {
    t -= Math.floor(rand() * 830_000) + 5_000;
    out.push(makeEvent(i, t));
  }
  return out;
})();

// ---- Mock server: filtering, facet counts (excluding the facet's own dimension) and cursors ----
function matches(e: AuditEvent, f: AuditFilters, skip?: "actors" | "actions" | "resources") {
  if (skip !== "actors" && f.actors.length && !f.actors.includes(e.actor.id)) return false;
  if (skip !== "actions" && f.actions.length && !f.actions.includes(e.action)) return false;
  if (skip !== "resources" && f.resources.length && !f.resources.includes(e.resource.type))
    return false;
  const day = String(e.occurredAt).slice(0, 10);
  if (f.from && day < f.from) return false;
  if (f.to && day > f.to) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    const hay =
      `${e.id} ${e.action} ${e.actor.name} ${e.actor.email ?? ""} ${e.resource.name ?? ""} ${e.resource.id} ${e.ip ?? ""} ${e.requestId ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}
function facet(f: AuditFilters, dim: "actors" | "actions" | "resources"): AuditFacetBucket[] {
  const m = new Map<string, AuditFacetBucket>();
  for (const e of ALL) {
    if (!matches(e, f, dim)) continue;
    const [value, label] =
      dim === "actors"
        ? [e.actor.id, e.actor.name]
        : dim === "actions"
          ? [e.action, undefined]
          : [e.resource.type, undefined];
    const b = m.get(value);
    if (b) b.count++;
    else m.set(value, { value, label, count: 1 });
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

const fetchPage: AuditFetchPage = async ({ cursor, filters, pageSize, signal }) => {
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, cursor ? 250 : 400);
    signal.addEventListener(
      "abort",
      () => (clearTimeout(t), reject(new DOMException("Aborted", "AbortError"))),
    );
  });
  const rows = ALL.filter((e) => matches(e, filters));
  const start = cursor ? Number(cursor) : 0;
  const events = rows.slice(start, start + pageSize);
  const next = start + pageSize < rows.length ? String(start + pageSize) : null;
  return {
    events,
    nextCursor: next,
    total: rows.length,
    facets: cursor
      ? undefined
      : {
          actors: facet(filters, "actors"),
          actions: facet(filters, "actions"),
          resources: facet(filters, "resources"),
        },
  };
};

function Explorer() {
  const { filters, setFilters, timeMode, setTimeMode } = useAuditLogUrlState();
  return (
    <ProAuditLog
      title="Workspace audit log · Northwind"
      fetchPage={fetchPage}
      filters={filters}
      onFiltersChange={setFilters}
      timeMode={timeMode}
      onTimeModeChange={setTimeMode}
      exportFileName="northwind-audit"
      height={520}
    />
  );
}

export default function ProAuditLogExample() {
  return (
    <div className="bg-crm-bg p-4">
      <NuqsAdapter>
        <Explorer />
      </NuqsAdapter>
    </div>
  );
}
