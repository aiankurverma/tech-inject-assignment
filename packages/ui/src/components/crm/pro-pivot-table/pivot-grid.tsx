import * as React from "react";
import {
  columnSizingFeature,
  createColumnHelper,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AGGREGATOR_LABELS,
  joinKey,
  splitKey,
  type PivotConfig,
  type PivotResult,
  type VisibleCol,
  type VisibleRow,
} from "@/lib/pro-pivot";

const features = tableFeatures({ columnSizingFeature });
type Features = typeof features;
const helper = createColumnHelper<Features, VisibleRow>();

interface LeafMeta {
  colIndex: number;
  measure: number;
}

export interface PivotGridProps {
  result: PivotResult;
  rows: VisibleRow[];
  cols: VisibleCol[];
  config: PivotConfig;
  fieldLabel: (key: string) => string;
  formatValue: (value: number, measure: number) => string;
  onToggleRow: (key: string) => void;
  onToggleCol: (key: string) => void;
  heatmap: boolean;
  rowHeaderWidth: number;
  cellWidth: number;
  rowHeight: number;
  height: number | string;
}

/** Virtualised (rows + columns) pivot grid; TanStack Table builds the multi-level column headers. */
export function PivotGrid({
  result,
  rows,
  cols,
  config,
  fieldLabel,
  formatValue,
  onToggleRow,
  onToggleCol,
  heatmap,
  rowHeaderWidth,
  cellWidth,
  rowHeight,
  height,
}: PivotGridProps) {
  const M = config.values.length;
  const measureLabels = React.useMemo(
    () => config.values.map((v) => `${AGGREGATOR_LABELS[v.agg]} of ${fieldLabel(v.field)}`),
    [config.values, fieldLabel],
  );

  // Column defs: nested groups per column-dimension level, one leaf per (visible column, measure).
  const { columns, leafMeta, groupKeys } = React.useMemo(() => {
    const meta = new Map<string, LeafMeta>();
    const groups = new Map<string, string>();
    const leavesFor = (col: VisibleCol, ci: number) =>
      Array.from({ length: Math.max(M, 1) }, (_, m) => {
        const id = `c${ci}m${m}`;
        meta.set(id, { colIndex: ci, measure: m });
        return helper.display({
          id,
          header: M > 1 || cols.length === 1 ? (measureLabels[m] ?? "Value") : col.path.at(-1),
          size: cellWidth,
        });
      });
    // Group leaves by shared path prefixes so TanStack computes the colSpans.
    type Node = {
      id?: string;
      label: string;
      key: string;
      children: Node[];
      leaves: ColumnDef<Features, VisibleRow>[];
    };
    const root: Node = { label: "", key: "", children: [], leaves: [] };
    cols.forEach((c, ci) => {
      let node = root;
      const depth = M > 1 || cols.length === 1 ? c.path.length : c.path.length - 1;
      for (let d = 0; d < depth; d++) {
        const k = `${node.key}/${c.path[d]}`;
        const last = node.children.at(-1);
        let child = last && last.key === k && last.leaves.length === 0 ? last : undefined;
        if (!child) {
          node.children.push((child = { label: c.path[d]!, key: k, children: [], leaves: [] }));
          child!.id = `g${ci}${k}`;
          groups.set(child!.id, joinKey(splitKey(c.node.key).slice(0, d + 1)));
        }
        node = child!;
      }
      node.children.push({ label: "", key: `leaf${ci}`, children: [], leaves: leavesFor(c, ci) });
    });
    const toDefs = (n: Node): ColumnDef<Features, VisibleRow>[] =>
      n.children.flatMap((c) =>
        c.leaves.length
          ? c.leaves
          : [helper.group({ id: c.id ?? c.key, header: c.label, columns: toDefs(c) })],
      );
    const defs: ColumnDef<Features, VisibleRow>[] = [
      helper.display({
        id: "__row",
        header: config.rows.map(fieldLabel).join(" / ") || "Rows",
        size: rowHeaderWidth,
      }),
      ...toDefs(root),
    ];
    return { columns: defs, leafMeta: meta, groupKeys: groups };
  }, [cols, M, measureLabels, cellWidth, rowHeaderWidth, config.rows, fieldLabel]);

  const table = useTable({ features, columns, data: rows, getRowId: (r) => r.key || "__total" });
  const headerGroups = table.getHeaderGroups();
  const leafHeaders =
    headerGroups[headerGroups.length - 1]?.headers.filter((h) => h.column.id !== "__row") ?? [];

  // Heatmap scale per measure over visible, non-total cells.
  const scale = React.useMemo(() => {
    if (!heatmap) return null;
    const min = new Array<number>(M).fill(Infinity);
    const max = new Array<number>(M).fill(-Infinity);
    for (const r of rows) {
      if (r.isTotal || r.expanded) continue;
      for (const c of cols) {
        if (c.isTotal) continue;
        for (let m = 0; m < M; m++) {
          const v = result.value(r.key, c.key, m);
          if (v === null) continue;
          if (v < min[m]!) min[m] = v;
          if (v > max[m]!) max[m] = v;
        }
      }
    }
    return { min, max };
  }, [heatmap, rows, cols, M, result]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const rowV = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });
  const colV = useVirtualizer({
    horizontal: true,
    count: leafHeaders.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => cellWidth,
    overscan: 4,
  });

  const headerH = headerGroups.length * 30;
  const totalWidth = rowHeaderWidth + leafHeaders.length * cellWidth;
  const vCols = colV.getVirtualItems();
  const firstX = vCols[0]?.start ?? 0;
  const lastX = (vCols.at(-1)?.end ?? 0) + 0;

  // Keyboard navigation (roving active cell) for the treegrid.
  const [active, setActive] = React.useState<{ r: number; c: number }>({ r: 0, c: -1 });
  const onKeyDown = (e: React.KeyboardEvent) => {
    let { r, c } = active;
    const row = rows[r];
    switch (e.key) {
      case "ArrowDown":
        r = Math.min(rows.length - 1, r + 1);
        break;
      case "ArrowUp":
        r = Math.max(0, r - 1);
        break;
      case "ArrowRight":
        if (c === -1 && row?.hasChildren && !row.expanded) {
          onToggleRow(row.key);
          e.preventDefault();
          return;
        }
        c = Math.min(leafHeaders.length - 1, c + 1);
        break;
      case "ArrowLeft":
        if (c === -1 && row?.expanded) {
          onToggleRow(row.key);
          e.preventDefault();
          return;
        }
        c = Math.max(-1, c - 1);
        break;
      case "Home":
        c = -1;
        if (e.ctrlKey) r = 0;
        break;
      case "End":
        c = leafHeaders.length - 1;
        if (e.ctrlKey) r = rows.length - 1;
        break;
      case "PageDown":
        r = Math.min(rows.length - 1, r + Math.floor(scrollRef.current!.clientHeight / rowHeight));
        break;
      case "PageUp":
        r = Math.max(0, r - Math.floor(scrollRef.current!.clientHeight / rowHeight));
        break;
      case "Enter":
      case " ":
        if (c === -1 && row?.hasChildren) onToggleRow(row.key);
        e.preventDefault();
        return;
      default:
        return;
    }
    e.preventDefault();
    setActive({ r, c });
    rowV.scrollToIndex(r);
    if (c >= 0) colV.scrollToIndex(c);
  };
  const activeId = (r: number, c: number) => `pv-${r}-${c}`;

  if (rows.length === 0 || M === 0) {
    return (
      <div
        className="grid place-items-center rounded-crm border border-dashed border-crm-border px-4 py-12 text-center text-xs text-crm-subtle"
        style={{ height }}
      >
        {M === 0
          ? "Drag a measure into Values to see numbers."
          : "No records match the current filters."}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      role="treegrid"
      aria-label="Pivot table"
      aria-rowcount={rows.length + headerGroups.length}
      aria-colcount={leafHeaders.length + 1}
      aria-activedescendant={activeId(active.r, active.c)}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="relative overflow-auto rounded-crm border border-crm-border bg-crm-bg text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
      style={{ height }}
    >
      <div
        style={{ width: totalWidth, height: headerH + rowV.getTotalSize(), position: "relative" }}
      >
        {/* Header */}
        <div
          role="rowgroup"
          className="sticky top-0 z-20 bg-crm-card"
          style={{ height: headerH, width: totalWidth }}
        >
          {headerGroups.map((g, gi) => (
            <div
              key={g.id}
              role="row"
              aria-rowindex={gi + 1}
              className="absolute inset-x-0"
              style={{ top: gi * 30, height: 30 }}
            >
              {g.headers.map((h) => {
                if (h.column.id === "__row") {
                  return gi === headerGroups.length - 1 ? (
                    <div
                      key={h.id}
                      role="columnheader"
                      className="sticky left-0 z-10 flex h-full items-center border-r border-b border-crm-border bg-crm-card px-3 font-medium text-crm-muted-fg"
                      style={{ width: rowHeaderWidth, top: 0 }}
                    >
                      <span className="truncate">{String(h.column.columnDef.header)}</span>
                    </div>
                  ) : (
                    <div
                      key={h.id}
                      className="sticky left-0 z-10 h-full border-r border-crm-border bg-crm-card"
                      style={{ width: rowHeaderWidth }}
                    />
                  );
                }
                const start = h.getStart();
                const size = h.getSize();
                const left = start - rowHeaderWidth;
                if (left + size < firstX || left > lastX) return null;
                const leafIds = h.getLeafHeaders().map((l) => l.column.id);
                const firstLeaf = leafMeta.get(leafIds[0] ?? "");
                const col = firstLeaf ? cols[firstLeaf.colIndex] : undefined;
                const isGroup = h.subHeaders.length > 0;
                const groupKey = groupKeys.get(h.column.id);
                const collapsible = isGroup && !h.isPlaceholder && groupKey !== undefined;
                // Group header key = prefix of the first leaf's path at this depth.
                const leafCollapsed = !isGroup && col?.collapsed && M === 1 && cols.length > 1;
                return (
                  <div
                    key={h.id}
                    role="columnheader"
                    aria-colspan={h.colSpan}
                    className={cn(
                      "absolute top-0 flex h-full items-center gap-1 border-r border-b border-crm-border px-2 text-crm-soft",
                      isGroup ? "justify-center font-medium text-crm-fg" : "justify-end",
                      col?.isTotal && "bg-crm-muted/40 font-medium",
                    )}
                    style={{ left: start, width: size }}
                  >
                    {collapsible && (
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`Collapse ${String(h.column.columnDef.header)}`}
                        onClick={() => onToggleCol(groupKey!)}
                        className="grid size-4 place-items-center rounded-sm text-crm-subtle hover:bg-crm-muted hover:text-crm-fg"
                      >
                        <Minus className="size-3" />
                      </button>
                    )}
                    {leafCollapsed && (
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`Expand ${col!.path.at(-1)}`}
                        onClick={() => onToggleCol(col!.key)}
                        className="grid size-4 place-items-center rounded-sm text-crm-subtle hover:bg-crm-muted hover:text-crm-fg"
                      >
                        <Plus className="size-3" />
                      </button>
                    )}
                    <span className="truncate" title={String(h.column.columnDef.header ?? "")}>
                      {h.isPlaceholder ? "" : String(h.column.columnDef.header ?? "")}
                    </span>
                    {!isGroup && M > 1 && col?.collapsed && (
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`Expand ${col.path.at(-1)}`}
                        onClick={() => onToggleCol(col.key)}
                        className="grid size-4 shrink-0 place-items-center rounded-sm text-crm-subtle hover:bg-crm-muted"
                      >
                        <Plus className="size-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Body */}
        <div role="rowgroup">
          {rowV.getVirtualItems().map((vr) => {
            const row = rows[vr.index]!;
            return (
              <div
                key={row.key || "__total"}
                role="row"
                aria-rowindex={headerGroups.length + vr.index + 1}
                aria-level={row.isTotal ? 1 : row.depth}
                aria-expanded={row.hasChildren ? row.expanded : undefined}
                className={cn(
                  "absolute left-0",
                  row.isTotal ? "font-semibold" : row.expanded && "font-medium",
                )}
                style={{ top: headerH + vr.start, height: rowHeight, width: totalWidth }}
              >
                <div
                  id={activeId(vr.index, -1)}
                  role="rowheader"
                  className={cn(
                    "sticky left-0 z-10 flex h-full items-center gap-1 border-r border-b border-crm-border bg-crm-card pr-2 text-crm-fg",
                    row.isTotal && "border-t bg-crm-muted",
                    active.r === vr.index &&
                      active.c === -1 &&
                      "ring-2 ring-inset ring-crm-primary",
                  )}
                  style={{
                    width: rowHeaderWidth,
                    paddingLeft: 8 + Math.max(0, row.depth - 1) * 16,
                  }}
                >
                  {row.hasChildren ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={row.expanded ? `Collapse ${row.label}` : `Expand ${row.label}`}
                      onClick={() => onToggleRow(row.key)}
                      className="grid size-4 shrink-0 place-items-center rounded-sm text-crm-subtle hover:bg-crm-muted hover:text-crm-fg"
                    >
                      <ChevronRight
                        className={cn("size-3 transition-transform", row.expanded && "rotate-90")}
                      />
                    </button>
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <span className="truncate" title={row.label}>
                    {row.label}
                  </span>
                </div>
                {vCols.map((vc) => {
                  const lm = leafMeta.get(leafHeaders[vc.index]?.column.id ?? "");
                  if (!lm) return null;
                  const col = cols[lm.colIndex]!;
                  const v = result.value(row.key, col.key, lm.measure);
                  let bg: string | undefined;
                  if (scale && v !== null && !row.isTotal && !col.isTotal && !row.expanded) {
                    const lo = scale.min[lm.measure]!;
                    const hi = scale.max[lm.measure]!;
                    const t = hi > lo ? (v - lo) / (hi - lo) : 0;
                    bg = `color-mix(in oklab, var(--color-crm-primary) ${Math.round(8 + t * 62)}%, transparent)`;
                  }
                  return (
                    <div
                      key={vc.key}
                      id={activeId(vr.index, vc.index)}
                      role="gridcell"
                      aria-colindex={vc.index + 2}
                      className={cn(
                        "absolute top-0 flex h-full items-center justify-end border-r border-b border-crm-border px-2 tabular-nums",
                        v === null ? "text-crm-faint" : "text-crm-fg",
                        (row.isTotal || col.isTotal) && "bg-crm-muted/60",
                        row.expanded && !row.isTotal && "bg-crm-card/60",
                        active.r === vr.index &&
                          active.c === vc.index &&
                          "ring-2 ring-inset ring-crm-primary",
                      )}
                      style={{ left: rowHeaderWidth + vc.start, width: vc.size, background: bg }}
                    >
                      {v === null ? "-" : formatValue(v, lm.measure)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
