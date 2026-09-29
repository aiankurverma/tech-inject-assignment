import { z } from "zod";

export type CatalogStatus = "active" | "draft" | "archived";

export interface ProductOption {
  /** e.g. "Color". Order defines the variant label order. */
  name: string;
  values: string[];
}

export interface Variant {
  id: string;
  sku: string;
  /** Option name -> value, e.g. { Color: "Black", Size: "M" }. */
  options: Record<string, string>;
  price: number;
  compareAt: number | null;
  cost: number | null;
  stock: number;
  status: CatalogStatus;
}

export interface Product {
  id: string;
  title: string;
  vendor: string;
  status: CatalogStatus;
  options: ProductOption[];
  variants: Variant[];
}

/** Grid row: a product with variant sub-rows, or a single variant. */
export type CatalogRow =
  | { kind: "product"; id: string; product: Product; subRows: CatalogRow[] }
  | { kind: "variant"; id: string; product: Product; variant: Variant };

export type ProductField = "title" | "status";
export type VariantField = "sku" | "price" | "compareAt" | "cost" | "stock" | "status";

/** One cell write. `rowId` is a product id (product fields) or a variant id. */
export interface CellEdit {
  rowId: string;
  field: ProductField | VariantField;
  value: unknown;
}

export interface CatalogChanges {
  updated: Product[];
  /** Variant ids removed by regeneration. */
  removedVariantIds: string[];
  changedCells: number;
}

export const STATUSES: CatalogStatus[] = ["active", "draft", "archived"];

const money = z
  .number({ invalid_type_error: "Must be a number" })
  .finite("Must be a number")
  .nonnegative("Cannot be negative")
  .max(1_000_000, "Too large")
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Max 2 decimals");

/** Per-variant validation; issues are keyed by field so the grid can mark cells. */
export const variantSchema = z
  .object({
    sku: z
      .string()
      .min(1, "SKU is required")
      .max(64, "Max 64 chars")
      .regex(/^[A-Z0-9][A-Z0-9._-]*$/i, "Letters, digits, . _ - only"),
    price: money,
    compareAt: money.nullable(),
    cost: money.nullable(),
    stock: z
      .number({ invalid_type_error: "Must be a whole number" })
      .int("Must be a whole number")
      .min(-9999, "Too low")
      .max(10_000_000, "Too large"),
    status: z.enum(["active", "draft", "archived"]),
  })
  .superRefine((v, ctx) => {
    if (v.compareAt != null && Number.isFinite(v.price) && v.compareAt <= v.price)
      ctx.addIssue({ code: "custom", path: ["compareAt"], message: "Must exceed price" });
    if (v.cost != null && Number.isFinite(v.price) && v.cost > v.price && v.status === "active")
      ctx.addIssue({
        code: "custom",
        path: ["cost"],
        message: "Cost above price (negative margin)",
      });
  });

export const productSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(140, "Max 140 chars"),
  status: z.enum(["active", "draft", "archived"]),
});
