import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue";

/** The five standard cron fields, in expression order. */
export type CronFieldKey = "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

/** Visual representation of a single cron field. `raw` keeps anything the picker cannot express. */
export type CronFieldValue =
  | { kind: "every" }
  | { kind: "step"; step: number; start: number }
  | { kind: "specific"; values: number[] }
  | { kind: "range"; from: number; to: number }
  | { kind: "raw"; text: string };

export type CronFields = Record<CronFieldKey, CronFieldValue>;

export interface CronFieldSpec {
  key: CronFieldKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  /** Short labels for values (months, weekdays). */
  names?: string[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const CRON_FIELD_SPECS: readonly CronFieldSpec[] = [
  { key: "minute", label: "Minute", unit: "minutes", min: 0, max: 59 },
  { key: "hour", label: "Hour", unit: "hours", min: 0, max: 23 },
  { key: "dayOfMonth", label: "Day of month", unit: "days", min: 1, max: 31 },
  { key: "month", label: "Month", unit: "months", min: 1, max: 12, names: MONTHS },
  { key: "dayOfWeek", label: "Day of week", unit: "weekdays", min: 0, max: 6, names: WEEKDAYS },
];

export const CRON_MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
  "@weekdays": "0 0 * * 1-5",
  "@weekends": "0 0 * * 0,6",
};

export interface CronPreset {
  label: string;
  expression: string;
}

export const DEFAULT_CRON_PRESETS: CronPreset[] = [
  { label: "Every 5 minutes", expression: "*/5 * * * *" },
  { label: "Hourly", expression: "0 * * * *" },
  { label: "Daily 09:00", expression: "0 9 * * *" },
  { label: "Weekdays 08:30", expression: "30 8 * * 1-5" },
  { label: "Weekly Mon 07:00", expression: "0 7 * * 1" },
  { label: "1st of month", expression: "0 0 1 * *" },
  { label: "Quarterly", expression: "0 6 1 1,4,7,10 *" },
];

function toNumber(token: string, spec: CronFieldSpec): number | null {
  if (/^\d+$/.test(token)) {
    const n = Number(token);
    // cron allows 7 as Sunday; normalise it.
    if (spec.key === "dayOfWeek" && n === 7) return 0;
    return n;
  }
  if (spec.names) {
    const idx = spec.names.findIndex((n) => n.toLowerCase() === token.toLowerCase());
    if (idx >= 0) return idx + spec.min;
  }
  return null;
}

/** Parse one field's text into a visual value. Never throws; unknown syntax becomes `raw`. */
export function parseField(text: string, spec: CronFieldSpec): CronFieldValue {
  const t = text.trim();
  if (t === "*" || t === "?") return { kind: "every" };
  const step = /^(\*|\d+)\/(\d+)$/.exec(t);
  if (step) {
    const start = step[1] === "*" ? spec.min : Number(step[1]);
    return { kind: "step", step: Number(step[2]), start };
  }
  const range = /^([a-z0-9]+)-([a-z0-9]+)$/i.exec(t);
  if (range) {
    const from = toNumber(range[1]!, spec);
    const to = toNumber(range[2]!, spec);
    if (from !== null && to !== null) return { kind: "range", from, to };
  }
  const parts = t.split(",");
  const values: number[] = [];
  for (const p of parts) {
    const n = toNumber(p, spec);
    if (n === null) return { kind: "raw", text: t };
    values.push(n);
  }
  if (values.length)
    return { kind: "specific", values: [...new Set(values)].sort((a, b) => a - b) };
  return { kind: "raw", text: t };
}

/** Serialise a visual value back to cron text. */
export function serializeField(value: CronFieldValue, spec: CronFieldSpec): string {
  switch (value.kind) {
    case "every":
      return "*";
    case "step":
      return `${value.start === spec.min ? "*" : value.start}/${Math.max(1, value.step)}`;
    case "range":
      return `${value.from}-${value.to}`;
    case "specific":
      return value.values.length ? [...value.values].sort((a, b) => a - b).join(",") : "*";
    case "raw":
      return value.text.trim() || "*";
  }
}

/** Expand macros such as `@daily` to five fields. */
export function normalizeExpression(expression: string): string {
  const t = expression.trim().replace(/\s+/g, " ");
  return CRON_MACROS[t.toLowerCase()] ?? t;
}

/** Split an expression into visual fields, or `null` when it is not a five-field expression. */
export function parseExpression(expression: string): CronFields | null {
  const parts = normalizeExpression(expression).split(" ");
  if (parts.length !== 5) return null;
  const fields = {} as CronFields;
  CRON_FIELD_SPECS.forEach((spec, i) => {
    fields[spec.key] = parseField(parts[i]!, spec);
  });
  return fields;
}

export function serializeFields(fields: CronFields): string {
  return CRON_FIELD_SPECS.map((s) => serializeField(fields[s.key], s)).join(" ");
}

/** Range checks that give friendlier messages than the parser. */
export function validateFields(fields: CronFields): Partial<Record<CronFieldKey, string>> {
  const errors: Partial<Record<CronFieldKey, string>> = {};
  for (const spec of CRON_FIELD_SPECS) {
    const v = fields[spec.key];
    const inRange = (n: number) => Number.isInteger(n) && n >= spec.min && n <= spec.max;
    const bad = `${spec.label} must be between ${spec.min} and ${spec.max}`;
    if (v.kind === "step") {
      if (!inRange(v.start)) errors[spec.key] = bad;
      else if (!Number.isInteger(v.step) || v.step < 1 || v.step > spec.max - spec.min + 1)
        errors[spec.key] = `Interval must be 1-${spec.max - spec.min + 1}`;
    } else if (v.kind === "range") {
      if (!inRange(v.from) || !inRange(v.to)) errors[spec.key] = bad;
      else if (v.from > v.to) errors[spec.key] = "Range start must not be after its end";
    } else if (v.kind === "specific") {
      if (v.values.some((n) => !inRange(n))) errors[spec.key] = bad;
    }
  }
  return errors;
}

export interface CronValidation {
  valid: boolean;
  error?: string;
}

/** Validate with cron-parser (the same engine most Node schedulers use). */
export function validateCron(expression: string, tz?: string): CronValidation {
  const expr = normalizeExpression(expression);
  if (!expr) return { valid: false, error: "Expression is empty" };
  const count = expr.split(" ").length;
  if (count < 5 || count > 6)
    return { valid: false, error: `Expected 5 fields (or 6 with seconds), got ${count}` };
  try {
    CronExpressionParser.parse(expr, { tz, strict: false });
    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message || "Invalid expression" };
  }
}

/** Next `count` fire times after `from`, evaluated in `tz`. Returns [] for invalid input. */
export function getNextRuns(
  expression: string,
  { count = 5, tz, from = new Date() }: { count?: number; tz?: string; from?: Date } = {},
): Date[] {
  try {
    const it = CronExpressionParser.parse(normalizeExpression(expression), {
      tz,
      currentDate: from,
    });
    return it.take(count).map((d) => d.toDate());
  } catch {
    return [];
  }
}

/** Human-readable sentence via cronstrue. */
export function describeCron(
  expression: string,
  { use24HourTimeFormat = true, verbose = false } = {},
): string {
  try {
    return cronstrue.toString(normalizeExpression(expression), {
      use24HourTimeFormat,
      verbose,
      throwExceptionOnParseError: true,
    });
  } catch {
    return "";
  }
}
