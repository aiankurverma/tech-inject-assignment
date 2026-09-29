import * as React from "react";
import { ProLogExplorer, type LogEntry, type LogLevel } from "@/components/crm/pro-log-explorer";

const SOURCES = [
  "api-gateway",
  "billing-worker",
  "auth-svc",
  "search-indexer",
  "webhooks",
  "scheduler",
];
const ROUTES = [
  "/v2/deals",
  "/v2/contacts",
  "/v2/invoices",
  "/v2/search",
  "/oauth/token",
  "/v2/webhooks",
];
const ESC = "\u001b";
const green = (s: string) => `${ESC}[32m${s}${ESC}[0m`;
const red = (s: string) => `${ESC}[1;31m${s}${ESC}[0m`;
const cyan = (s: string) => `${ESC}[36m${s}${ESC}[0m`;
const dim = (s: string) => `${ESC}[2m${s}${ESC}[22m`;

/** Deterministic PRNG so the dataset is stable between renders. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

let seq = 0;
function makeLine(rand: () => number, ts: number): LogEntry {
  const r = rand();
  const source = SOURCES[Math.floor(rand() * SOURCES.length)];
  const route = ROUTES[Math.floor(rand() * ROUTES.length)]!;
  const ms = Math.round(8 + rand() * rand() * 900);
  const reqId = `req_${Math.floor(rand() * 0xffffff)
    .toString(16)
    .padStart(6, "0")}`;
  const id = `L${(seq++).toString(36)}`;
  let level: LogLevel = "info";
  let message: string;
  let fields: Record<string, unknown> | undefined;
  if (r < 0.62) {
    const status = rand() < 0.93 ? 200 : 201;
    message = `${cyan("GET")} ${route} ${green(String(status))} ${ms}ms ${dim(reqId)}`;
  } else if (r < 0.8) {
    level = "debug";
    message = `cache ${rand() < 0.8 ? "hit" : "miss"} key=tenant:${Math.floor(rand() * 900)}:${route.split("/")[2]} ttl=300s`;
  } else if (r < 0.88) {
    level = "info";
    message = JSON.stringify({
      event: "job.completed",
      job: "invoice.sync",
      tenant: `acme-${Math.floor(rand() * 40)}`,
      durationMs: ms * 4,
      records: Math.floor(rand() * 5000),
    });
  } else if (r < 0.96) {
    level = "warn";
    message = `slow query ${ms * 3}ms on ${route} (${dim("threshold 500ms")}) ${reqId}`;
  } else if (r < 0.995) {
    level = "error";
    const status = rand() < 0.5 ? 502 : 504;
    message = `${cyan("POST")} ${route} ${red(String(status))} upstream timeout after 30000ms ${dim(reqId)}`;
    fields = {
      reqId,
      upstream: `${source}.internal:8443`,
      attempt: 1 + Math.floor(rand() * 3),
      region: "ap-south-1",
    };
  } else {
    level = "fatal";
    message = `${red("panic")}: connection pool exhausted (max=50) in ${source}`;
    fields = { pid: 4000 + Math.floor(rand() * 900), uptime: "3d4h", goroutines: 1893 };
  }
  if (rand() < 0.02) level = "trace";
  return { id, timestamp: ts, level, source, message, fields };
}

function seed(count: number): LogEntry[] {
  const rand = rng(42);
  const start = Date.now() - 6 * 3_600_000;
  const step = (6 * 3_600_000) / count;
  const out: LogEntry[] = new Array(count);
  for (let i = 0; i < count; i++) {
    // Incident burst around the 4h mark to make the histogram interesting.
    const t = start + i * step;
    out[i] = makeLine(rand, t);
    if (i > count * 0.66 && i < count * 0.69 && rand() < 0.35) out[i]!.level = "error";
  }
  return out;
}

export default function Example() {
  const [logs, setLogs] = React.useState<LogEntry[]>(() => seed(100_000));
  const [live, setLive] = React.useState(true);

  // Simulated stream: ~60 lines/second, capped at 150k to bound memory.
  React.useEffect(() => {
    const rand = rng(Date.now() % 100000);
    const t = window.setInterval(() => {
      setLogs((prev) => {
        const now = Date.now();
        const batch = Array.from({ length: 30 }, (_, i) => makeLine(rand, now - (30 - i) * 16));
        const next = prev.concat(batch);
        return next.length > 150_000 ? next.slice(next.length - 150_000) : next;
      });
    }, 500);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="bg-crm-bg p-4">
      <ProLogExplorer
        title="production / ap-south-1"
        logs={logs}
        live={live}
        onLiveChange={setLive}
        height={460}
      />
    </div>
  );
}
