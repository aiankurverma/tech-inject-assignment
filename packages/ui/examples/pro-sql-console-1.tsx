import * as React from "react";
import { addMinutes, subDays } from "date-fns";
import {
  ProSqlConsole,
  createQueryTab,
  type QueryResult,
  type RunQuery,
  type SqlTable,
} from "@/components/crm/pro-sql-console";

// ---------------------------------------------------------------- schema

const SCHEMA: SqlTable[] = [
  {
    name: "accounts",
    schema: "public",
    rowCount: 8_000,
    description: "Customer companies",
    columns: [
      { name: "id", type: "integer", primaryKey: true, nullable: false },
      { name: "name", type: "text", nullable: false },
      { name: "industry", type: "text" },
      { name: "country", type: "text" },
      { name: "employees", type: "integer" },
      { name: "arr", type: "numeric", description: "Annual recurring revenue (USD)" },
      { name: "created_at", type: "timestamp", nullable: false },
    ],
  },
  {
    name: "deals",
    schema: "public",
    rowCount: 50_000,
    description: "Sales opportunities",
    columns: [
      { name: "id", type: "integer", primaryKey: true, nullable: false },
      { name: "account_id", type: "integer", nullable: false, description: "FK accounts.id" },
      { name: "owner", type: "text", nullable: false },
      { name: "stage", type: "text", nullable: false },
      { name: "amount", type: "numeric" },
      { name: "probability", type: "integer" },
      { name: "is_renewal", type: "boolean" },
      { name: "close_date", type: "date" },
    ],
  },
  {
    name: "events",
    schema: "analytics",
    rowCount: 120_000,
    description: "Product analytics events",
    columns: [
      { name: "id", type: "uuid", primaryKey: true, nullable: false },
      { name: "account_id", type: "integer" },
      { name: "name", type: "text", nullable: false },
      { name: "properties", type: "json" },
      { name: "occurred_at", type: "timestamp", nullable: false },
    ],
  },
  {
    name: "users",
    schema: "public",
    rowCount: 240,
    columns: [
      { name: "id", type: "integer", primaryKey: true, nullable: false },
      { name: "email", type: "text", nullable: false },
      { name: "full_name", type: "text" },
      { name: "role", type: "text" },
      { name: "last_login_at", type: "timestamp" },
    ],
  },
];

// ---------------------------------------------------------------- deterministic data

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickFrom =
  (rand: () => number) =>
  <T,>(a: readonly T[]): T =>
    a[Math.floor(rand() * a.length)]!;
const INDUSTRY = [
  "Fintech",
  "Healthcare",
  "Logistics",
  "Retail",
  "SaaS",
  "Manufacturing",
  "Media",
  null,
];
const COUNTRY = ["US", "GB", "DE", "IN", "FR", "BR", "JP", "CA", "AU", "NL"];
const STAGES = ["Lead", "Qualified", "Demo", "Proposal", "Negotiation", "Won", "Lost"];
const OWNERS = ["ava.chen", "marcus.reid", "priya.nair", "tom.alvarez", "lena.fischer", "noah.lee"];
const EVENTS = [
  "page_view",
  "signup",
  "invite_sent",
  "report_exported",
  "dashboard_created",
  "billing_updated",
];
const WORDS = [
  "North",
  "Blue",
  "Iron",
  "Quantum",
  "Summit",
  "Cedar",
  "Nova",
  "Harbor",
  "Atlas",
  "Vertex",
  "Lumen",
  "Pioneer",
];
const SUFFIX = [
  "Labs",
  "Systems",
  "Health",
  "Logistics",
  "Analytics",
  "Robotics",
  "Capital",
  "Cloud",
];
const BASE = new Date("2026-09-01T09:00:00Z");

const generators: Record<string, (i: number, r: () => number) => unknown[]> = {
  accounts: (i, r) => {
    const p = pickFrom(r);
    return [
      i + 1,
      `${p(WORDS)} ${p(SUFFIX)}`,
      p(INDUSTRY),
      p(COUNTRY),
      Math.round(r() ** 2 * 5000) + 5,
      Math.round(r() ** 3 * 2_000_000),
      subDays(BASE, Math.floor(r() * 1400))
        .toISOString()
        .slice(0, 19)
        .replace("T", " "),
    ];
  },
  deals: (i, r) => {
    const p = pickFrom(r);
    const stage = p(STAGES);
    return [
      100_000 + i,
      1 + Math.floor(r() * 8000),
      p(OWNERS),
      stage,
      r() < 0.04 ? null : Math.round(r() ** 3 * 250_000 + 1_000),
      stage === "Won" ? 100 : stage === "Lost" ? 0 : Math.round(r() * 90),
      r() < 0.3,
      subDays(BASE, Math.floor(r() * 400) - 90)
        .toISOString()
        .slice(0, 10),
    ];
  },
  events: (i, r) => {
    const p = pickFrom(r);
    return [
      `${(i * 2654435761).toString(16).padStart(8, "0").slice(-8)}-${Math.floor(r() * 0xffff)
        .toString(16)
        .padStart(4, "0")}-4c1a-9e2f-${i.toString(16).padStart(12, "0")}`,
      1 + Math.floor(r() * 8000),
      p(EVENTS),
      { plan: p(["free", "team", "business"]), source: p(["web", "ios", "android", "api"]) },
      addMinutes(BASE, -Math.floor(r() * 200_000))
        .toISOString()
        .slice(0, 19)
        .replace("T", " "),
    ];
  },
  users: (i, r) => {
    const name = OWNERS[i % OWNERS.length]!;
    const [first = "", last = ""] = name.split(".");
    return [
      i + 1,
      `${name}${i >= OWNERS.length ? i : ""}@acme.io`,
      `${first[0]?.toUpperCase()}${first.slice(1)} ${last[0]?.toUpperCase()}${last.slice(1)}`,
      pickFrom(r)(["admin", "member", "member", "viewer"]),
      r() < 0.1
        ? null
        : addMinutes(BASE, -Math.floor(r() * 40_000))
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),
    ];
  },
};

const cache = new Map<string, unknown[][]>();
function rowsOf(t: SqlTable): unknown[][] {
  let rows = cache.get(t.name);
  if (!rows) {
    const r = mulberry32(t.name.length * 7919);
    const gen = generators[t.name]!;
    rows = Array.from({ length: t.rowCount ?? 0 }, (_, i) => gen(i, r));
    cache.set(t.name, rows);
  }
  return rows;
}

// ---------------------------------------------------------------- tiny demo engine
// Supports SELECT <cols|*|count(*)> FROM t [WHERE col = value] [ORDER BY col [DESC]] [LIMIT n],
// plus UPDATE/DELETE row counts. Stands in for a real warehouse call.

class SqlError extends Error {
  constructor(
    message: string,
    public position?: number,
  ) {
    super(message);
  }
}

function execute(sql: string): QueryResult {
  const text = sql.replace(/;\s*$/, "");
  const lower = text.toLowerCase();
  const dml = /^\s*(update|delete\s+from)\s+([\w.]+)/i.exec(text);
  if (dml) {
    const t = SCHEMA.find((s) => [s.name, `${s.schema}.${s.name}`].includes(dml[2]!.toLowerCase()));
    if (!t)
      throw new SqlError(
        `relation "${dml[2]}" does not exist`,
        lower.indexOf(dml[2]!.toLowerCase()),
      );
    return { columns: [], rows: [], rowCount: Math.floor((t.rowCount ?? 0) * 0.07) };
  }
  const m = /^\s*select\s+([\s\S]+?)\s+from\s+([\w."]+)(?:\s+\w+)?([\s\S]*)$/i.exec(text);
  if (!m) throw new SqlError("syntax error: this demo engine runs SELECT … FROM … queries", 0);
  const [, colText = "", tableName = "", rest = ""] = m;
  const table = SCHEMA.find((s) =>
    [s.name, `${s.schema}.${s.name}`].includes(tableName.replace(/"/g, "").toLowerCase()),
  );
  if (!table)
    throw new SqlError(
      `relation "${tableName}" does not exist`,
      lower.indexOf(tableName.toLowerCase()),
    );
  const colIndex = (name: string) =>
    table.columns.findIndex((c) => c.name === name.replace(/^\w+\./, "").toLowerCase());
  let rows = rowsOf(table);

  const where = /\bwhere\s+([\w.]+)\s*(=|>|<|>=|<=|<>|!=)\s*('([^']*)'|[\d.]+|true|false)/i.exec(
    rest,
  );
  if (where) {
    const ci = colIndex(where[1]!);
    if (ci < 0)
      throw new SqlError(
        `column "${where[1]}" does not exist`,
        lower.lastIndexOf(where[1]!.toLowerCase()),
      );
    const raw = where[4] ?? where[3]!;
    const val: unknown = /^(true|false)$/i.test(raw)
      ? raw.toLowerCase() === "true"
      : where[4] != null
        ? raw
        : Number(raw);
    const op = where[2]!;
    rows = rows.filter((r) => {
      const v = r[ci] as number;
      if (op === "=") return v === val;
      if (op === "<>" || op === "!=") return v !== val;
      if (v == null) return false;
      return op === ">"
        ? v > (val as number)
        : op === "<"
          ? v < (val as number)
          : op === ">="
            ? v >= (val as number)
            : v <= (val as number);
    });
  }
  if (/^\s*count\(\*\)\s*$/i.test(colText))
    return { columns: [{ name: "count", type: "bigint" }], rows: [[rows.length]] };

  const order = /\border\s+by\s+([\w.]+)(\s+desc)?/i.exec(rest);
  if (order) {
    const ci = colIndex(order[1]!);
    if (ci < 0)
      throw new SqlError(
        `column "${order[1]}" does not exist`,
        lower.lastIndexOf(order[1]!.toLowerCase()),
      );
    const dir = order[2] ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const x = a[ci] as number;
      const y = b[ci] as number;
      return x == null ? 1 : y == null ? -1 : x < y ? -dir : x > y ? dir : 0;
    });
  }
  const limit = /\blimit\s+(\d+)/i.exec(rest);
  if (limit) rows = rows.slice(0, Number(limit[1]));

  let picks = table.columns.map((_, i) => i);
  if (colText.trim() !== "*") {
    picks = colText.split(",").map((c) => {
      const name = c.trim().split(/\s+/)[0] ?? "";
      const ci = colIndex(name);
      if (ci < 0)
        throw new SqlError(`column "${name}" does not exist`, lower.indexOf(name.toLowerCase()));
      return ci;
    });
  }
  const capped = rows.length > 100_000;
  if (capped) rows = rows.slice(0, 100_000);
  return {
    columns: picks.map((i) => ({ name: table.columns[i]!.name, type: table.columns[i]!.type })),
    rows: colText.trim() === "*" ? rows : rows.map((r) => picks.map((i) => r[i])),
    notice: capped ? "Result truncated to 100,000 rows" : undefined,
  };
}

const runQuery: RunQuery = (sql, { signal }) =>
  new Promise((resolve, reject) => {
    const started = performance.now();
    const timer = setTimeout(
      () => {
        try {
          const res = execute(sql);
          resolve({ ...res, durationMs: Math.round(performance.now() - started) });
        } catch (e) {
          reject(e);
        }
      },
      250 + Math.random() * 500,
    );
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new SqlError("Query cancelled"));
    });
  });

const TABS = [
  createQueryTab({
    title: "Pipeline",
    sql: `-- Open pipeline, largest first. Ctrl/Cmd+Enter runs the statement under the cursor.
SELECT id, account_id, owner, stage, amount, probability, close_date
FROM deals d
WHERE stage = 'Negotiation'
ORDER BY amount DESC
LIMIT 5000;

SELECT * FROM public.deals;

-- Lint demo: typo in the column and table names are underlined
SELECT d.ammount FROM deals d JOIN acounts a ON a.id = d.account_id;
`,
  }),
  createQueryTab({ title: "Events", sql: "SELECT * FROM analytics.events LIMIT 20000;" }),
  createQueryTab({ title: "Cleanup", sql: "DELETE FROM users;" }),
];

const HISTORY = [
  {
    id: "h1",
    sql: "SELECT count(*) FROM deals WHERE is_renewal = true",
    at: Date.now() - 3_600_000,
    durationMs: 412,
    rowCount: 1,
    ok: true,
  },
  {
    id: "h2",
    sql: "SELECT name, arr FROM accounts ORDER BY arr DESC LIMIT 100",
    at: Date.now() - 7_200_000,
    durationMs: 388,
    rowCount: 100,
    ok: true,
  },
  {
    id: "h3",
    sql: "SELECT * FROM invoices",
    at: Date.now() - 86_400_000,
    durationMs: 120,
    ok: false,
  },
];

export default function Example() {
  return (
    <div className="w-full">
      <ProSqlConsole
        schema={SCHEMA}
        onRun={runQuery}
        defaultTabs={TABS}
        defaultHistory={HISTORY}
        height={620}
      />
    </div>
  );
}
