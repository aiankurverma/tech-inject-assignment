import * as React from "react";
import { ProJsonExplorer, type JsonValue } from "@/components/crm/pro-json-explorer";

// A realistic Stripe-style webhook batch: 12,000 events (~6 MB of JSON), generated
// deterministically so the "before" and "after" payloads can be diffed.
const STATUSES = ["succeeded", "pending", "failed", "refunded"] as const;
const CURRENCIES = ["usd", "eur", "gbp", "inr"] as const;
const PLANS = ["starter", "growth", "scale", "enterprise"] as const;
const COMPANIES = [
  "Northwind",
  "Globex",
  "Initech",
  "Umbrella",
  "Hooli",
  "Stark Industries",
  "Wayne Corp",
  "Acme",
];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function pick<T>(list: readonly T[], r: () => number): T {
  return list[Math.floor(r() * list.length) % list.length] as T;
}

function buildBatch(count: number): JsonValue {
  const r = rng(42);
  const events: JsonValue[] = [];
  for (let i = 0; i < count; i++) {
    const company = pick(COMPANIES, r);
    events.push({
      id: `evt_${(1_000_000 + i).toString(36)}`,
      type: r() > 0.8 ? "invoice.payment_failed" : "charge.succeeded",
      created: 1_790_000_000 + i * 37,
      livemode: true,
      data: {
        object: {
          id: `ch_${(9_000_000 + i).toString(36)}`,
          amount: Math.round(r() * 250_000),
          currency: pick(CURRENCIES, r),
          status: pick(STATUSES, r),
          customer: {
            id: `cus_${(50_000 + (i % 3100)).toString(36)}`,
            email: `billing+${i % 3100}@${company.toLowerCase().replace(/\s+/g, "")}.com`,
            company,
            plan: pick(PLANS, r),
          },
          metadata: {
            crm_deal_id: `deal_${1000 + (i % 870)}`,
            region: r() > 0.5 ? "emea" : "amer",
          },
          refunded: false,
          tags: r() > 0.7 ? ["priority", "renewal"] : [],
        },
      },
      request: { id: r() > 0.1 ? `req_${i.toString(36)}` : null, idempotency_key: null },
    });
  }
  return {
    object: "list",
    url: "/v1/events",
    has_more: true,
    delivery: {
      endpoint: "https://api.kitbase.dev/hooks/stripe",
      attempt: 1,
      signature: "t=1790000000,v1=5257a869e7",
    },
    data: events,
  };
}

// Simulates the "after" payload: a few edits, a removal and an insertion.
function mutate(batch: JsonValue): JsonValue {
  const b = structuredClone(batch) as {
    data: Record<string, unknown>[];
    delivery: Record<string, unknown>;
  };
  b.delivery.attempt = 2;
  for (const i of [3, 17, 256, 4096]) {
    const event = b.data[i];
    if (!event) continue;
    const obj = (event.data as { object: Record<string, unknown> }).object;
    obj.status = "refunded";
    obj.refunded = true;
  }
  b.data.splice(9, 1);
  b.data.splice(40, 0, {
    id: "evt_manual_retry",
    type: "charge.refunded",
    created: 1_790_500_000,
    livemode: true,
  });
  return b as unknown as JsonValue;
}

const schema = {
  type: "object",
  required: ["object", "data"],
  properties: {
    object: { const: "list" },
    has_more: { type: "boolean" },
    data: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "type", "created"],
        properties: {
          id: { type: "string", pattern: "^evt_" },
          type: { type: "string" },
          created: { type: "integer", minimum: 0 },
          data: {
            type: "object",
            properties: {
              object: {
                type: "object",
                properties: {
                  amount: { type: "integer", minimum: 0 },
                  currency: { enum: ["usd", "eur", "gbp", "inr"] },
                  status: { enum: ["succeeded", "pending", "failed", "refunded"] },
                },
              },
            },
          },
        },
      },
    },
  },
};

export default function ProJsonExplorerExample() {
  const before = React.useMemo(() => buildBatch(12_000), []);
  const [doc, setDoc] = React.useState<JsonValue>(() => mutate(before));
  const [selected, setSelected] = React.useState("$");
  return (
    <div className="space-y-3 bg-crm-bg p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-medium text-crm-fg">Webhook delivery · evt batch #88213</h3>
          <p className="text-xs text-crm-muted-fg">
            12,000 events. Try <code className="font-mono">$..customer.email</code>, double-click a
            value to edit it (type <code className="font-mono">-5</code> in an amount to trip the
            schema), or open Diff.
          </p>
        </div>
        <span className="font-mono text-xs text-crm-muted-fg">{selected}</span>
      </div>
      <ProJsonExplorer
        value={doc}
        onChange={setDoc}
        compareTo={before}
        compareLabels={["Attempt 1", "Attempt 2"]}
        schema={schema}
        editable
        onSelect={(_, path) => setSelected(path)}
        height={520}
      />
    </div>
  );
}
