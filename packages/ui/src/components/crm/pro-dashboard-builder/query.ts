import { format as fmtDate } from "date-fns";
import type { RuleGroupType, RuleType } from "react-querybuilder";
import type {
  Aggregate,
  DashboardField,
  ValueFormat,
} from "@/components/crm/pro-dashboard-builder/schema";

export type DataRecord = Record<string, unknown>;
type Predicate = (r: DataRecord) => boolean;

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
const str = (v: unknown) => (v == null ? "" : String(v).toLowerCase());
const list = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(String)
    : String(v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

function compileRule(rule: RuleType, types: Map<string, DashboardField["type"]>): Predicate {
  const { field, operator, value } = rule;
  const t = types.get(field) ?? "string";
  const coerce = (v: unknown) =>
    t === "number" ? num(v) : t === "date" ? new Date(String(v)).getTime() : str(v);
  const get = (r: DataRecord) => {
    const v = r[field];
    return t === "date" && v instanceof Date ? v.getTime() : coerce(v);
  };
  switch (operator) {
    case "null":
      return (r) => r[field] == null || r[field] === "";
    case "notNull":
      return (r) => r[field] != null && r[field] !== "";
    case "in":
    case "notIn": {
      const set = new Set(list(value).map((v) => String(coerce(v))));
      return operator === "in" ? (r) => set.has(String(get(r))) : (r) => !set.has(String(get(r)));
    }
    case "between":
    case "notBetween": {
      const [a = -Infinity, b = Infinity] = list(value).map(coerce);
      const inside = (r: DataRecord) => {
        const v = get(r);
        return v >= a && v <= b;
      };
      return operator === "between" ? inside : (r) => !inside(r);
    }
    case "contains":
    case "doesNotContain": {
      const needle = str(value);
      return operator === "contains"
        ? (r) => str(r[field]).includes(needle)
        : (r) => !str(r[field]).includes(needle);
    }
    case "beginsWith":
      return (r) => str(r[field]).startsWith(str(value));
    case "endsWith":
      return (r) => str(r[field]).endsWith(str(value));
  }
  const c = coerce(value);
  switch (operator) {
    case "=":
      return (r) => get(r) === c;
    case "!=":
      return (r) => get(r) !== c;
    case "<":
      return (r) => get(r) < c;
    case "<=":
      return (r) => get(r) <= c;
    case ">":
      return (r) => get(r) > c;
    case ">=":
      return (r) => get(r) >= c;
    default:
      return () => true;
  }
}

/** Compile a react-querybuilder rule group into a single predicate (compiled once, O(1) per row). */
export function compileQuery(group: RuleGroupType, fields: DashboardField[]): Predicate {
  const types = new Map(fields.map((f) => [f.name, f.type]));
  const walk = (g: RuleGroupType): Predicate => {
    const parts = g.rules
      .filter((r): r is RuleType | RuleGroupType => typeof r !== "string")
      .filter((r) => "rules" in r || types.has((r as RuleType).field))
      .map((r) => ("rules" in r ? walk(r) : compileRule(r, types)));
    const base: Predicate = !parts.length
      ? () => true
      : g.combinator === "or"
        ? (row) => parts.some((p) => p(row))
        : (row) => parts.every((p) => p(row));
    return g.not ? (row) => !base(row) : base;
  };
  return walk(group);
}

export function aggregate(rows: DataRecord[], metric: string | undefined, agg: Aggregate): number {
  if (agg === "count" || !metric) return rows.length;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let n = 0;
  for (const r of rows) {
    const v = num(r[metric]);
    if (!Number.isFinite(v)) continue;
    sum += v;
    n++;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!n) return 0;
  return agg === "sum" ? sum : agg === "avg" ? sum / n : agg === "min" ? min : max;
}

/** Group rows by a dimension. Date fields bucket by month (yyyy-MM), sorted chronologically. */
export function groupSeries(
  rows: DataRecord[],
  groupBy: string,
  type: DashboardField["type"],
  metric: string | undefined,
  agg: Aggregate,
): { key: string; value: number }[] {
  const buckets = new Map<string, DataRecord[]>();
  for (const r of rows) {
    const raw = r[groupBy];
    let key: string;
    if (type === "date") {
      const d = raw instanceof Date ? raw : new Date(String(raw));
      if (Number.isNaN(d.getTime())) continue;
      key = fmtDate(d, "yyyy-MM");
    } else key = raw == null ? "(none)" : String(raw);
    const b = buckets.get(key);
    if (b) b.push(r);
    else buckets.set(key, [r]);
  }
  const out = [...buckets].map(([key, rs]) => ({ key, value: aggregate(rs, metric, agg) }));
  return type === "date"
    ? out.sort((a, b) => (a.key < b.key ? -1 : 1))
    : out.sort((a, b) => b.value - a.value);
}

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, notation: "compact" });
const cf = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
export function formatValue(v: number, f: ValueFormat): string {
  if (f === "currency") return cf.format(v);
  if (f === "percent") return `${(v * 100).toFixed(1)}%`;
  return nf.format(v);
}
