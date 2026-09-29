import {
  createExpandedRowModel,
  rowExpandingFeature,
  rowSelectionFeature,
  tableFeatures,
} from "@tanstack/react-table";
import { variantLabel } from "@/components/crm/pro-catalog-manager/catalog";
import type { CatalogRow, CellEdit } from "@/components/crm/pro-catalog-manager/types";

export interface GridColumn {
  id: string;
  header: string;
  width: number;
  align?: "right";
  /** Field written for variant rows (undefined = read-only on variants). */
  variantField?: CellEdit["field"];
  /** Field written for product rows. */
  productField?: CellEdit["field"];
  kind: "text" | "money" | "int" | "status" | "computed";
}

export const GRID_COLUMNS: GridColumn[] = [
  { id: "title", header: "Product / variant", width: 300, productField: "title", kind: "text" },
  { id: "sku", header: "SKU", width: 170, variantField: "sku", kind: "text" },
  {
    id: "price",
    header: "Price",
    width: 110,
    align: "right",
    variantField: "price",
    kind: "money",
  },
  {
    id: "compareAt",
    header: "Compare at",
    width: 110,
    align: "right",
    variantField: "compareAt",
    kind: "money",
  },
  { id: "cost", header: "Cost", width: 100, align: "right", variantField: "cost", kind: "money" },
  { id: "margin", header: "Margin", width: 84, align: "right", kind: "computed" },
  { id: "stock", header: "Stock", width: 90, align: "right", variantField: "stock", kind: "int" },
  {
    id: "status",
    header: "Status",
    width: 116,
    variantField: "status",
    productField: "status",
    kind: "status",
  },
];

export const fieldFor = (row: CatalogRow, col: GridColumn) =>
  row.kind === "product" ? col.productField : col.variantField;

const money = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const int = new Intl.NumberFormat();

/** Raw editable value as text (used by the editor, copy and fill). */
export function rawValue(row: CatalogRow, col: GridColumn): string {
  if (row.kind === "product") {
    if (col.id === "title") return row.product.title;
    if (col.id === "status") return row.product.status;
    return displayValue(row, col);
  }
  const v = row.variant;
  switch (col.id) {
    case "title":
      return variantLabel(row.product, v);
    case "margin":
      return displayValue(row, col);
    default: {
      const val = v[col.id as keyof typeof v];
      return val == null ? "" : Number.isNaN(val) ? "" : String(val);
    }
  }
}

export function displayValue(row: CatalogRow, col: GridColumn): string {
  if (row.kind === "product") {
    const vs = row.product.variants;
    switch (col.id) {
      case "title":
        return row.product.title;
      case "sku":
        return `${vs.length} variant${vs.length === 1 ? "" : "s"}`;
      case "price": {
        if (!vs.length) return "—";
        let lo = Infinity;
        let hi = -Infinity;
        for (const v of vs)
          if (Number.isFinite(v.price)) {
            lo = Math.min(lo, v.price);
            hi = Math.max(hi, v.price);
          }
        if (!Number.isFinite(lo)) return "—";
        return lo === hi ? money.format(lo) : `${money.format(lo)}–${money.format(hi)}`;
      }
      case "stock":
        return int.format(vs.reduce((a, v) => a + (Number.isFinite(v.stock) ? v.stock : 0), 0));
      case "status":
        return row.product.status;
      default:
        return "";
    }
  }
  const v = row.variant;
  switch (col.id) {
    case "title":
      return variantLabel(row.product, v);
    case "sku":
    case "status":
      return v[col.id];
    case "price":
    case "compareAt":
    case "cost": {
      const n = v[col.id];
      return n == null ? "" : Number.isNaN(n) ? "#VALUE" : money.format(n);
    }
    case "stock":
      return Number.isNaN(v.stock) ? "#VALUE" : int.format(v.stock);
    case "margin":
      return v.cost != null && v.price > 0 && Number.isFinite(v.cost)
        ? `${Math.round(((v.price - v.cost) / v.price) * 100)}%`
        : "—";
    default:
      return "";
  }
}

/** TanStack Table features used by the catalog (expandable variant sub-rows + row selection). */
export const tableFeatureSet = tableFeatures({
  rowExpandingFeature,
  rowSelectionFeature,
  expandedRowModel: createExpandedRowModel(),
});
