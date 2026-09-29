/* ------------------------------------------------------------------------------------------------
 * Pivot aggregation engine (in-house: arquero is not on the allow-list, and no permissively
 * licensed, maintained React-19-era pivot engine exists that fits the bundle budget).
 *
 * One pass over the data. For every record we walk each prefix of its row path and each prefix of
 * its column path and fold the measures into an accumulator for that (rowPrefix, colPrefix) pair.
 * That gives leaf cells, every subtotal and the grand total in O(n * (R+1) * (C+1) * M) with no
 * second pass, where R/C are the row/column depths and M the number of measures.
 * ---------------------------------------------------------------------------------------------- */

export type PivotAggregator = "sum" | "avg" | "count" | "min" | "max" | "distinct";

export const AGGREGATOR_LABELS: Record<PivotAggregator, string> = {
  sum: "Sum",
  avg: "Average",
  count: "Count",
  min: "Min",
  max: "Max",
  distinct: "Distinct",
};

export interface PivotField<T> {
  key: string;
  label: string;
  /** Dimensions can go to rows / columns / filters; measures to values. Fields may be both. */
  kind: "dimension" | "measure" | "both";
  /** Defaults to row[key]. */
  accessor?: (row: T) => unknown;
  /** Formats aggregated numbers for this measure. */
  format?: (value: number) => string;
  /** Sort order for dimension members; defaults to natural string compare. */
  sort?: (a: string, b: string) => number;
}

export interface PivotValue {
  field: string;
  agg: PivotAggregator;
}

export interface PivotConfig {
  rows: string[];
  cols: string[];
  values: PivotValue[];
  /** field -> excluded members. */
  filters: Record<string, string[]>;
}

interface Acc {
  sum: number;
  count: number;
  min: number;
  max: number;
  set?: Set<unknown>;
}

const SEP = "\u0001";
export const TOTAL_KEY = "";

export interface PivotNode {
  /** Full key path joined by SEP; "" for the root. */
  key: string;
  label: string;
  depth: number;
  children: PivotNode[];
}

export interface PivotResult {
  rowTree: PivotNode;
  colTree: PivotNode;
  /** Aggregated value of measure `m` at (rowKey, colKey); null when there is no data. */
  value: (rowKey: string, colKey: string, m: number) => number | null;
  recordCount: number;
}

function newAcc(distinct: boolean): Acc {
  return { sum: 0, count: 0, min: Infinity, max: -Infinity, set: distinct ? new Set() : undefined };
}

function finalize(acc: Acc | undefined, agg: PivotAggregator): number | null {
  if (!acc || acc.count === 0) return null;
  switch (agg) {
    case "sum":
      return acc.sum;
    case "avg":
      return acc.sum / acc.count;
    case "count":
      return acc.count;
    case "min":
      return acc.min;
    case "max":
      return acc.max;
    case "distinct":
      return acc.set?.size ?? 0;
  }
}

const str = (v: unknown) => (v === null || v === undefined || v === "" ? "(blank)" : String(v));

export function memberValues<T>(data: readonly T[], field: PivotField<T>, limit = 500): string[] {
  const get = field.accessor ?? ((r: T) => (r as Record<string, unknown>)[field.key]);
  const set = new Set<string>();
  for (const r of data) {
    set.add(str(get(r)));
    if (set.size >= limit) break;
  }
  return [...set].sort(field.sort ?? naturalCompare);
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
export const naturalCompare = (a: string, b: string) => collator.compare(a, b);

export function computePivot<T>(
  data: readonly T[],
  fields: PivotField<T>[],
  config: PivotConfig,
): PivotResult {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const getter = (k: string) => {
    const f = byKey.get(k);
    return f?.accessor ?? ((r: T) => (r as Record<string, unknown>)[k]);
  };
  const rowGet = config.rows.map(getter);
  const colGet = config.cols.map(getter);
  const valGet = config.values.map((v) => getter(v.field));
  const distinctFlags = config.values.map((v) => v.agg === "distinct");
  const filterEntries = Object.entries(config.filters)
    .filter(([, ex]) => ex.length > 0)
    .map(([k, ex]) => [getter(k), new Set(ex)] as const);

  // rowKey -> colKey -> accumulators per measure
  const cells = new Map<string, Map<string, Acc[]>>();
  const rowChildren = new Map<string, Map<string, string>>(); // parentKey -> childKey -> label
  const colChildren = new Map<string, Map<string, string>>();
  const M = config.values.length;
  let recordCount = 0;

  const rowKeys: string[] = new Array(rowGet.length + 1);
  const colKeys: string[] = new Array(colGet.length + 1);
  const nums: unknown[] = new Array(M);

  outer: for (const rec of data) {
    for (const [get, excluded] of filterEntries) if (excluded.has(str(get(rec)))) continue outer;
    recordCount++;

    rowKeys[0] = TOTAL_KEY;
    for (let i = 0; i < rowGet.length; i++) {
      const label = str(rowGet[i]!(rec));
      const parent = rowKeys[i]!;
      const key = i === 0 ? label : parent + SEP + label;
      rowKeys[i + 1] = key;
      let ch = rowChildren.get(parent);
      if (!ch) rowChildren.set(parent, (ch = new Map()));
      if (!ch.has(key)) ch.set(key, label);
    }
    colKeys[0] = TOTAL_KEY;
    for (let i = 0; i < colGet.length; i++) {
      const label = str(colGet[i]!(rec));
      const parent = colKeys[i]!;
      const key = i === 0 ? label : parent + SEP + label;
      colKeys[i + 1] = key;
      let ch = colChildren.get(parent);
      if (!ch) colChildren.set(parent, (ch = new Map()));
      if (!ch.has(key)) ch.set(key, label);
    }
    for (let m = 0; m < M; m++) nums[m] = valGet[m]!(rec);

    for (let r = 0; r <= rowGet.length; r++) {
      let rowMap = cells.get(rowKeys[r]!);
      if (!rowMap) cells.set(rowKeys[r]!, (rowMap = new Map()));
      for (let c = 0; c <= colGet.length; c++) {
        let accs = rowMap.get(colKeys[c]!);
        if (!accs) {
          accs = new Array(M);
          for (let m = 0; m < M; m++) accs[m] = newAcc(distinctFlags[m]!);
          rowMap.set(colKeys[c]!, accs);
        }
        for (let m = 0; m < M; m++) {
          const raw = nums[m];
          const a = accs[m]!;
          if (a.set) {
            if (raw !== null && raw !== undefined && raw !== "") {
              a.set.add(raw);
              a.count++;
            }
            continue;
          }
          if (config.values[m]!.agg === "count") {
            if (raw !== null && raw !== undefined) a.count++;
            continue;
          }
          const n = typeof raw === "number" ? raw : Number(raw);
          if (raw === null || raw === undefined || raw === "" || Number.isNaN(n)) continue;
          a.sum += n;
          a.count++;
          if (n < a.min) a.min = n;
          if (n > a.max) a.max = n;
        }
      }
    }
  }

  const buildTree = (children: Map<string, Map<string, string>>, dims: string[]): PivotNode => {
    const make = (key: string, label: string, depth: number): PivotNode => {
      const ch = children.get(key);
      const sort = byKey.get(dims[depth] ?? "")?.sort ?? naturalCompare;
      const kids = ch
        ? [...ch.entries()].sort((a, b) => sort(a[1], b[1])).map(([k, l]) => make(k, l, depth + 1))
        : [];
      return { key, label, depth, children: kids };
    };
    return make(TOTAL_KEY, "Total", 0);
  };

  return {
    rowTree: buildTree(rowChildren, config.rows),
    colTree: buildTree(colChildren, config.cols),
    recordCount,
    value: (rowKey, colKey, m) =>
      finalize(cells.get(rowKey)?.get(colKey)?.[m], config.values[m]!.agg),
  };
}

/* ---------------------------------- Flattening for render ------------------------------------ */

export interface VisibleRow {
  key: string;
  label: string;
  /** 1-based depth; 0 is the grand-total row. */
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  isTotal: boolean;
}

/** Depth-first flatten of the row tree honouring expansion; grand total appended last. */
export function flattenRows(
  tree: PivotNode,
  isExpanded: (key: string) => boolean,
  showGrandTotal: boolean,
): VisibleRow[] {
  const out: VisibleRow[] = [];
  const walk = (n: PivotNode) => {
    for (const c of n.children) {
      const expanded = c.children.length > 0 && isExpanded(c.key);
      out.push({
        key: c.key,
        label: c.label,
        depth: c.depth,
        hasChildren: c.children.length > 0,
        expanded,
        isTotal: false,
      });
      if (expanded) walk(c);
    }
  };
  walk(tree);
  if (showGrandTotal || tree.children.length === 0)
    out.push({
      key: TOTAL_KEY,
      label: "Grand total",
      depth: 0,
      hasChildren: false,
      expanded: false,
      isTotal: true,
    });
  return out;
}

export interface VisibleCol {
  key: string;
  /** Labels from the top dimension down to this node. */
  path: string[];
  node: PivotNode;
  collapsed: boolean;
  isTotal: boolean;
}

/** Visible column leaves: expanded nodes are replaced by their children, collapsed nodes stay as subtotals. */
export function visibleCols(
  tree: PivotNode,
  isCollapsed: (key: string) => boolean,
  showGrandTotal: boolean,
): VisibleCol[] {
  const out: VisibleCol[] = [];
  const walk = (n: PivotNode, path: string[]) => {
    for (const c of n.children) {
      const p = [...path, c.label];
      if (c.children.length > 0 && !isCollapsed(c.key)) walk(c, p);
      else
        out.push({
          key: c.key,
          path: p,
          node: c,
          collapsed: c.children.length > 0,
          isTotal: false,
        });
    }
  };
  walk(tree, []);
  if (showGrandTotal || tree.children.length === 0)
    out.push({ key: TOTAL_KEY, path: ["Total"], node: tree, collapsed: false, isTotal: true });
  return out;
}

export const splitKey = (key: string) => (key === TOTAL_KEY ? [] : key.split(SEP));
export const joinKey = (parts: string[]) => parts.join(SEP);

/* ---------------------------------- CSV export ---------------------------------------------- */

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function pivotToCsv(
  result: PivotResult,
  rows: VisibleRow[],
  cols: VisibleCol[],
  config: PivotConfig,
  fieldLabel: (key: string) => string,
): string {
  const rowHeader = config.rows.map(fieldLabel).join(" / ") || "Rows";
  const header = [rowHeader];
  for (const c of cols)
    for (const v of config.values)
      header.push(`${c.path.join(" / ")} - ${AGGREGATOR_LABELS[v.agg]} of ${fieldLabel(v.field)}`);
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    const line = [r.isTotal ? "Grand total" : splitKey(r.key).join(" / ")];
    for (const c of cols)
      for (let m = 0; m < config.values.length; m++) {
        const v = result.value(r.key, c.key, m);
        line.push(v === null ? "" : String(Math.round(v * 1e6) / 1e6));
      }
    lines.push(line.map(csvCell).join(","));
  }
  return lines.join("\r\n");
}
