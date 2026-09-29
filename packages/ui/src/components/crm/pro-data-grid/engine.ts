import {
  aggregationFn_count,
  aggregationFn_max,
  aggregationFn_mean,
  aggregationFn_min,
  aggregationFn_sum,
  aggregationFn_uniqueCount,
  columnFacetingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  constructFilterFn,
  constructSortFn,
  createExpandedRowModel,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createGroupedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowAggregationFeature,
  rowExpandingFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import type {
  GridColumn,
  GridColumnType,
  GridFilterValue,
} from "@/components/crm/pro-data-grid/types";

/* ------------------------------------------------------------------ values */

export function toTime(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string" && value) {
    const t = Date.parse(value);
    return Number.isNaN(t) ? NaN : t;
  }
  return NaN;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
function numberFormat(key: string, make: () => Intl.NumberFormat) {
  let f = numberFormats.get(key);
  if (!f) {
    f = make();
    numberFormats.set(key, f);
  }
  return f;
}
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Human text for a value; used by cells, CSV export and search. */
export function formatValue(type: GridColumnType, value: unknown, currency = "USD"): string {
  if (value === null || value === undefined || value === "") return "";
  switch (type) {
    case "number":
      return typeof value === "number"
        ? numberFormat("n", () => new Intl.NumberFormat("en-US")).format(value)
        : String(value);
    case "currency":
      return typeof value === "number"
        ? numberFormat(
            `c:${currency}`,
            () =>
              new Intl.NumberFormat("en-US", {
                style: "currency",
                currency,
                maximumFractionDigits: 0,
              }),
          ).format(value)
        : String(value);
    case "percent":
      return typeof value === "number"
        ? numberFormat(
            "p",
            () => new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }),
          ).format(value)
        : String(value);
    case "date": {
      const t = toTime(value);
      return Number.isNaN(t) ? String(value) : dateFormat.format(t);
    }
    case "boolean":
      return value ? "Yes" : "No";
    default:
      return String(value);
  }
}

export const isNumeric = (type: GridColumnType | undefined) =>
  type === "number" || type === "currency" || type === "percent";

export function readCell<TData>(column: GridColumn<TData>, row: TData): unknown {
  return column.accessor
    ? column.accessor(row)
    : (row as Record<string, unknown>)[column.id as keyof TData & string];
}

/* ----------------------------------------------------------------- filters */

export function isEmptyFilter(value: GridFilterValue | undefined): boolean {
  if (!value) return true;
  switch (value.kind) {
    case "text":
      return !value.query.trim();
    case "range":
      return value.min === undefined && value.max === undefined;
    case "set":
      return value.values.length === 0;
    case "dateRange":
      return !value.from && !value.to;
  }
}

/** One filter function interprets every GridFilterValue kind. */
const gridFilter = constructFilterFn({
  filter: (dataValue: unknown, filter: GridFilterValue) => {
    switch (filter.kind) {
      case "text":
        return String(dataValue ?? "")
          .toLowerCase()
          .includes(filter.query.trim().toLowerCase());
      case "range": {
        if (typeof dataValue !== "number") return false;
        if (filter.min !== undefined && dataValue < filter.min) return false;
        if (filter.max !== undefined && dataValue > filter.max) return false;
        return true;
      }
      case "set":
        return filter.values.includes(String(dataValue ?? ""));
      case "dateRange": {
        const t = toTime(dataValue);
        if (Number.isNaN(t)) return false;
        if (filter.from && t < toTime(filter.from)) return false;
        if (filter.to && t > toTime(filter.to) + 86_399_999) return false;
        return true;
      }
    }
  },
  autoRemove: (v: GridFilterValue | undefined) => isEmptyFilter(v),
});

/** Global search: case-insensitive substring over the raw value (numbers included). */
const searchFilter = constructFilterFn({
  filter: (dataValue: unknown, query: string) =>
    dataValue !== null &&
    dataValue !== undefined &&
    String(dataValue).toLowerCase().includes(query),
  resolveFilterValue: (q: unknown) =>
    String(q ?? "")
      .trim()
      .toLowerCase(),
  autoRemove: (q: unknown) => !String(q ?? "").trim(),
});

const dateSort = constructSortFn({
  sort: (a: unknown, b: unknown) => {
    const ta = toTime(a);
    const tb = toTime(b);
    if (Number.isNaN(ta)) return Number.isNaN(tb) ? 0 : 1;
    if (Number.isNaN(tb)) return -1;
    return ta === tb ? 0 : ta > tb ? 1 : -1;
  },
});

/* ---------------------------------------------------------------- features */

export interface GridColumnMeta {
  spec: GridColumn<never>;
}

/** Registered once at module scope so the table models are never rebuilt needlessly. */
export const gridFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  columnFacetingFeature,
  rowSortingFeature,
  columnGroupingFeature,
  rowAggregationFeature,
  rowExpandingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  groupedRowModel: createGroupedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  filterFns: { grid: gridFilter, search: searchFilter },
  sortFns: { basic: sortFn_basic, text: sortFn_text, date: dateSort },
  aggregationFns: {
    sum: aggregationFn_sum,
    mean: aggregationFn_mean,
    min: aggregationFn_min,
    max: aggregationFn_max,
    count: aggregationFn_count,
    uniqueCount: aggregationFn_uniqueCount,
  },
  columnMeta: {} as GridColumnMeta,
});

export type GridFeatures = typeof gridFeatures;

/** GridColumn specs -> TanStack column definitions. */
export function buildColumnDefs<TData extends RowData>(
  columns: readonly GridColumn<TData>[],
): ColumnDef<GridFeatures, TData, unknown>[] {
  return columns.map((spec) => {
    const type = spec.type ?? "text";
    const groupable = spec.groupable ?? (type === "text" || type === "enum" || type === "boolean");
    const def: ColumnDef<GridFeatures, TData, unknown> = {
      id: spec.id,
      header: spec.header,
      accessorFn: (row: TData) => readCell(spec, row),
      size: spec.width ?? (isNumeric(type) ? 130 : type === "date" ? 130 : 170),
      minSize: spec.minWidth ?? 64,
      maxSize: spec.maxWidth ?? 800,
      enableSorting: spec.sortable ?? true,
      enableColumnFilter: spec.filterable ?? true,
      enableGlobalFilter: type !== "boolean",
      enableGrouping: groupable,
      filterFn: "grid",
      sortFn: isNumeric(type) || type === "boolean" ? "basic" : type === "date" ? "date" : "text",
      sortUndefined: "last",
      aggregationFn: spec.aggregate,
      meta: { spec: spec as unknown as GridColumn<never> },
    };
    return def;
  });
}

/* --------------------------------------------------------------------- csv */

function csvField(text: string): string {
  // Neutralise spreadsheet formula injection (=, +, -, @, tab, CR) per OWASP guidance.
  const safe = /^[=+\-@\t\r]/.test(text) && !/^-?\d/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: string[][]): string {
  const lines = [header.map(csvField).join(",")];
  for (const r of rows) lines.push(r.map(csvField).join(","));
  return lines.join("\r\n");
}

export function downloadText(fileName: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿", text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
