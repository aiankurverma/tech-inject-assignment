import type { Draft } from "immer";
import {
  STATUSES,
  productSchema,
  variantSchema,
  type CatalogChanges,
  type CatalogRow,
  type CatalogStatus,
  type CellEdit,
  type Product,
  type ProductOption,
  type Variant,
} from "@/components/crm/pro-catalog-manager/types";

/* ------------------------------------------------------------------ */
/* Variant generation                                                  */
/* ------------------------------------------------------------------ */

/** Cartesian product of option values, preserving option order. */
export function cartesian(options: ProductOption[]): Record<string, string>[] {
  const opts = options.filter((o) => o.name.trim() && o.values.length > 0);
  if (opts.length === 0) return [{}];
  let acc: Record<string, string>[] = [{}];
  for (const o of opts) {
    const next: Record<string, string>[] = [];
    for (const combo of acc) for (const v of o.values) next.push({ ...combo, [o.name]: v });
    acc = next;
  }
  return acc;
}

export const comboKey = (options: ProductOption[], combo: Record<string, string>) =>
  options.map((o) => `${o.name}=${combo[o.name] ?? ""}`).join("|");

export const variantLabel = (product: Product, v: Variant) =>
  product.options
    .map((o) => v.options[o.name])
    .filter(Boolean)
    .join(" / ") || "Default";

const skuPart = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 4) || "X";

let seq = 0;
const newId = () => `var_${Date.now().toString(36)}${(seq++).toString(36)}`;

export interface GeneratePlan {
  variants: Variant[];
  added: number;
  kept: number;
  removed: Variant[];
}

/**
 * Regenerates a product's variants from its options. Existing variants whose option combination
 * still exists are kept untouched (prices, stock and ids survive); new combinations inherit the
 * first variant's price/cost and get a derived SKU.
 */
export function planVariants(product: Product, options: ProductOption[]): GeneratePlan {
  const existing = new Map(product.variants.map((v) => [comboKey(options, v.options), v]));
  const template = product.variants[0];
  const base =
    product.variants[0]?.sku.split("-")[0] ?? skuPart(product.title) + product.id.slice(-3);
  const seen = new Set<string>();
  let added = 0;
  const variants = cartesian(options).map((combo) => {
    const key = comboKey(options, combo);
    seen.add(key);
    const hit = existing.get(key);
    if (hit) return hit.options === combo ? hit : { ...hit, options: combo };
    added += 1;
    return {
      id: newId(),
      sku: [base, ...options.map((o) => skuPart(combo[o.name] ?? ""))].join("-"),
      options: combo,
      price: template?.price ?? 0,
      compareAt: template?.compareAt ?? null,
      cost: template?.cost ?? null,
      stock: 0,
      status: "draft" as CatalogStatus,
    };
  });
  const removed = product.variants.filter((v) => !seen.has(comboKey(options, v.options)));
  return { variants, added, kept: variants.length - added, removed };
}

/* ------------------------------------------------------------------ */
/* Cell parsing and editing                                            */
/* ------------------------------------------------------------------ */

const NUMERIC = new Set(["price", "compareAt", "cost", "stock"]);
const NULLABLE = new Set(["compareAt", "cost"]);

/** Coerces user / clipboard text into the field's type. Unparseable numbers become NaN (flagged). */
export function coerce(field: CellEdit["field"], raw: unknown): unknown {
  if (!NUMERIC.has(field)) {
    if (field === "status") {
      const s = String(raw ?? "")
        .trim()
        .toLowerCase();
      return (STATUSES as string[]).includes(s) ? s : s || "draft";
    }
    return String(raw ?? "").trim();
  }
  if (typeof raw === "number") return raw;
  const s = String(raw ?? "")
    .replace(/[$€£,\s]/g, "")
    .trim();
  if (s === "") return NULLABLE.has(field) ? null : field === "stock" ? 0 : Number.NaN;
  const n = Number(s);
  return Number.isNaN(n) ? Number.NaN : n;
}

export interface RowIndex {
  products: Map<string, number>;
  variants: Map<string, [number, number]>;
}

export function indexCatalog(products: readonly Product[]): RowIndex {
  const idx: RowIndex = { products: new Map(), variants: new Map() };
  products.forEach((p, pi) => {
    idx.products.set(p.id, pi);
    p.variants.forEach((v, vi) => idx.variants.set(v.id, [pi, vi]));
  });
  return idx;
}

/** Applies cell edits to an immer draft. Unknown targets are ignored. */
export function applyEdits(draft: Draft<Product[]>, edits: CellEdit[], idx: RowIndex) {
  for (const e of edits) {
    const vPos = idx.variants.get(e.rowId);
    if (vPos) {
      if (e.field === "title") continue;
      const v = draft[vPos[0]]?.variants[vPos[1]];
      if (!v) continue;
      const value = coerce(e.field, e.value);
      if (!Object.is((v as Record<string, unknown>)[e.field], value))
        (v as Record<string, unknown>)[e.field] = value;
      continue;
    }
    const pi = idx.products.get(e.rowId);
    if (pi === undefined) continue;
    const p = draft[pi];
    if (!p) continue;
    if (e.field === "title") p.title = String(e.value ?? "");
    else if (e.field === "status") {
      const s = coerce("status", e.value) as CatalogStatus;
      p.status = s;
      // Archiving a product archives its variants too; other states leave them alone.
      if (s === "archived") for (const v of p.variants) v.status = "archived";
    }
  }
}

/* ------------------------------------------------------------------ */
/* Bulk price                                                          */
/* ------------------------------------------------------------------ */

export type BulkMode = "percent" | "fixed" | "set";
export type BulkRounding = "cents" | "whole" | "99";
export interface BulkPriceOptions {
  field: "price" | "compareAt" | "cost";
  mode: BulkMode;
  amount: number;
  rounding: BulkRounding;
}

export function bulkPrice(current: number | null, o: BulkPriceOptions): number | null {
  const base = current ?? (o.mode === "set" ? 0 : null);
  if (base === null) return null;
  let n =
    o.mode === "percent"
      ? base * (1 + o.amount / 100)
      : o.mode === "fixed"
        ? base + o.amount
        : o.amount;
  n = Math.max(0, n);
  if (o.rounding === "whole") return Math.round(n);
  if (o.rounding === "99") return Math.max(0.99, Math.floor(n) + 0.99);
  return Math.round(n * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Clipboard (Excel / Sheets use TSV with quoted multi-line cells)     */
/* ------------------------------------------------------------------ */

export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export const toTsv = (grid: string[][]) =>
  grid
    .map((r) => r.map((c) => (/[\t\n"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join("\t"))
    .join("\n");

/* ------------------------------------------------------------------ */
/* Validation (memoised per object identity, so edits re-validate O(1)) */
/* ------------------------------------------------------------------ */

export type FieldErrors = Partial<Record<string, string>>;
const vCache = new WeakMap<Variant, FieldErrors | null>();
const pCache = new WeakMap<Product, FieldErrors | null>();

export function variantErrors(v: Variant): FieldErrors | null {
  if (vCache.has(v)) return vCache.get(v) ?? null;
  const r = variantSchema.safeParse(v);
  let out: FieldErrors | null = null;
  if (!r.success) {
    out = {};
    for (const i of r.error.issues) {
      const k = String(i.path[0] ?? "sku");
      out[k] ??= i.message;
    }
  }
  vCache.set(v, out);
  return out;
}

export function productErrors(p: Product): FieldErrors | null {
  if (pCache.has(p)) return pCache.get(p) ?? null;
  const r = productSchema.safeParse(p);
  let out: FieldErrors | null = null;
  if (!r.success) {
    out = {};
    for (const i of r.error.issues) out[String(i.path[0])] ??= i.message;
  }
  pCache.set(p, out);
  return out;
}

/** Counts invalid cells and flags duplicate SKUs across the whole catalog. */
export function validateCatalog(products: readonly Product[]) {
  let errors = 0;
  const skus = new Map<string, number>();
  for (const p of products) {
    const pe = productErrors(p);
    if (pe) errors += Object.keys(pe).length;
    for (const v of p.variants) {
      const ve = variantErrors(v);
      if (ve) errors += Object.keys(ve).length;
      const k = v.sku.toUpperCase();
      skus.set(k, (skus.get(k) ?? 0) + 1);
    }
  }
  const dupes = new Set<string>();
  for (const [k, n] of skus) if (n > 1 && k) dupes.add(k);
  let dupeCells = 0;
  if (dupes.size)
    for (const p of products)
      for (const v of p.variants) if (dupes.has(v.sku.toUpperCase())) dupeCells++;
  return { errors: errors + dupeCells, dupes };
}

/* ------------------------------------------------------------------ */
/* Dirty diff against the last saved snapshot                          */
/* ------------------------------------------------------------------ */

const P_FIELDS = ["title", "status"] as const;
const V_FIELDS = ["sku", "price", "compareAt", "cost", "stock", "status"] as const;

export function diffCatalog(saved: readonly Product[], current: readonly Product[]) {
  const dirty = new Set<string>();
  const savedById = new Map(saved.map((p) => [p.id, p]));
  const updated: Product[] = [];
  const removedVariantIds: string[] = [];
  for (const p of current) {
    const s = savedById.get(p.id);
    if (s === p) continue; // structural sharing: untouched product
    let changed = false;
    if (!s) {
      changed = true;
      dirty.add(`${p.id}:title`);
    } else {
      for (const f of P_FIELDS)
        if (s[f] !== p[f]) {
          dirty.add(`${p.id}:${f}`);
          changed = true;
        }
      if (s.options !== p.options) changed = true;
    }
    const sv = new Map((s?.variants ?? []).map((v) => [v.id, v]));
    for (const v of p.variants) {
      const o = sv.get(v.id);
      sv.delete(v.id);
      if (o === v) continue;
      changed = true;
      for (const f of V_FIELDS) if (!o || !Object.is(o[f], v[f])) dirty.add(`${v.id}:${f}`);
    }
    for (const id of sv.keys()) {
      removedVariantIds.push(id);
      changed = true;
    }
    if (changed) updated.push(p);
  }
  const changes: CatalogChanges = { updated, removedVariantIds, changedCells: dirty.size };
  return { dirty, changes };
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

const rowCache = new WeakMap<Product, CatalogRow>();
/** Grid rows, cached per product object so unchanged products keep row identity. */
export function toRow(p: Product): CatalogRow {
  const hit = rowCache.get(p);
  if (hit) return hit;
  const row: CatalogRow = {
    kind: "product",
    id: p.id,
    product: p,
    subRows: p.variants.map((v) => ({ kind: "variant", id: v.id, product: p, variant: v })),
  };
  rowCache.set(p, row);
  return row;
}

export function matchesQuery(p: Product, q: string) {
  if (!q) return true;
  if (p.title.toLowerCase().includes(q) || p.vendor.toLowerCase().includes(q)) return true;
  return p.variants.some((v) => v.sku.toLowerCase().includes(q));
}
