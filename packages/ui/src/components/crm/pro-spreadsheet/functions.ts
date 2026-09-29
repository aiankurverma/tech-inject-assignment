/**
 * Function library. The maths, statistics, lookup, text and finance functions are delegated to
 * @formulajs/formulajs (MIT); this module adapts its calling convention (2D arrays, Error
 * objects, JS Dates) to the spreadsheet value model. Date functions use Excel serial numbers,
 * which formulajs does not, so those few are implemented here.
 */
import * as formulajs from "@formulajs/formulajs";

export class FormulaError {
  constructor(readonly code: string) {}
  toString() {
    return this.code;
  }
}

/** A computed cell value. `null` is an empty cell. */
export type CellValue = number | string | boolean | null | FormulaError;
/** A function argument: a scalar or a 2D block from a range. */
export type Arg = CellValue | CellValue[][];

export const ERR = {
  value: new FormulaError("#VALUE!"),
  div0: new FormulaError("#DIV/0!"),
  ref: new FormulaError("#REF!"),
  name: new FormulaError("#NAME?"),
  na: new FormulaError("#N/A"),
  num: new FormulaError("#NUM!"),
  cycle: new FormulaError("#CYCLE!"),
} as const;

export const isError = (v: unknown): v is FormulaError => v instanceof FormulaError;

type Fn = (...args: unknown[]) => unknown;
const lib = formulajs as unknown as Record<string, Fn & Record<string, Fn>>;

// ---- serial dates (1900 system, 1 = 1900-01-01, with Excel's phantom 1900-02-29) ----
const EPOCH = Date.UTC(1899, 11, 30);
const DAY = 86_400_000;
export const dateToSerial = (d: Date) =>
  (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / DAY +
  (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
export const serialToDate = (n: number) => new Date(EPOCH + Math.floor(n) * DAY);
const ymdSerial = (y: number, m: number, d: number) => (Date.UTC(y, m, d) - EPOCH) / DAY;

// ---- coercion helpers ----
export function toNumber(v: CellValue): number | FormulaError {
  if (v === null || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (isError(v)) return v;
  const n = Number(v.replace(/[,$\s]/g, ""));
  return Number.isFinite(n) ? n : ERR.value;
}

export function toText(v: CellValue): string {
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(Math.round(v * 1e10) / 1e10);
  return String(v);
}

const scalar = (a: Arg): CellValue => (Array.isArray(a) ? (a[0]?.[0] ?? null) : a);

function firstError(args: Arg[]): FormulaError | null {
  for (const a of args) {
    if (Array.isArray(a)) {
      for (const row of a) for (const v of row) if (isError(v)) return v;
    } else if (isError(a)) return a;
  }
  return null;
}

function fromLib(result: unknown): CellValue {
  if (result instanceof Error) return new FormulaError(result.message || "#VALUE!");
  if (result instanceof Date) return dateToSerial(result);
  if (typeof result === "number") {
    if (Number.isNaN(result)) return ERR.num;
    if (!Number.isFinite(result)) return ERR.div0;
    return result;
  }
  if (Array.isArray(result)) return fromLib(Array.isArray(result[0]) ? result[0][0] : result[0]);
  if (result === undefined) return null;
  return result as CellValue;
}

/** Wraps a formulajs function: errors in any argument propagate, like Excel. */
const wrap =
  (fn: Fn | undefined) =>
  (args: Arg[]): CellValue => {
    if (!fn) return ERR.name;
    const err = firstError(args);
    if (err) return err;
    try {
      return fromLib(fn(...args));
    } catch {
      return ERR.value;
    }
  };

const num1 = (args: Arg[], i: number) => toNumber(scalar(args[i] ?? null));

const dateFn =
  (pick: (d: Date) => number) =>
  (args: Arg[]): CellValue => {
    const n = num1(args, 0);
    return isError(n) ? n : pick(serialToDate(n));
  };

const LIBRARY_FUNCTIONS = [
  "SUM",
  "SUMPRODUCT",
  "PRODUCT",
  "AVERAGE",
  "AVERAGEIF",
  "AVERAGEIFS",
  "MIN",
  "MAX",
  "MEDIAN",
  "COUNT",
  "COUNTA",
  "COUNTBLANK",
  "COUNTIF",
  "COUNTIFS",
  "SUMIF",
  "SUMIFS",
  "LARGE",
  "SMALL",
  "ROUND",
  "ROUNDUP",
  "ROUNDDOWN",
  "ABS",
  "SQRT",
  "POWER",
  "MOD",
  "INT",
  "CEILING",
  "FLOOR",
  "SIGN",
  "EXP",
  "LN",
  "LOG10",
  "VLOOKUP",
  "HLOOKUP",
  "INDEX",
  "MATCH",
  "CONCATENATE",
  "CONCAT",
  "TEXTJOIN",
  "LEFT",
  "RIGHT",
  "MID",
  "LEN",
  "UPPER",
  "LOWER",
  "PROPER",
  "TRIM",
  "SUBSTITUTE",
  "AND",
  "OR",
  "NOT",
  "XOR",
  "PMT",
  "NPV",
  "IRR",
  "FV",
  "PV",
  "RATE",
] as const;

type Impl = (args: Arg[]) => CellValue;

export const FUNCTIONS: Record<string, Impl> = {
  ...Object.fromEntries(LIBRARY_FUNCTIONS.map((n) => [n, wrap(lib[n])])),
  STDEV: wrap(lib.STDEV?.S),
  STDEVP: wrap(lib.STDEV?.P),
  DATE: (args) => {
    const [y, m, d] = [num1(args, 0), num1(args, 1), num1(args, 2)];
    if (isError(y)) return y;
    if (isError(m)) return m;
    if (isError(d)) return d;
    return ymdSerial(y < 1900 ? y + 1900 : y, m - 1, d);
  },
  YEAR: dateFn((d) => d.getUTCFullYear()),
  MONTH: dateFn((d) => d.getUTCMonth() + 1),
  DAY: dateFn((d) => d.getUTCDate()),
  WEEKDAY: dateFn((d) => d.getUTCDay() + 1),
  EOMONTH: (args) => {
    const s = num1(args, 0);
    const k = num1(args, 1);
    if (isError(s)) return s;
    if (isError(k)) return k;
    const d = serialToDate(s);
    return ymdSerial(d.getUTCFullYear(), d.getUTCMonth() + Math.trunc(k) + 1, 0);
  },
  EDATE: (args) => {
    const s = num1(args, 0);
    const k = num1(args, 1);
    if (isError(s)) return s;
    if (isError(k)) return k;
    const d = serialToDate(s);
    return ymdSerial(d.getUTCFullYear(), d.getUTCMonth() + Math.trunc(k), d.getUTCDate());
  },
  TODAY: () => Math.floor(dateToSerial(new Date())),
  NOW: () => dateToSerial(new Date()),
  ISBLANK: (args) => scalar(args[0] ?? null) === null,
  ISNUMBER: (args) => typeof scalar(args[0] ?? null) === "number",
  ISTEXT: (args) => typeof scalar(args[0] ?? null) === "string",
  ISERROR: (args) => isError(scalar(args[0] ?? null)),
  ROWS: (args) => (Array.isArray(args[0]) ? args[0].length : 1),
  COLUMNS: (args) => (Array.isArray(args[0]) ? (args[0][0]?.length ?? 0) : 1),
  PI: () => Math.PI,
};

/** Functions evaluated lazily by the engine (only the taken branch is computed). */
export const LAZY_FUNCTIONS = ["IF", "IFERROR", "IFNA", "CHOOSE"] as const;

/** Every function name the engine understands, sorted. */
export const FUNCTION_NAMES: readonly string[] = [
  ...Object.keys(FUNCTIONS),
  ...LAZY_FUNCTIONS,
].sort();
