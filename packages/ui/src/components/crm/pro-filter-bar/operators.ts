import { endOfDay, format, isValid, parseISO, startOfDay, subDays } from "date-fns";
import type {
  FacetCounts,
  FilterCondition,
  FilterField,
  FilterFieldType,
  FilterOperator,
  FilterOption,
} from "@/components/crm/pro-filter-bar/types";

interface OperatorMeta {
  label: string;
  /** How many values the operator takes: 0 (unary), 1, 2 (range) or "many" (enum sets). */
  arity: 0 | 1 | 2 | "many";
}

export const OPERATORS: Record<FilterOperator, OperatorMeta> = {
  is: { label: "is", arity: "many" },
  is_not: { label: "is not", arity: "many" },
  contains: { label: "contains", arity: 1 },
  not_contains: { label: "does not contain", arity: 1 },
  equals: { label: "is exactly", arity: 1 },
  starts_with: { label: "starts with", arity: 1 },
  eq: { label: "=", arity: 1 },
  neq: { label: "≠", arity: 1 },
  gt: { label: ">", arity: 1 },
  gte: { label: "≥", arity: 1 },
  lt: { label: "<", arity: 1 },
  lte: { label: "≤", arity: 1 },
  between: { label: "between", arity: 2 },
  on: { label: "is on", arity: 1 },
  before: { label: "is before", arity: 1 },
  after: { label: "is after", arity: 1 },
  within: { label: "is between", arity: 2 },
  last_days: { label: "in the last", arity: 1 },
  empty: { label: "is empty", arity: 0 },
  not_empty: { label: "is not empty", arity: 0 },
};

export const OPERATORS_BY_TYPE: Record<FilterFieldType, FilterOperator[]> = {
  enum: ["is", "is_not", "empty", "not_empty"],
  text: ["contains", "not_contains", "equals", "starts_with", "empty", "not_empty"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "empty", "not_empty"],
  date: ["last_days", "on", "before", "after", "within", "empty", "not_empty"],
  boolean: ["is"],
};

export function operatorLabel(op: FilterOperator, type: FilterFieldType, count = 1): string {
  if (type === "enum" && count > 1)
    return op === "is" ? "is any of" : op === "is_not" ? "is none of" : OPERATORS[op].label;
  return OPERATORS[op].label;
}

/** Values are kept only when they still make sense for the new operator. */
export function coerceValues(values: string[], from: FilterOperator, to: FilterOperator): string[] {
  const a = OPERATORS[from].arity;
  const b = OPERATORS[to].arity;
  if (b === 0) return [];
  if (from === "last_days" || to === "last_days") return from === to ? values : [];
  if (a === b) return values;
  if (b === "many") return values;
  return values.slice(0, b);
}

/** A chip with no usable value does not filter anything (it is "pending"). */
export function isActive(c: FilterCondition): boolean {
  const arity = OPERATORS[c.operator].arity;
  if (arity === 0) return true;
  const filled = c.values.filter((v) => v !== "");
  if (arity === 2) return filled.length === 2;
  return filled.length > 0;
}

export const newConditionId = () => Math.random().toString(36).slice(2, 10);

export function createCondition(field: FilterField<never>, values: string[] = []): FilterCondition {
  const operator = OPERATORS_BY_TYPE[field.type][0]!;
  return {
    id: newConditionId(),
    field: field.id,
    operator,
    values: field.type === "boolean" && !values.length ? ["true"] : values,
  };
}

// ---------------------------------------------------------------- dates

export const toDay = (d: Date) => format(d, "yyyy-MM-dd");

export function parseDay(value: string): Date | null {
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

function toTime(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return isValid(raw) ? raw.getTime() : null;
  if (typeof raw === "number") return raw;
  const d = parseISO(String(raw));
  return isValid(d) ? d.getTime() : null;
}

// ---------------------------------------------------------------- predicates

type Predicate<TRow> = (row: TRow) => boolean;

const defaultAccessor = (id: string) => (row: unknown) => (row as Record<string, unknown>)[id];

function asList(raw: unknown): string[] {
  if (raw == null || raw === "") return [];
  return Array.isArray(raw) ? raw.map(String) : [String(raw)];
}

/** Compiles one condition into a row predicate. Values are parsed once, not per row. */
export function compileCondition<TRow>(
  c: FilterCondition,
  field: FilterField<TRow>,
  now: Date = new Date(),
): Predicate<TRow> {
  const get = (field.accessor ?? defaultAccessor(field.id)) as (row: TRow) => unknown;
  const empty = (raw: unknown) => raw == null || raw === "" || (Array.isArray(raw) && !raw.length);
  if (c.operator === "empty") return (r) => empty(get(r));
  if (c.operator === "not_empty") return (r) => !empty(get(r));

  switch (field.type) {
    case "enum": {
      const set = new Set(c.values);
      const any = (r: TRow) => asList(get(r)).some((v) => set.has(v));
      return c.operator === "is_not" ? (r) => !any(r) : any;
    }
    case "boolean": {
      const want = c.values[0] !== "false";
      return (r) => Boolean(get(r)) === want;
    }
    case "text": {
      const q = (c.values[0] ?? "").toLowerCase();
      const text = (r: TRow) => String(get(r) ?? "").toLowerCase();
      if (c.operator === "not_contains") return (r) => !text(r).includes(q);
      if (c.operator === "equals") return (r) => text(r) === q;
      if (c.operator === "starts_with") return (r) => text(r).startsWith(q);
      return (r) => text(r).includes(q);
    }
    case "number": {
      const [a = NaN, b = NaN] = c.values.map(Number);
      const num = (r: TRow) => {
        const v = get(r);
        return v == null || v === "" ? NaN : Number(v);
      };
      const cmp: Record<string, (n: number) => boolean> = {
        eq: (n) => n === a,
        neq: (n) => n !== a,
        gt: (n) => n > a,
        gte: (n) => n >= a,
        lt: (n) => n < a,
        lte: (n) => n <= a,
        between: (n) => n >= Math.min(a, b) && n <= Math.max(a, b),
      };
      const test = cmp[c.operator] ?? (() => true);
      return (r) => {
        const n = num(r);
        return !Number.isNaN(n) && test(n);
      };
    }
    case "date": {
      let lo = -Infinity;
      let hi = Infinity;
      if (c.operator === "last_days") {
        lo = startOfDay(subDays(now, Math.max(0, Number(c.values[0]) - 1))).getTime();
        hi = endOfDay(now).getTime();
      } else {
        const d0 = parseDay(c.values[0] ?? "");
        const d1 = parseDay(c.values[1] ?? "");
        if (!d0) return () => true;
        if (c.operator === "on") [lo, hi] = [startOfDay(d0).getTime(), endOfDay(d0).getTime()];
        if (c.operator === "before") hi = startOfDay(d0).getTime() - 1;
        if (c.operator === "after") lo = endOfDay(d0).getTime() + 1;
        if (c.operator === "within" && d1) {
          const [x, y] = d0 <= d1 ? [d0, d1] : [d1, d0];
          [lo, hi] = [startOfDay(x).getTime(), endOfDay(y).getTime()];
        }
      }
      return (r) => {
        const t = toTime(get(r));
        return t != null && t >= lo && t <= hi;
      };
    }
  }
}

function compileAll<TRow>(filters: FilterCondition[], fields: Map<string, FilterField<TRow>>) {
  const out: { condition: FilterCondition; test: Predicate<TRow> }[] = [];
  const now = new Date();
  for (const c of filters) {
    const f = fields.get(c.field);
    if (f && isActive(c)) out.push({ condition: c, test: compileCondition(c, f, now) });
  }
  return out;
}

/**
 * Filters rows and computes facet counts in a single pass: O(rows x filters).
 * A row failing no filter counts toward every enum facet; a row failing exactly one filter
 * counts only toward that filter's own field (standard "other filters" faceting).
 */
export function runFilters<TRow>(
  rows: readonly TRow[],
  fields: readonly FilterField<TRow>[],
  filters: FilterCondition[],
): { rows: TRow[]; facets: FacetCounts } {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const compiled = compileAll(filters, byId);
  const enumFields = fields.filter((f) => f.type === "enum" || f.type === "boolean");
  const getters = enumFields.map(
    (f) => (f.accessor ?? defaultAccessor(f.id)) as (row: TRow) => unknown,
  );
  const facets: FacetCounts = {};
  for (const f of enumFields) facets[f.id] = new Map();
  const bump = (i: number, row: TRow) => {
    const field = enumFields[i]!;
    const map = facets[field.id]!;
    const raw = getters[i]!(row);
    const list = field.type === "boolean" ? [String(Boolean(raw))] : asList(raw);
    for (const v of list) map.set(v, (map.get(v) ?? 0) + 1);
  };
  const index = new Map(enumFields.map((f, i) => [f.id, i]));
  const result: TRow[] = [];

  for (const row of rows) {
    let failed = -1;
    let failures = 0;
    for (let k = 0; k < compiled.length && failures < 2; k++) {
      if (!compiled[k]!.test(row)) {
        failures++;
        failed = k;
      }
    }
    if (failures === 0) {
      result.push(row);
      for (let i = 0; i < enumFields.length; i++) bump(i, row);
    } else if (failures === 1) {
      const failedField = compiled[failed]!.condition.field;
      // Every other filter on the same field must also pass, which holds since only one failed.
      const i = index.get(failedField);
      if (i !== undefined) bump(i, row);
    }
  }
  return { rows: result, facets };
}

/** Enum options derived from data when a field does not declare them, most frequent first. */
export function deriveOptions<TRow>(
  rows: readonly TRow[],
  field: FilterField<TRow>,
): FilterOption[] {
  if (field.options) return field.options;
  if (field.type === "boolean")
    return [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ];
  const get = (field.accessor ?? defaultAccessor(field.id)) as (row: TRow) => unknown;
  const counts = new Map<string, number>();
  for (const r of rows) for (const v of asList(get(r))) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => ({ value, label: value }));
}

// ---------------------------------------------------------------- URL codec

const SEP_COND = "~";
const SEP_PART = ".";
const SEP_VAL = "_";
const enc = (s: string) =>
  encodeURIComponent(s).replace(
    /[.~_!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/** `status.is.won_open~amount.gt.5000` — compact, human-readable and stable. */
export function serializeFilters(filters: FilterCondition[]): string {
  return filters
    .map((c) => [enc(c.field), c.operator, c.values.map(enc).join(SEP_VAL)].join(SEP_PART))
    .join(SEP_COND);
}

export function parseFilters(input: string): FilterCondition[] | null {
  if (!input) return [];
  const out: FilterCondition[] = [];
  for (const chunk of input.split(SEP_COND)) {
    const [field, operator, raw = ""] = chunk.split(SEP_PART);
    if (!field || !operator || !(operator in OPERATORS)) continue;
    try {
      out.push({
        id: `${decodeURIComponent(field)}-${out.length}`,
        field: decodeURIComponent(field),
        operator: operator as FilterOperator,
        values: raw ? raw.split(SEP_VAL).map(decodeURIComponent) : [],
      });
    } catch {
      // A hand-edited URL with bad escapes drops only that chip.
    }
  }
  return out;
}

export function sameFilters(a: FilterCondition[], b: FilterCondition[]): boolean {
  return serializeFilters(a) === serializeFilters(b);
}
