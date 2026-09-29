import { useMemo } from "react";
import { ProTraceWaterfall, type TraceSpan } from "@/components/crm/pro-trace-waterfall";

// A realistic ~10k-span checkout trace: gateway -> services -> DB / cache / queue fan-out,
// generated deterministically so the preview is stable.
let seed = 7;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;

const T0 = Date.UTC(2026, 8, 29, 9, 14, 3, 120);
const OPS: Record<string, readonly string[]> = {
  "checkout-api": ["POST /v2/checkout", "validateCart", "applyPromotions", "reserveInventory"],
  "pricing-svc": ["GET /prices/batch", "computeTax", "fxConvert"],
  "inventory-svc": ["POST /reservations", "lockSku", "releaseLock"],
  "payments-svc": ["POST /charges", "3ds.challenge", "fraudScore"],
  postgres: ["SELECT orders", "INSERT order_lines", "UPDATE stock", "SELECT customers"],
  redis: ["GET cart:*", "SET session", "MGET price:*"],
  kafka: ["produce order.created", "produce stock.reserved"],
  "stripe-proxy": ["POST api.stripe.com/v1/payment_intents"],
};
const LEAF = ["postgres", "redis", "kafka"];
const SVC = ["pricing-svc", "inventory-svc", "payments-svc", "stripe-proxy"];

let n = 0;
const spans: TraceSpan[] = [];
function emit(
  parent: string | null,
  service: string,
  start: number,
  budget: number,
  depth: number,
) {
  const id = (0x1a2b3c + n++ * 2654435761).toString(16).slice(-12).padStart(12, "0");
  const leaf = LEAF.includes(service);
  const duration = leaf ? Math.max(0.05, budget * (0.3 + rnd() * 0.7)) : budget;
  const err = leaf ? rnd() < 0.004 : rnd() < 0.01;
  const name = pick(OPS[service]!);
  const span: TraceSpan = {
    spanId: id,
    parentSpanId: parent,
    name,
    service,
    startTime: start,
    duration,
    status: err ? "error" : "ok",
    kind: parent === null ? "server" : leaf ? "client" : pick(["server", "internal"] as const),
    attributes: {
      "service.name": service,
      "service.version": `2.${Math.floor(rnd() * 9)}.${Math.floor(rnd() * 20)}`,
      "k8s.pod.name": `${service}-${Math.floor(rnd() * 1e6).toString(36)}`,
      "cloud.region": pick(["eu-west-1", "us-east-1"]),
      ...(service === "postgres"
        ? {
            "db.system": "postgresql",
            "db.statement": `${name} WHERE id = $1`,
            "db.rows_affected": Math.floor(rnd() * 40),
          }
        : service === "redis"
          ? {
              "db.system": "redis",
              "net.peer.name": "cache-primary.internal",
              "cache.hit": rnd() > 0.2,
            }
          : {
              "http.method": name.split(" ")[0]!.startsWith("/") ? "GET" : "POST",
              "http.status_code": err ? 503 : 200,
            }),
    },
    events: err
      ? [
          {
            time: start + duration * 0.9,
            name: "exception",
            attributes: {
              "exception.type": "TimeoutError",
              "exception.message": `${service} deadline exceeded after ${Math.round(duration)}ms`,
            },
          },
        ]
      : undefined,
  };
  spans.push(span);
  if (leaf || depth > 9 || n > 9900) return;
  // Children: a sequential chain with occasional parallel fan-out, fitting inside the parent.
  const kids = depth === 0 ? 14 : 2 + Math.floor(rnd() * (depth < 3 ? 6 : 4));
  let cursor = start + duration * 0.02;
  const slice = (duration * 0.94) / kids;
  for (let k = 0; k < kids && n < 9950; k++) {
    const parallel = rnd() < 0.35;
    const svc = depth < 5 && rnd() < 0.45 ? pick(SVC) : pick(LEAF);
    const len = slice * (0.5 + rnd() * 0.5) * (parallel ? 2.5 : 1);
    emit(id, svc, cursor, Math.min(len, start + duration - cursor), depth + 1);
    if (!parallel) cursor += slice;
  }
}
emit(null, "checkout-api", T0, 1840, 0);
// Async consumer spans that start after the request returned (still part of the trace).
emit(spans[0]!.spanId, "kafka", T0 + 1790, 210, 1);

export default function Example() {
  const data = useMemo(() => spans, []);
  return (
    <ProTraceWaterfall
      className="w-full max-w-[1200px]"
      title="POST /v2/checkout"
      traceId="4bf92f3577b34da6a3ce929d0e0e4736"
      spans={data}
      height={680}
      defaultCollapsedIds={data
        .filter((s) => s.parentSpanId === data[0]!.spanId)
        .slice(6)
        .map((s) => s.spanId)}
    />
  );
}
