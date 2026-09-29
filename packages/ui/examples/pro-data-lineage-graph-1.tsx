import * as React from "react";
import {
  ProDataLineageGraph,
  type LineageDataset,
  type LineageEdge,
  type LineageFetcher,
  type LineageKind,
  type LineageStatus,
} from "@/components/crm/pro-data-lineage-graph";

// A deterministic, dbt-shaped warehouse of ~2,000 models served by a fake metadata API with
// latency. The graph starts one level around fct_orders and lazily expands from there; choose
// "All levels" in the toolbar and expand to pull in the full project.

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;

const DOMAINS = [
  "orders",
  "payments",
  "customers",
  "products",
  "inventory",
  "marketing",
  "support",
  "billing",
  "shipping",
  "finance",
];
const SYSTEMS = [
  "shopify",
  "stripe",
  "salesforce",
  "hubspot",
  "zendesk",
  "netsuite",
  "segment",
  "postgres",
];
const OWNERS = ["analytics-eng", "data-platform", "finance-data", "growth-analytics", "ops-bi"];
const COLS = [
  "id",
  "customer_id",
  "order_id",
  "product_id",
  "amount_usd",
  "currency",
  "status",
  "created_at",
  "updated_at",
  "region",
  "channel",
  "quantity",
  "discount_usd",
  "is_active",
  "email_hash",
  "plan",
  "mrr_usd",
  "ticket_id",
];
const TYPES: Record<string, string> = {
  amount_usd: "numeric",
  discount_usd: "numeric",
  mrr_usd: "numeric",
  quantity: "int",
  created_at: "timestamp",
  updated_at: "timestamp",
  is_active: "bool",
};
const STATUSES: LineageStatus[] = [
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "warning",
  "stale",
  "failed",
  "running",
];

const LAYERS: { kind: LineageKind; prefix: string; schema: string; count: number }[] = [
  { kind: "source", prefix: "src", schema: "raw", count: 180 },
  { kind: "model", prefix: "stg", schema: "staging", count: 420 },
  { kind: "model", prefix: "int", schema: "intermediate", count: 560 },
  { kind: "model", prefix: "fct", schema: "marts", count: 360 },
  { kind: "metric", prefix: "mtr", schema: "metrics", count: 260 },
  { kind: "exposure", prefix: "dash", schema: "looker", count: 220 },
];

const DB = new Map<string, LineageDataset>();
const PARENTS = new Map<string, LineageEdge[]>();
const CHILDREN = new Map<string, LineageEdge[]>();
const layerIds: string[][] = [];

LAYERS.forEach((layer, li) => {
  const ids: string[] = [];
  for (let i = 0; i < layer.count; i++) {
    const domain = DOMAINS[i % DOMAINS.length]!;
    const name =
      li === 0 && i === 0
        ? "src_shopify__orders"
        : li === 3 && i === 0
          ? "fct_orders"
          : `${layer.prefix}_${li === 0 ? `${pick(SYSTEMS)}__` : ""}${domain}_${Math.floor(i / DOMAINS.length) + 1}`;
    const columns = [
      ...new Set(["id", ...Array.from({ length: 4 + Math.floor(rand() * 5) }, () => pick(COLS))]),
    ].map((c) => ({
      name: c,
      type: TYPES[c] ?? (c.endsWith("_id") || c === "id" ? "varchar" : "text"),
    }));
    const id = `${layer.schema}.${name}`;
    DB.set(id, {
      id,
      name,
      kind: layer.kind,
      schema: layer.schema,
      owner: pick(OWNERS),
      status: pick(STATUSES),
      columns,
      meta: {
        "Last run": `${1 + Math.floor(rand() * 58)} min ago`,
        Rows: layer.kind === "exposure" ? "—" : Math.floor(rand() * 9e6).toLocaleString(),
        Tests: `${Math.floor(rand() * 12)} passing`,
      },
    });
    ids.push(id);
    if (li > 0) {
      const prev = layerIds[li - 1]!;
      const fanIn = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < fanIn; k++) {
        const src = k === 0 ? prev[i % prev.length]! : pick(prev);
        if (PARENTS.get(id)?.some((e) => e.source === src)) continue;
        const from = DB.get(src)!.columns!;
        const links = columns
          .map((c) => ({ to: c.name, from: from.find((f) => f.name === c.name)?.name ?? "" }))
          .filter((l) => l.from);
        const edge: LineageEdge = { source: src, target: id, columns: links };
        PARENTS.set(id, [...(PARENTS.get(id) ?? []), edge]);
        CHILDREN.set(src, [...(CHILDREN.get(src) ?? []), edge]);
      }
    }
  }
  layerIds.push(ids);
});

const withFlags = (d: LineageDataset): LineageDataset => ({
  ...d,
  hasUpstream: (PARENTS.get(d.id)?.length ?? 0) > 0,
  hasDownstream: (CHILDREN.get(d.id)?.length ?? 0) > 0,
});

const fetchLineage: LineageFetcher = (id, direction, depth, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => {
        const adj = direction === "upstream" ? PARENTS : CHILDREN;
        const seen = new Set([id]);
        const edges: LineageEdge[] = [];
        let frontier = [id];
        for (let level = 0; level < depth && frontier.length; level++) {
          const next: string[] = [];
          for (const n of frontier) {
            for (const e of adj.get(n) ?? []) {
              edges.push(e);
              const other = direction === "upstream" ? e.source : e.target;
              if (!seen.has(other)) {
                seen.add(other);
                next.push(other);
              }
            }
          }
          frontier = next;
        }
        resolve({ nodes: [...seen].map((n) => withFlags(DB.get(n)!)), edges });
      },
      250 + Math.random() * 350,
    );
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

export default function Example() {
  const [selected, setSelected] = React.useState<LineageDataset | null>(null);
  return (
    <div className="space-y-3 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-crm-fg">Lineage · marts.fct_orders</h2>
          <p className="crm-caption text-crm-muted-fg">
            {DB.size.toLocaleString()} datasets in the project. Click a column to trace it end to
            end; press F on a dataset to focus its lineage.
          </p>
        </div>
        <span className="text-xs text-crm-soft">Selected: {selected?.name ?? "none"}</span>
      </div>
      <ProDataLineageGraph
        rootId="marts.fct_orders"
        fetchLineage={fetchLineage}
        initialDepth={1}
        onSelectedChange={setSelected}
        height={680}
      />
    </div>
  );
}
