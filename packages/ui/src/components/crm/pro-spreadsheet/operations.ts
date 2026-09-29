import Papa from "papaparse";
import { cellKey, type CellRange } from "@/components/crm/pro-spreadsheet/address";
import { shiftFormula } from "@/components/crm/pro-spreadsheet/formula";
import { isError, serialToDate, type CellValue } from "@/components/crm/pro-spreadsheet/functions";
import type { CellFormat } from "@/components/crm/pro-spreadsheet/store";

const numberFormatters = new Map<string, Intl.NumberFormat>();
const nf = (key: string, opts: Intl.NumberFormatOptions) => {
  let f = numberFormatters.get(key);
  if (!f) numberFormatters.set(key, (f = new Intl.NumberFormat("en-US", opts)));
  return f;
};
const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});

/** Display string for a computed value under a number format. */
export function formatValue(
  v: CellValue,
  format: CellFormat | undefined,
  currency: string,
): string {
  if (v === null) return "";
  if (isError(v)) return v.code;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "string") return v;
  switch (format) {
    case "currency":
      return nf(`c:${currency}`, { style: "currency", currency }).format(v);
    case "percent":
      return nf("p", { style: "percent", maximumFractionDigits: 2 }).format(v);
    case "number":
      return nf("n", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    case "date":
      return v > 0 && v < 2_958_466 ? dateFmt.format(serialToDate(v)) : String(v);
    case "text":
      return String(v);
    default:
      if (Number.isInteger(v)) return String(v);
      return String(Math.round(v * 1e9) / 1e9);
  }
}

/** Cells of a range as display strings, row by row. */
export function rangeRows(g: CellRange, display: (r: number, c: number) => string): string[][] {
  const rows: string[][] = [];
  for (let r = g.r1; r <= g.r2; r++) {
    const row: string[] = [];
    for (let c = g.c1; c <= g.c2; c++) row.push(display(r, c));
    rows.push(row);
  }
  return rows;
}

/** Tab-separated text Excel and Google Sheets paste natively (quotes cells with tabs/newlines). */
export const toTsv = (rows: string[][]) => Papa.unparse(rows, { delimiter: "\t", newline: "\r\n" });

/** Parses clipboard text copied from Excel/Sheets (handles quoted multi-line cells). */
export function parseTsv(text: string): string[][] {
  const trimmed = text.replace(/\r?\n$/, "");
  if (!trimmed) return [];
  const out = Papa.parse<string[]>(trimmed, { delimiter: "\t", skipEmptyLines: false });
  return out.data;
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

/**
 * Writes produced by dragging the fill handle from `src` to `dest` (which contains src).
 * Formulas shift their relative references; a numeric series (1,2,3 / 10,20) continues its
 * step; anything else repeats the source pattern.
 */
export function fillWrites(
  src: CellRange,
  dest: CellRange,
  raw: (r: number, c: number) => string,
): Record<string, string> {
  const writes: Record<string, string> = {};
  const vertical = dest.r1 !== src.r1 || dest.r2 !== src.r2;
  const h = src.r2 - src.r1 + 1;
  const w = src.c2 - src.c1 + 1;
  const mod = (a: number, n: number) => ((a % n) + n) % n;

  const series = (vals: string[]) => {
    if (!vals.every((v) => NUMERIC.test(v))) return null;
    const nums = vals.map(Number);
    const step = nums.length > 1 ? (nums[nums.length - 1]! - nums[0]!) / (nums.length - 1) : 0;
    const linear = nums.every((n, i) => Math.abs(n - (nums[0]! + step * i)) < 1e-9);
    return linear && nums.length > 1 ? { first: nums[0]!, step } : null;
  };

  if (vertical) {
    for (let c = src.c1; c <= src.c2; c++) {
      const col = Array.from({ length: h }, (_, i) => raw(src.r1 + i, c));
      const s = series(col);
      for (let r = dest.r1; r <= dest.r2; r++) {
        if (r >= src.r1 && r <= src.r2) continue;
        const offset = r - src.r1;
        const from = src.r1 + mod(offset, h);
        writes[cellKey(r, c)] = s
          ? String(Math.round((s.first + s.step * offset) * 1e9) / 1e9)
          : shiftFormula(raw(from, c), r - from, 0);
      }
    }
  } else {
    for (let r = src.r1; r <= src.r2; r++) {
      const row = Array.from({ length: w }, (_, i) => raw(r, src.c1 + i));
      const s = series(row);
      for (let c = dest.c1; c <= dest.c2; c++) {
        if (c >= src.c1 && c <= src.c2) continue;
        const offset = c - src.c1;
        const from = src.c1 + mod(offset, w);
        writes[cellKey(r, c)] = s
          ? String(Math.round((s.first + s.step * offset) * 1e9) / 1e9)
          : shiftFormula(raw(r, from), 0, c - from);
      }
    }
  }
  return writes;
}
