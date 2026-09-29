import * as React from "react";
import {
  ArrowLeftRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  Flame,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computePivot,
  flattenRows,
  memberValues,
  pivotToCsv,
  visibleCols,
  type PivotConfig,
  type PivotField,
} from "@/lib/pro-pivot";
import { usePivotConfig } from "@/hooks/use-pivot-config";
import { FieldShelves } from "@/components/crm/pro-pivot-table/field-shelves";
import { PivotGrid } from "@/components/crm/pro-pivot-table/pivot-grid";

export type { PivotAggregator, PivotConfig, PivotField, PivotValue } from "@/lib/pro-pivot";
export { computePivot } from "@/lib/pro-pivot";

export interface ProPivotTableProps<T> {
  data: readonly T[];
  fields: PivotField<T>[];
  /** Controlled layout. */
  config?: PivotConfig;
  defaultConfig?: PivotConfig;
  onConfigChange?: (config: PivotConfig) => void;
  loading?: boolean;
  error?: React.ReactNode;
  /** Show the field shelves (drag fields into rows / columns / values / filters). */
  showShelves?: boolean;
  showGrandTotals?: boolean;
  defaultHeatmap?: boolean;
  /** Row levels expanded initially (1 = only top level visible expanded). */
  defaultExpandDepth?: number;
  height?: number | string;
  rowHeaderWidth?: number;
  cellWidth?: number;
  rowHeight?: number;
  csvFileName?: string;
  className?: string;
}

const EMPTY_CONFIG: PivotConfig = { rows: [], cols: [], values: [], filters: {} };
const fmtNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Drag-and-drop pivot table: in-house aggregation engine, TanStack Table headers, TanStack Virtual output. */
export function ProPivotTable<T>({
  data,
  fields,
  config: configProp,
  defaultConfig = EMPTY_CONFIG,
  onConfigChange,
  loading,
  error,
  showShelves = true,
  showGrandTotals = true,
  defaultHeatmap = false,
  defaultExpandDepth = 1,
  height = 520,
  rowHeaderWidth = 240,
  cellWidth = 132,
  rowHeight = 32,
  csvFileName = "pivot.csv",
  className,
}: ProPivotTableProps<T>) {
  const [layout, dispatch] = usePivotConfig(configProp, defaultConfig, onConfigChange);
  const [heatmap, setHeatmap] = React.useState(defaultHeatmap);
  // Expansion is stored as a diff against the default depth so new members follow the default.
  const [rowToggles, setRowToggles] = React.useState<Set<string>>(() => new Set());
  const [colToggles, setColToggles] = React.useState<Set<string>>(() => new Set());

  const byKey = React.useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const fieldLabel = React.useCallback((k: string) => byKey.get(k)?.label ?? k, [byKey]);

  // Aggregate off the urgent path so shelf drags stay responsive on 100k+ rows.
  const deferredLayout = React.useDeferredValue(layout);
  const deferredData = React.useDeferredValue(data);
  const stale = deferredLayout !== layout || deferredData !== data;
  const config = React.useMemo<PivotConfig>(
    () => ({
      rows: deferredLayout.rows,
      cols: deferredLayout.cols,
      values: deferredLayout.values,
      filters: deferredLayout.filters,
    }),
    [deferredLayout],
  );
  const result = React.useMemo(
    () => computePivot(deferredData, fields, config),
    [deferredData, fields, config],
  );

  // Reset toggles when the axis dimensions change (keys no longer mean the same thing).
  const rowSig = config.rows.join("|");
  const colSig = config.cols.join("|");
  React.useEffect(() => setRowToggles(new Set()), [rowSig]);
  React.useEffect(() => setColToggles(new Set()), [colSig]);

  const rows = React.useMemo(
    () =>
      flattenRows(
        result.rowTree,
        (key) => {
          const depth = key.split("\u0001").length;
          return depth < defaultExpandDepth ? !rowToggles.has(key) : rowToggles.has(key);
        },
        showGrandTotals,
      ),
    [result.rowTree, rowToggles, defaultExpandDepth, showGrandTotals],
  );
  const cols = React.useMemo(
    () =>
      visibleCols(
        result.colTree,
        (key) => colToggles.has(key),
        showGrandTotals && config.cols.length > 0,
      ),
    [result.colTree, colToggles, showGrandTotals, config.cols.length],
  );

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => (key: string) =>
    set((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const onToggleRow = React.useMemo(() => toggle(setRowToggles), []);
  const onToggleCol = React.useMemo(() => toggle(setColToggles), []);

  const expandAll = (expand: boolean) => {
    const keys = new Set<string>();
    const walk = (n: typeof result.rowTree) => {
      for (const c of n.children) {
        if (c.children.length === 0) continue;
        const depth = c.key.split("\u0001").length;
        const defaultOpen = depth < defaultExpandDepth;
        if (expand !== defaultOpen) keys.add(c.key);
        walk(c);
      }
    };
    walk(result.rowTree);
    setRowToggles(keys);
  };

  const membersCache = React.useRef(new Map<string, string[]>());
  React.useEffect(() => membersCache.current.clear(), [data]);
  const getMembers = React.useCallback(
    (key: string) => {
      const f = byKey.get(key);
      if (!f) return [];
      let m = membersCache.current.get(key);
      if (!m) membersCache.current.set(key, (m = memberValues(data, f)));
      return m;
    },
    [byKey, data],
  );

  const formatValue = React.useCallback(
    (v: number, m: number) => {
      const vd = config.values[m];
      if (!vd) return fmtNumber.format(v);
      if (vd.agg === "count" || vd.agg === "distinct") return v.toLocaleString("en-US");
      const f = byKey.get(vd.field)?.format;
      return f ? f(v) : fmtNumber.format(v);
    },
    [config.values, byKey],
  );

  const exportCsv = () => {
    const csv = pivotToCsv(result, rows, cols, config, fieldLabel);
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFileName;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const toolBtn =
    "inline-flex h-[30px] items-center gap-1.5 rounded-full px-2.5 text-xs text-crm-muted-fg outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-40";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-3 text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      {showShelves && (
        <FieldShelves
          fields={fields}
          layout={layout}
          dispatch={dispatch}
          getMembers={getMembers}
          disabled={loading}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs text-crm-muted-fg" aria-live="polite">
          {(stale || loading) && (
            <Loader2 className="size-3.5 animate-spin" aria-label="Updating" />
          )}
          <span className="tabular-nums">
            {result.recordCount.toLocaleString()} of {data.length.toLocaleString()} records ·{" "}
            {rows.length.toLocaleString()} rows ×{" "}
            {(cols.length * Math.max(1, config.values.length)).toLocaleString()} columns
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className={toolBtn}
            onClick={() => expandAll(true)}
            disabled={config.rows.length < 2}
          >
            <ChevronsUpDown className="size-3.5" /> Expand all
          </button>
          <button
            type="button"
            className={toolBtn}
            onClick={() => expandAll(false)}
            disabled={config.rows.length < 2}
          >
            <ChevronsDownUp className="size-3.5" /> Collapse all
          </button>
          <button type="button" className={toolBtn} onClick={() => dispatch({ type: "swapAxes" })}>
            <ArrowLeftRight className="size-3.5" /> Swap axes
          </button>
          <button
            type="button"
            className={cn(toolBtn, heatmap && "bg-crm-primary/15 text-crm-fg")}
            aria-pressed={heatmap}
            onClick={() => setHeatmap((h) => !h)}
          >
            <Flame className="size-3.5" /> Heatmap
          </button>
          <button
            type="button"
            className={toolBtn}
            onClick={exportCsv}
            disabled={config.values.length === 0 || rows.length === 0}
          >
            <Download className="size-3.5" /> CSV
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="grid place-items-center rounded-crm border border-crm-danger/40 bg-crm-danger/10 px-4 py-10 text-center text-xs text-crm-danger"
          style={{ height }}
        >
          {error}
        </div>
      ) : loading && data.length === 0 ? (
        <div
          className="flex flex-col gap-1.5 rounded-crm border border-crm-border p-3"
          style={{ height }}
          aria-busy="true"
        >
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="h-6 animate-pulse rounded bg-crm-muted/60"
              style={{ width: `${90 - (i % 4) * 12}%` }}
            />
          ))}
        </div>
      ) : (
        <PivotGrid
          result={result}
          rows={rows}
          cols={cols}
          config={config}
          fieldLabel={fieldLabel}
          formatValue={formatValue}
          onToggleRow={onToggleRow}
          onToggleCol={onToggleCol}
          heatmap={heatmap}
          rowHeaderWidth={rowHeaderWidth}
          cellWidth={cellWidth}
          rowHeight={rowHeight}
          height={height}
        />
      )}
    </div>
  );
}
