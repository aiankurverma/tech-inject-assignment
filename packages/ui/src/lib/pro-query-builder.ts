import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  formatISO,
  isValid,
  parseISO,
  startOfDay,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";
import { z } from "zod";
import {
  formatQuery,
  isRuleGroup,
  type Field,
  type RuleGroupType,
  type RuleType,
} from "react-querybuilder";

/* ------------------------------------------------------------------------------------------------
 * Field model. Kitbase fields are a thin, typed layer over react-querybuilder's Field: the `type`
 * picks the operator set, the value editor, validation and how the value is exported.
 * ---------------------------------------------------------------------------------------------- */

export type QueryFieldType = "text" | "number" | "date" | "select" | "multiselect" | "boolean";

export interface QueryFieldOption {
  value: string;
  label: string;
}

export interface QueryField {
  /** Column / property name used in exports. */
  name: string;
  label: string;
  type: QueryFieldType;
  /** Choices for select / multiselect. */
  options?: QueryFieldOption[];
  /** Optional group label shown in the field picker (e.g. "Company", "Activity"). */
  group?: string;
  placeholder?: string;
  /** Inclusive bounds for number fields, enforced by validation. */
  min?: number;
  max?: number;
  /** Restrict the operators offered for this field (subset of the type's defaults). */
  operators?: string[];
}

export interface QueryOperator {
  name: string;
  label: string;
  /** Number of values: 0 = none, 1 = single, 2 = between pair, "list" = array. */
  arity: 0 | 1 | 2 | "list";
}

export const RELATIVE_UNITS = ["days", "weeks", "months", "years"] as const;
export type RelativeUnit = (typeof RELATIVE_UNITS)[number];

const op = (name: string, label: string, arity: QueryOperator["arity"]): QueryOperator => ({
  name,
  label,
  arity,
});

const EMPTY_OPS = [op("null", "is empty", 0), op("notNull", "is not empty", 0)];

export const OPERATORS_BY_TYPE: Record<QueryFieldType, QueryOperator[]> = {
  text: [
    op("=", "is", 1),
    op("!=", "is not", 1),
    op("contains", "contains", 1),
    op("doesNotContain", "does not contain", 1),
    op("beginsWith", "starts with", 1),
    op("endsWith", "ends with", 1),
    ...EMPTY_OPS,
  ],
  number: [
    op("=", "=", 1),
    op("!=", "≠", 1),
    op(">", ">", 1),
    op(">=", "≥", 1),
    op("<", "<", 1),
    op("<=", "≤", 1),
    op("between", "is between", 2),
    op("notBetween", "is not between", 2),
    ...EMPTY_OPS,
  ],
  date: [
    op("=", "is on", 1),
    op("<", "is before", 1),
    op(">", "is after", 1),
    op("between", "is between", 2),
    op("inLast", "in the last", 1),
    op("inNext", "in the next", 1),
    op("notInLast", "not in the last", 1),
    ...EMPTY_OPS,
  ],
  select: [
    op("=", "is", 1),
    op("!=", "is not", 1),
    op("in", "is any of", "list"),
    op("notIn", "is none of", "list"),
    ...EMPTY_OPS,
  ],
  multiselect: [op("in", "has any of", "list"), op("notIn", "has none of", "list"), ...EMPTY_OPS],
  boolean: [op("=", "is", 1)],
};

export const RELATIVE_OPERATORS = new Set(["inLast", "inNext", "notInLast"]);

export function operatorsFor(field: QueryField | undefined): QueryOperator[] {
  if (!field) return [];
  const all = OPERATORS_BY_TYPE[field.type];
  return field.operators ? all.filter((o) => field.operators!.includes(o.name)) : all;
}

export function operatorArity(
  field: QueryField | undefined,
  operator: string,
): QueryOperator["arity"] {
  return operatorsFor(field).find((o) => o.name === operator)?.arity ?? 1;
}

/** Default value for a (field, operator) pair; used when either changes. */
export function defaultValueFor(field: QueryField | undefined, operator: string): unknown {
  if (!field) return "";
  const arity = operatorArity(field, operator);
  if (arity === 0) return "";
  if (arity === "list") return [];
  if (arity === 2) return ["", ""];
  if (RELATIVE_OPERATORS.has(operator)) return "30 days";
  if (field.type === "boolean") return "true";
  return "";
}

/** Converts Kitbase fields into react-querybuilder fields (memoise the result). */
export function toRqbFields(fields: QueryField[]): Field[] {
  return fields.map((f) => ({
    name: f.name,
    value: f.name,
    label: f.label,
    datatype: f.type,
    operators: operatorsFor(f).map(({ name, label }) => ({ name, value: name, label })),
    defaultOperator: operatorsFor(f)[0]?.name,
    values: f.options?.map((o) => ({ name: o.value, value: o.value, label: o.label })),
  }));
}

/* ------------------------------------------------------------------------------------------------
 * Relative dates. Stored as "<amount> <unit>" so the query stays serialisable; resolved to an
 * absolute ISO range at export time so SQL / Mongo / JsonLogic output is portable.
 * ---------------------------------------------------------------------------------------------- */

export function parseRelative(value: unknown): { amount: number; unit: RelativeUnit } | null {
  if (typeof value !== "string") return null;
  const m = /^(\d+)\s+(days|weeks|months|years)$/.exec(value.trim());
  return m ? { amount: Number(m[1]), unit: m[2] as RelativeUnit } : null;
}

const SUB = { days: subDays, weeks: subWeeks, months: subMonths, years: subYears };
const ADD = { days: addDays, weeks: addWeeks, months: addMonths, years: addYears };
const iso = (d: Date) => formatISO(d, { representation: "date" });

export function resolveRelativeRange(operator: string, value: unknown, now = new Date()) {
  const rel = parseRelative(value);
  if (!rel) return null;
  if (operator === "inNext")
    return [iso(startOfDay(now)), iso(endOfDay(ADD[rel.unit](now, rel.amount)))];
  return [iso(startOfDay(SUB[rel.unit](now, rel.amount))), iso(endOfDay(now))];
}

/** Returns a copy of the query with relative-date rules rewritten as absolute `between` rules. */
export function resolveQuery(query: RuleGroupType, now = new Date()): RuleGroupType {
  return {
    ...query,
    rules: query.rules.map((r) => {
      if (typeof r === "string") return r;
      if (isRuleGroup(r)) return resolveQuery(r as RuleGroupType, now);
      if (!RELATIVE_OPERATORS.has(r.operator)) return r;
      const range = resolveRelativeRange(r.operator, r.value, now);
      if (!range) return r;
      return {
        ...r,
        operator: r.operator === "notInLast" ? "notBetween" : "between",
        value: range,
      };
    }),
  };
}

/* ------------------------------------------------------------------------------------------------
 * Validation (zod). Produces a map of rule id -> message; empty map means the query is valid.
 * ---------------------------------------------------------------------------------------------- */

const nonEmpty = z.string().trim().min(1, "Enter a value");
const dateStr = z
  .string()
  .min(1, "Pick a date")
  .refine((s) => isValid(parseISO(s)), "Invalid date");

function numberSchema(field: QueryField) {
  let n = z.coerce.number({ invalid_type_error: "Enter a number" }).finite("Enter a number");
  if (field.min !== undefined) n = n.min(field.min, `Must be ≥ ${field.min}`);
  if (field.max !== undefined) n = n.max(field.max, `Must be ≤ ${field.max}`);
  return z.union([z.number(), z.string().trim().min(1, "Enter a number")]).pipe(n);
}

function schemaFor(field: QueryField, operator: string): z.ZodTypeAny | null {
  const arity = operatorArity(field, operator);
  if (arity === 0) return null;
  if (RELATIVE_OPERATORS.has(operator))
    return z.string().refine((v) => (parseRelative(v)?.amount ?? 0) > 0, "Enter a period > 0");
  if (arity === "list") return z.array(z.string()).min(1, "Choose at least one");
  const single =
    field.type === "number" ? numberSchema(field) : field.type === "date" ? dateStr : nonEmpty;
  if (arity === 2)
    return z
      .tuple([single, single])
      .refine(
        ([a, b]) =>
          field.type === "number"
            ? Number(a) <= Number(b)
            : field.type === "date"
              ? String(a) <= String(b)
              : true,
        "Start must be before end",
      );
  return single;
}

export type ValidationIssues = Record<string, string>;

export function validateQuery(query: RuleGroupType, fields: QueryField[]): ValidationIssues {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const issues: ValidationIssues = {};
  const walk = (group: RuleGroupType) => {
    if (group.rules.length === 0 && group.id) issues[group.id] = "Group has no conditions";
    for (const r of group.rules) {
      if (typeof r === "string") continue;
      if (isRuleGroup(r)) {
        walk(r as RuleGroupType);
        continue;
      }
      const rule = r as RuleType;
      const field = byName.get(rule.field);
      const id = rule.id ?? rule.field;
      if (!field) {
        issues[id] = "Unknown field";
        continue;
      }
      const schema = schemaFor(field, rule.operator);
      if (!schema) continue;
      const res = schema.safeParse(rule.value);
      if (!res.success) issues[id] = res.error.issues[0]?.message ?? "Invalid value";
    }
  };
  walk(query);
  return issues;
}

/* ------------------------------------------------------------------------------------------------
 * Export.
 * ---------------------------------------------------------------------------------------------- */

export type QueryExportFormat = "sql" | "mongodb" | "jsonlogic" | "json";

export const EXPORT_LABELS: Record<QueryExportFormat, string> = {
  sql: "SQL",
  mongodb: "MongoDB",
  jsonlogic: "JsonLogic",
  json: "JSON",
};

export function exportQuery(
  query: RuleGroupType,
  format: QueryExportFormat,
  now = new Date(),
): string {
  const resolved = resolveQuery(query, now);
  switch (format) {
    case "sql":
      return formatQuery(resolved, { format: "sql", parseNumbers: true });
    case "mongodb":
      return JSON.stringify(
        formatQuery(resolved, { format: "mongodb_query", parseNumbers: true }),
        null,
        2,
      );
    case "jsonlogic":
      return JSON.stringify(
        formatQuery(resolved, { format: "jsonlogic", parseNumbers: true }),
        null,
        2,
      );
    default:
      return JSON.stringify(JSON.parse(formatQuery(query, "json_without_ids")), null, 2);
  }
}

/** Counts leaf conditions in a query (used for summaries). */
export function countRules(query: RuleGroupType): number {
  let n = 0;
  for (const r of query.rules) {
    if (typeof r === "string") continue;
    n += isRuleGroup(r) ? countRules(r as RuleGroupType) : 1;
  }
  return n;
}

/* ------------------------------------------------------------------------------------------------
 * Saved segments.
 * ---------------------------------------------------------------------------------------------- */

export interface SavedSegment {
  id: string;
  name: string;
  query: RuleGroupType;
  updatedAt: string;
}

export const segmentNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(60, "Name must be at most 60 characters");
