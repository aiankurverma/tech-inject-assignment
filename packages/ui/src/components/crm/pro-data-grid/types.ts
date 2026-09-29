import * as React from "react";
import type { ZodType } from "zod";
import { z } from "zod";

/** How a column's values are parsed, compared, filtered, formatted and edited. */
export type GridColumnType =
  "text" | "number" | "currency" | "percent" | "date" | "enum" | "boolean";

/** Aggregates shown on group rows (and in the footer totals). */
export type GridAggregate = "sum" | "mean" | "min" | "max" | "count" | "uniqueCount";

export interface GridColumn<TData> {
  /** Stable id; also the key used in saved views and the URL. */
  id: string;
  header: string;
  /** Read the cell value. Defaults to `row[id]`. */
  accessor?: (row: TData) => unknown;
  /** Write an edited value; returns a new row. Defaults to `{ ...row, [id]: value }`. */
  setValue?: (row: TData, value: unknown) => TData;
  type?: GridColumnType;
  /** Allowed values for `enum` columns (faceted filter order and editor options). */
  options?: readonly string[];
  /** Initial width in px. */
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  /** Start pinned. */
  pinned?: "start" | "end";
  /** Start hidden (still available in the column menu). */
  hidden?: boolean;
  /** Allow inline editing. Requires `onCellEdit` or `onDataChange` to persist. */
  editable?: boolean | ((row: TData) => boolean);
  /** zod schema that validates (and coerces) an edited value before it is committed. */
  schema?: ZodType<unknown>;
  /** Aggregate for group rows and footer totals. */
  aggregate?: GridAggregate;
  /** Allow grouping by this column. Defaults to true for text, enum and boolean. */
  groupable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  /** ISO currency for `currency` columns. Defaults to the grid `currency`. */
  currency?: string;
  /** Custom cell renderer. Receives the raw value. */
  render?: (value: unknown, row: TData) => React.ReactNode;
  /** Plain text used for CSV export and search. Defaults to the formatted value. */
  toText?: (value: unknown, row: TData) => string;
  align?: "start" | "end" | "center";
}

/** Filter value per column type. */
export type GridFilterValue =
  | { kind: "text"; query: string }
  | { kind: "range"; min?: number; max?: number }
  | { kind: "set"; values: string[] }
  | { kind: "dateRange"; from?: string; to?: string };

/** Everything a user can change about the grid layout; serialisable to the URL. */
export interface GridView {
  sorting: { id: string; desc: boolean }[];
  filters: { id: string; value: GridFilterValue }[];
  search: string;
  hidden: string[];
  order: string[];
  pinning: { start: string[]; end: string[] };
  sizing: Record<string, number>;
  grouping: string[];
}

export interface SavedGridView {
  id: string;
  name: string;
  view: GridView;
  /** Built-in views cannot be deleted. */
  builtIn?: boolean;
}

export interface GridCellEdit<TData> {
  rowId: string;
  columnId: string;
  value: unknown;
  previous: unknown;
  row: TData;
}

const filterValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), query: z.string().max(200) }),
  z.object({ kind: z.literal("range"), min: z.number().optional(), max: z.number().optional() }),
  z.object({ kind: z.literal("set"), values: z.array(z.string().max(200)).max(200) }),
  z.object({
    kind: z.literal("dateRange"),
    from: z.string().max(40).optional(),
    to: z.string().max(40).optional(),
  }),
]);

/** Strict schema so a hand-edited or stale URL can never crash the grid. */
export const gridViewSchema = z.object({
  sorting: z
    .array(z.object({ id: z.string(), desc: z.boolean() }))
    .max(12)
    .default([]),
  filters: z
    .array(z.object({ id: z.string(), value: filterValueSchema }))
    .max(40)
    .default([]),
  search: z.string().max(200).default(""),
  hidden: z.array(z.string()).max(200).default([]),
  order: z.array(z.string()).max(200).default([]),
  pinning: z
    .object({ start: z.array(z.string()).max(50), end: z.array(z.string()).max(50) })
    .default({ start: [], end: [] }),
  sizing: z.record(z.number().min(40).max(2000)).default({}),
  grouping: z.array(z.string()).max(4).default([]),
});

export const EMPTY_VIEW: GridView = {
  sorting: [],
  filters: [],
  search: "",
  hidden: [],
  order: [],
  pinning: { start: [], end: [] },
  sizing: {},
  grouping: [],
};

/** The active cell used for keyboard navigation (indices into rendered rows / visible columns). */
export interface ActiveCell {
  row: number;
  col: number;
}
