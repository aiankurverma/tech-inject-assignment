import * as React from "react";
import { useTable, type Row, type RowData, type Updater } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useHotkeys } from "react-hotkeys-hook";
import { AlertTriangle, Inbox, RotateCcw, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildColumnDefs,
  downloadText,
  formatValue,
  gridFeatures,
  isNumeric,
  toCsv,
  type GridFeatures,
} from "@/components/crm/pro-data-grid/engine";
import { fromDraft, toDraft, type EditMove } from "@/components/crm/pro-data-grid/cells";
import type { GridColumnInstance } from "@/components/crm/pro-data-grid/filters";
import { HeaderCell, type GridHeader } from "@/components/crm/pro-data-grid/header-cell";
import { Toolbar, toolbarButton } from "@/components/crm/pro-data-grid/toolbar";
import {
  GridRow,
  type ColumnLayout,
  type EditingState,
} from "@/components/crm/pro-data-grid/grid-body";
import {
  EMPTY_VIEW,
  type ActiveCell,
  type GridCellEdit,
  type GridColumn,
  type GridFilterValue,
  type GridView,
  type SavedGridView,
} from "@/components/crm/pro-data-grid/types";

export type {
  GridColumn,
  GridView,
  SavedGridView,
  GridCellEdit,
  GridFilterValue,
} from "@/components/crm/pro-data-grid/types";
export { EMPTY_VIEW, gridViewSchema } from "@/components/crm/pro-data-grid/types";

export interface ProDataGridProps<TData extends RowData> {
  data: readonly TData[];
  columns: readonly GridColumn<TData>[];
  /** Stable row identity (required for editing and keyboard focus across sorts). */
  getRowId: (row: TData, index: number) => string;
  /** Controlled layout (sort, filters, columns, grouping). Pair with `onViewChange`. */
  view?: GridView;
  /** Initial layout when uncontrolled. */
  defaultView?: Partial<GridView>;
  onViewChange?: (view: GridView) => void;
  /** Controlled saved views. */
  savedViews?: SavedGridView[];
  /** Initial saved views when uncontrolled. */
  defaultSavedViews?: SavedGridView[];
  onSavedViewsChange?: (views: SavedGridView[]) => void;
  /** Called after an edit passes the column's zod schema. Throw or reject to surface an error. */
  onCellEdit?: (edit: GridCellEdit<TData>) => void | Promise<void>;
  /** Receives the next data array after a validated edit (uncontrolled data use). */
  onDataChange?: (data: TData[]) => void;
  readOnly?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Row height in px. */
  rowHeight?: number;
  /** Grid viewport height (px or CSS length). */
  height?: number | string;
  currency?: string;
  exportFileName?: string;
  /** Accessible name for the grid. */
  label?: string;
  /** Extra toolbar content (right side). */
  toolbarActions?: React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
}

const HEADER_H = 36;

function viewFrom(partial?: Partial<GridView>): GridView {
  return { ...EMPTY_VIEW, ...partial, pinning: { ...EMPTY_VIEW.pinning, ...partial?.pinning } };
}

function resolve<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
}

function sameView(a: GridView, b: GridView) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function leafRows<TData extends RowData>(
  rows: Row<GridFeatures, TData>[],
): Row<GridFeatures, TData>[] {
  const out: Row<GridFeatures, TData>[] = [];
  for (const r of rows) {
    if (r.getIsGrouped()) {
      for (const l of r.getLeafRows()) if (!l.getIsGrouped()) out.push(l);
    } else out.push(r);
  }
  return out;
}

function aggregate(kind: GridColumn<unknown>["aggregate"], values: unknown[]): unknown {
  if (kind === "count") return values.length;
  if (kind === "uniqueCount") return new Set(values).size;
  const nums = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (!nums.length) return null;
  if (kind === "sum" || kind === "mean") {
    let s = 0;
    for (const n of nums) s += n;
    return kind === "sum" ? s : s / nums.length;
  }
  let m = nums[0]!;
  for (const n of nums) m = kind === "min" ? Math.min(m, n) : Math.max(m, n);
  return m;
}

/**
 * Spreadsheet-grade data grid: TanStack Table for the row models (filter, sort, group, aggregate,
 * facets, pin, order, size, visibility) and TanStack Virtual for 2-D virtualisation. Adds a
 * WAI-ARIA grid keyboard model, zod-validated inline editing, saved views and CSV export.
 */
export function ProDataGrid<TData extends RowData>({
  data,
  columns,
  getRowId,
  view: viewProp,
  defaultView,
  onViewChange,
  savedViews: savedProp,
  defaultSavedViews,
  onSavedViewsChange,
  onCellEdit,
  onDataChange,
  readOnly = false,
  loading = false,
  error = null,
  onRetry,
  rowHeight = 36,
  height = 560,
  currency = "USD",
  exportFileName = "export",
  label = "Data grid",
  toolbarActions,
  emptyState,
  className,
}: ProDataGridProps<TData>) {
  /* ------------------------------------------------------------ view state */
  const [innerView, setInnerView] = React.useState(() => viewFrom(defaultView));
  const view = viewProp ?? innerView;
  const viewRef = React.useRef(view);
  viewRef.current = view;
  const setView = React.useCallback(
    (next: GridView) => {
      if (viewProp === undefined) setInnerView(next);
      onViewChange?.(next);
    },
    [viewProp, onViewChange],
  );
  const patch = React.useCallback(
    <K extends keyof GridView>(key: K, updater: Updater<GridView[K]>) => {
      const cur = viewRef.current;
      const next = { ...cur, [key]: resolve(updater, cur[key]) };
      viewRef.current = next;
      setView(next);
    },
    [setView],
  );

  const [innerSaved, setInnerSaved] = React.useState<SavedGridView[]>(defaultSavedViews ?? []);
  const saved = savedProp ?? innerSaved;
  const setSaved = (next: SavedGridView[]) => {
    if (savedProp === undefined) setInnerSaved(next);
    onSavedViewsChange?.(next);
  };
  const activeViewId = React.useMemo(
    () => saved.find((s) => sameView(viewFrom(s.view), view))?.id ?? null,
    [saved, view],
  );

  /* ------------------------------------------------------------------ data */
  const [localData, setLocalData] = React.useState(data);
  React.useEffect(() => setLocalData(data), [data]);

  const columnDefs = React.useMemo(() => buildColumnDefs(columns), [columns]);
  const specById = React.useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  // Column defaults (hidden / pinned) seed the uncontrolled view once.
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (seeded.current || viewProp !== undefined) return;
    seeded.current = true;
    const hidden = columns.filter((c) => c.hidden).map((c) => c.id);
    const start = columns.filter((c) => c.pinned === "start").map((c) => c.id);
    const end = columns.filter((c) => c.pinned === "end").map((c) => c.id);
    if (!defaultView?.hidden && hidden.length) patch("hidden", hidden);
    if (!defaultView?.pinning && (start.length || end.length)) patch("pinning", { start, end });
  }, [columns, defaultView, patch, viewProp]);

  const state = React.useMemo(
    () => ({
      sorting: view.sorting,
      columnFilters: view.filters,
      globalFilter: view.search,
      columnVisibility: Object.fromEntries(view.hidden.map((id) => [id, false])),
      columnOrder: view.order,
      columnPinning: view.pinning,
      columnSizing: view.sizing,
      grouping: view.grouping,
    }),
    [view],
  );

  const table = useTable({
    features: gridFeatures,
    data: localData as TData[],
    columns: columnDefs,
    getRowId: (row, i) => getRowId(row, i),
    state,
    initialState: { expanded: {} },
    onSortingChange: (u) => patch("sorting", u),
    onColumnFiltersChange: (u) =>
      patch("filters", (prev) => resolve(u, prev) as { id: string; value: GridFilterValue }[]),
    onGlobalFilterChange: (u) => patch("search", (prev) => String(resolve(u, prev) ?? "")),
    onColumnVisibilityChange: (u) =>
      patch("hidden", (prev) => {
        const vis = resolve(u, Object.fromEntries(prev.map((id) => [id, false])));
        return Object.entries(vis)
          .filter(([, v]) => v === false)
          .map(([k]) => k);
      }),
    onColumnOrderChange: (u) => patch("order", u),
    onColumnPinningChange: (u) =>
      patch("pinning", (prev) => {
        const n = resolve(u, prev);
        return { start: n.start ?? [], end: n.end ?? [] };
      }),
    onColumnSizingChange: (u) => patch("sizing", u),
    onGroupingChange: (u) => patch("grouping", u),
    globalFilterFn: "search",
    columnResizeMode: "onChange",
    groupedColumnMode: false,
    enableMultiSort: true,
    isMultiSortEvent: (e) => (e as MouseEvent).shiftKey,
    autoResetExpanded: false,
  });

  const rows = table.getRowModel().rows as Row<GridFeatures, TData>[];
  const allColumns = table.getAllLeafColumns() as GridColumnInstance[];

  /* --------------------------------------------------------------- columns */
  const startCols = table.getStartVisibleLeafColumns() as GridColumnInstance[];
  const centerCols = table.getCenterVisibleLeafColumns() as GridColumnInstance[];
  const endCols = table.getEndVisibleLeafColumns() as GridColumnInstance[];
  const visible = React.useMemo(
    () => [...startCols, ...centerCols, ...endCols],
    [startCols, centerCols, endCols],
  );
  const layouts = React.useMemo(() => {
    const make = (cols: GridColumnInstance[], pinned: ColumnLayout["pinned"], base: number) =>
      cols.map((column, i) => ({
        column,
        index: base + i,
        width: column.getSize(),
        pinned,
        offset: 0,
      }));
    const s = make(startCols, "start", 0);
    const c = make(centerCols, false, s.length);
    const e = make(endCols, "end", s.length + c.length);
    let acc = 0;
    for (const l of s) {
      l.offset = acc;
      acc += l.width;
    }
    acc = 0;
    for (let i = e.length - 1; i >= 0; i--) {
      e[i]!.offset = acc;
      acc += e[i]!.width;
    }
    return { s, c, e };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCols, centerCols, endCols, view.sizing]);
  const startWidth = layouts.s.reduce((a, l) => a + l.width, 0);
  const endWidth = layouts.e.reduce((a, l) => a + l.width, 0);
  const totalWidth = startWidth + endWidth + layouts.c.reduce((a, l) => a + l.width, 0);

  /* ---------------------------------------------------------- virtualisers */
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const rowV = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    getItemKey: (i) => rows[i]?.id ?? i,
    overscan: 10,
    scrollPaddingStart: HEADER_H,
    initialRect: { width: 1200, height: 560 },
  });
  const colV = useVirtualizer({
    horizontal: true,
    count: layouts.c.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => layouts.c[i]?.width ?? 150,
    getItemKey: (i) => layouts.c[i]?.column.id ?? i,
    overscan: 3,
    scrollPaddingStart: startWidth,
    scrollPaddingEnd: endWidth,
    initialRect: { width: 1200, height: 560 },
  });
  React.useEffect(() => colV.measure(), [layouts, colV]);
  const vCols = colV.getVirtualItems();
  const centerWindow = vCols
    .map((v) => layouts.c[v.index])
    .filter((l): l is ColumnLayout => l !== undefined);
  const padStart = vCols[0]?.start ?? 0;
  const centerTotal = colV.getTotalSize();
  const padEnd = vCols.length ? centerTotal - vCols[vCols.length - 1]!.end : centerTotal;

  /* ------------------------------------------------------ active cell / nav */
  const gridId = React.useId().replace(/:/g, "");
  const cellId = React.useCallback(
    (r: number, c: number) => `${gridId}-${r < 0 ? "h" : r}-${c}`,
    [gridId],
  );
  const [active, setActive] = React.useState<ActiveCell>({ row: 0, col: 0 });
  const [editing, setEditing] = React.useState<EditingState | null>(null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState("");
  const gridRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const clamp = React.useCallback(
    (cell: ActiveCell): ActiveCell => ({
      row: Math.max(-1, Math.min(rows.length - 1, cell.row)),
      col: Math.max(0, Math.min(visible.length - 1, cell.col)),
    }),
    [rows.length, visible.length],
  );
  const focusCell = React.useCallback(
    (cell: ActiveCell) => {
      const next = clamp(cell);
      setActive(next);
      if (next.row >= 0) rowV.scrollToIndex(next.row, { align: "auto" });
      const layout = [...layouts.s, ...layouts.c, ...layouts.e][next.col];
      if (layout && !layout.pinned)
        colV.scrollToIndex(next.col - layouts.s.length, { align: "auto" });
    },
    [clamp, rowV, colV, layouts],
  );
  // Keep the active cell inside the grid when rows / columns shrink.
  React.useEffect(() => {
    setActive((a) => {
      const c = clamp(a);
      return c.row === a.row && c.col === a.col ? a : c;
    });
  }, [clamp]);

  const canEdit = React.useCallback(
    (row: Row<GridFeatures, RowData>, column: GridColumnInstance) => {
      if (readOnly) return false;
      const spec = specById.get(column.id);
      if (!spec?.editable) return false;
      return typeof spec.editable === "function" ? spec.editable(row.original as TData) : true;
    },
    [readOnly, specById],
  );

  const startEdit = (cell: ActiveCell, initial?: string) => {
    const row = rows[cell.row];
    const column = visible[cell.col];
    if (!row || !column || row.getIsGrouped()) return;
    if (!canEdit(row as Row<GridFeatures, RowData>, column)) {
      setStatus(`${column.columnDef.meta?.spec.header ?? column.id} is read-only`);
      return;
    }
    const spec = specById.get(column.id)!;
    setEditing({
      rowId: row.id,
      columnId: column.id,
      draft: initial ?? toDraft(spec.type, row.getValue(column.id)),
      error: null,
    });
  };

  const commit = async (move: EditMove) => {
    if (!editing) return;
    const spec = specById.get(editing.columnId);
    const row = table.getRow(editing.rowId, true) as Row<GridFeatures, TData> | undefined;
    if (!spec || !row) return setEditing(null);
    const raw = fromDraft(spec.type, editing.draft);
    let value: unknown = raw;
    if (spec.schema) {
      const parsed = spec.schema.safeParse(raw);
      if (!parsed.success) {
        if (move === "none") return setEditing(null); // blur discards an invalid draft
        setEditing({ ...editing, error: parsed.error.issues[0]?.message ?? "Invalid value" });
        return;
      }
      value = parsed.data;
    } else if (isNumeric(spec.type) && typeof raw === "string") {
      setEditing({ ...editing, error: "Enter a number" });
      return;
    }
    const previous = row.getValue(spec.id);
    setEditing(null);
    const next = spec.setValue
      ? spec.setValue(row.original, value)
      : ({ ...row.original, [spec.id]: value } as TData);
    if (!Object.is(previous, value)) {
      const idx = localData.indexOf(row.original);
      const nextData = localData.slice();
      if (idx >= 0) nextData[idx] = next;
      setLocalData(nextData);
      try {
        await onCellEdit?.({ rowId: row.id, columnId: spec.id, value, previous, row: next });
        onDataChange?.(nextData);
        setStatus(`Saved ${spec.header}: ${formatValue(spec.type ?? "text", value, currency)}`);
      } catch (err) {
        setLocalData(localData); // roll back optimistic edit
        setStatus(`Could not save ${spec.header}: ${err instanceof Error ? err.message : "error"}`);
      }
    }
    if (move !== "none") {
      const d = { down: [1, 0], up: [-1, 0], right: [0, 1], left: [0, -1] }[move];
      focusCell({ row: active.row + d[0]!, col: active.col + d[1]! });
    }
    gridRef.current?.focus({ preventScroll: true });
  };

  const moveColumn = (columnId: string, delta: number) => {
    const order = view.order.length ? [...view.order] : allColumns.map((c) => c.id);
    for (const c of allColumns) if (!order.includes(c.id)) order.push(c.id);
    const i = order.indexOf(columnId);
    const j = Math.max(0, Math.min(order.length - 1, i + delta));
    if (i < 0 || i === j) return;
    order.splice(j, 0, ...order.splice(i, 1));
    patch("order", order);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing || e.target !== gridRef.current) return;
    const { row, col } = active;
    const page = Math.max(
      1,
      Math.floor(((scrollRef.current?.clientHeight ?? 400) - HEADER_H) / rowHeight) - 1,
    );
    const mod = e.ctrlKey || e.metaKey;
    const column = visible[col];
    const r = rows[row];
    let handled = true;
    switch (e.key) {
      case "ArrowDown":
        focusCell({ row: mod ? rows.length - 1 : row + 1, col });
        break;
      case "ArrowUp":
        focusCell({ row: mod ? -1 : row - 1, col });
        break;
      case "ArrowRight":
        if (row < 0 && mod && e.shiftKey && column) moveColumn(column.id, 1);
        else if (r?.getIsGrouped() && col === 0 && !r.getIsExpanded()) r.toggleExpanded(true);
        else focusCell({ row, col: mod ? visible.length - 1 : col + 1 });
        break;
      case "ArrowLeft":
        if (row < 0 && mod && e.shiftKey && column) moveColumn(column.id, -1);
        else if (r?.getIsGrouped() && col === 0 && r.getIsExpanded()) r.toggleExpanded(false);
        else focusCell({ row, col: mod ? 0 : col - 1 });
        break;
      case "Home":
        focusCell({ row: mod ? 0 : row, col: 0 });
        break;
      case "End":
        focusCell({ row: mod ? rows.length - 1 : row, col: visible.length - 1 });
        break;
      case "PageDown":
        focusCell({ row: row + page, col });
        break;
      case "PageUp":
        focusCell({ row: Math.max(0, row - page), col });
        break;
      case "Enter":
      case "F2":
        if (row < 0 && column?.getCanSort()) column.toggleSorting(undefined, e.shiftKey);
        else if (r?.getIsGrouped()) r.toggleExpanded();
        else startEdit(active);
        break;
      case " ":
        if (r?.getIsGrouped()) r.toggleExpanded();
        else handled = false;
        break;
      case "Delete":
      case "Backspace":
        if (row >= 0) startEdit(active, "");
        break;
      default:
        if (row < 0 && e.altKey && e.key === "ArrowDown" && column) setMenuFor(column.id);
        else if (row >= 0 && e.key.length === 1 && !mod && !e.altKey) startEdit(active, e.key);
        else handled = false;
    }
    if (handled) e.preventDefault();
  };

  /* ------------------------------------------------------------ drag reorder */
  const [drag, setDrag] = React.useState<{
    from: string;
    over: string;
    side: "before" | "after";
  } | null>(null);
  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    setDrag({ from: id, over: id, side: "before" });
  };
  const onDragOver = (e: React.DragEvent, id: string) => {
    if (!drag) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const side = e.clientX - rect.left < rect.width / 2 ? "before" : "after";
    if (drag.over !== id || drag.side !== side) setDrag({ ...drag, over: id, side });
  };
  const onDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!drag || drag.from === id) return setDrag(null);
    const order = (view.order.length ? [...view.order] : allColumns.map((c) => c.id)).filter(
      (x) => x !== drag.from,
    );
    for (const c of allColumns) if (c.id !== drag.from && !order.includes(c.id)) order.push(c.id);
    const at = order.indexOf(id) + (drag.side === "after" ? 1 : 0);
    order.splice(at, 0, drag.from);
    patch("order", order);
    // Dropping into another pinned section moves the column into that section.
    const target = table.getColumn(id)?.getIsPinned() ?? false;
    const source = table.getColumn(drag.from)?.getIsPinned() ?? false;
    if (target !== source) table.getColumn(drag.from)?.pin(target);
    setDrag(null);
  };

  /* ---------------------------------------------------------------- export */
  const exportCsv = React.useCallback(() => {
    const cols = visible;
    const flat = leafRows(table.getSortedRowModel().rows as Row<GridFeatures, TData>[]);
    const body = flat.map((r) =>
      cols.map((c) => {
        const spec = c.columnDef.meta!.spec as unknown as GridColumn<TData>;
        const v = r.getValue(c.id);
        return spec.toText
          ? spec.toText(v, r.original)
          : formatValue(spec.type ?? "text", v, spec.currency ?? currency);
      }),
    );
    downloadText(
      `${exportFileName}.csv`,
      toCsv(
        cols.map((c) => c.columnDef.meta!.spec.header),
        body,
      ),
    );
    setStatus(`Exported ${body.length.toLocaleString()} rows`);
  }, [visible, table, exportFileName, currency]);

  useHotkeys(
    "mod+shift+e",
    (e) => {
      e.preventDefault();
      exportCsv();
    },
    { enableOnFormTags: true },
    [exportCsv],
  );
  useHotkeys(
    "/",
    (e) => {
      e.preventDefault();
      searchRef.current?.focus();
    },
    [],
  );

  /* ---------------------------------------------------------------- totals */
  const filteredRows = table.getFilteredRowModel().rows;
  const totals = React.useMemo(() => {
    const out = new Map<string, unknown>();
    for (const spec of columns) {
      if (!spec.aggregate) continue;
      out.set(
        spec.id,
        aggregate(
          spec.aggregate,
          filteredRows.map((r) => r.getValue(spec.id)),
        ),
      );
    }
    return out;
  }, [columns, filteredRows]);
  const hasTotals = totals.size > 0;

  /* ---------------------------------------------------------------- render */
  const sortLevels = view.sorting.length;
  const isEmpty = !loading && !error && data.length === 0;
  const noResults = !loading && !error && data.length > 0 && rows.length === 0;
  const activeId =
    active.row < rows.length && visible[active.col] ? cellId(active.row, active.col) : undefined;

  const renderHeader = (l: ColumnLayout) => {
    const header = table.getFlatHeaders().find((h) => h.column.id === l.column.id);
    if (!header) return null;
    return (
      <HeaderCell
        key={l.column.id}
        header={header as GridHeader}
        domId={cellId(-1, l.index)}
        colIndex={l.index}
        active={active.row === -1 && active.col === l.index}
        menuOpen={menuFor === l.column.id}
        onMenuOpenChange={(o) => setMenuFor(o ? l.column.id : null)}
        dropSide={drag && drag.over === l.column.id && drag.from !== l.column.id ? drag.side : null}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={() => setDrag(null)}
        onActivate={() => setActive({ row: -1, col: l.index })}
        sortLevels={sortLevels}
        style={{
          width: l.width,
          ...(l.pinned === "start" ? { position: "sticky", left: l.offset } : null),
          ...(l.pinned === "end" ? { position: "sticky", right: l.offset } : null),
        }}
      />
    );
  };

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <Toolbar
        search={view.search}
        onSearchChange={(s) => patch("search", s)}
        searchRef={searchRef}
        columns={allColumns}
        grouping={view.grouping}
        views={saved}
        activeViewId={activeViewId}
        onApplyView={(v) => setView(viewFrom(v.view))}
        onSaveView={(name) =>
          setSaved([
            ...saved,
            { id: `v-${Date.now().toString(36)}`, name, view: JSON.parse(JSON.stringify(view)) },
          ])
        }
        onDeleteView={(id) => setSaved(saved.filter((v) => v.id !== id))}
        onResetLayout={() => setView(viewFrom(defaultView))}
        onExport={exportCsv}
        exportDisabled={loading || rows.length === 0}
      >
        {toolbarActions}
      </Toolbar>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          style={{ height }}
          className="overflow-auto overscroll-contain [contain:strict]"
        >
          <div
            ref={gridRef}
            role={view.grouping.length ? "treegrid" : "grid"}
            aria-label={label}
            aria-rowcount={loading ? -1 : rows.length + 1}
            aria-colcount={visible.length}
            aria-multiselectable={false}
            aria-busy={loading || undefined}
            aria-activedescendant={editing ? undefined : activeId}
            tabIndex={0}
            onKeyDown={onKeyDown}
            style={{ width: Math.max(totalWidth, 1), minWidth: "100%" }}
            className="relative outline-none focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:ring-inset"
          >
            <div role="rowgroup" className="sticky top-0 z-[6]">
              <div
                role="row"
                aria-rowindex={1}
                className="flex"
                style={{ height: HEADER_H, width: totalWidth }}
              >
                {layouts.s.map(renderHeader)}
                {padStart > 0 && (
                  <div
                    aria-hidden
                    style={{ width: padStart }}
                    className="shrink-0 border-b border-crm-border bg-crm-card"
                  />
                )}
                {centerWindow.map(renderHeader)}
                {padEnd > 0 && (
                  <div
                    aria-hidden
                    style={{ width: padEnd }}
                    className="shrink-0 border-b border-crm-border bg-crm-card"
                  />
                )}
                {layouts.e.map(renderHeader)}
              </div>
            </div>

            <div
              role="rowgroup"
              className="relative"
              style={{ height: loading ? rowHeight * 10 : rowV.getTotalSize() }}
            >
              {loading
                ? Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={i}
                      className="flex border-b border-crm-border"
                      style={{ height: rowHeight }}
                      aria-hidden
                    >
                      {visible.slice(0, 12).map((c) => (
                        <div
                          key={c.id}
                          className="flex shrink-0 items-center px-2"
                          style={{ width: c.getSize() }}
                        >
                          <span className="h-3 w-2/3 animate-pulse rounded bg-crm-muted" />
                        </div>
                      ))}
                    </div>
                  ))
                : rowV.getVirtualItems().map((item) => {
                    const row = rows[item.index];
                    if (!row) return null;
                    const rowActive = active.row === item.index ? active.col : null;
                    const rowEditing = editing?.rowId === row.id ? editing : null;
                    return (
                      <GridRow
                        key={row.id}
                        row={row as Row<GridFeatures, RowData>}
                        rowIndex={item.index}
                        item={item}
                        start={layouts.s}
                        center={centerWindow}
                        end={layouts.e}
                        padStart={padStart}
                        padEnd={padEnd}
                        totalWidth={totalWidth}
                        activeCol={rowActive}
                        editing={rowEditing}
                        cellId={cellId}
                        currency={currency}
                        canEdit={canEdit}
                        onCellMouseDown={(c) => {
                          if (editing) return;
                          setActive(c);
                        }}
                        onCellDoubleClick={(c) => startEdit(c)}
                        onDraftChange={(draft) =>
                          setEditing((s) => (s ? { ...s, draft, error: null } : s))
                        }
                        onCommit={(m) => void commit(m)}
                        onCancel={() => {
                          setEditing(null);
                          gridRef.current?.focus({ preventScroll: true });
                        }}
                      />
                    );
                  })}
            </div>

            {hasTotals && !loading && rows.length > 0 && (
              <div role="rowgroup" className="sticky bottom-0 z-[6]">
                <div
                  role="row"
                  className="flex border-t border-crm-border bg-crm-raised text-sm font-medium"
                  style={{ height: rowHeight, width: totalWidth }}
                >
                  {[
                    ...layouts.s,
                    { pad: padStart } as const,
                    ...centerWindow,
                    { pad: padEnd } as const,
                    ...layouts.e,
                  ].map((l, i) => {
                    if ("pad" in l)
                      return l.pad > 0 ? (
                        <div
                          key={`p${i}`}
                          aria-hidden
                          style={{ width: l.pad }}
                          className="shrink-0"
                        />
                      ) : null;
                    const spec = l.column.columnDef.meta!.spec;
                    const t = totals.get(l.column.id);
                    return (
                      <div
                        key={l.column.id}
                        role="gridcell"
                        style={{
                          width: l.width,
                          ...(l.pinned === "start" ? { position: "sticky", left: l.offset } : null),
                          ...(l.pinned === "end" ? { position: "sticky", right: l.offset } : null),
                        }}
                        className={cn(
                          "flex shrink-0 items-center truncate border-r border-crm-border bg-crm-raised px-2 text-crm-soft",
                          isNumeric(spec.type) && "justify-end tabular-nums",
                        )}
                      >
                        {l.index === 0
                          ? "Total"
                          : t === undefined
                            ? ""
                            : spec.aggregate === "count" || spec.aggregate === "uniqueCount"
                              ? Number(t).toLocaleString()
                              : formatValue(spec.type ?? "text", t, spec.currency ?? currency)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {(error || isEmpty || noResults) && (
          <div className="absolute inset-x-0 top-9 bottom-0 grid place-items-center p-6">
            <div
              className="flex max-w-sm flex-col items-center gap-2 text-center"
              role={error ? "alert" : "status"}
            >
              {error ? (
                <>
                  <AlertTriangle className="size-6 text-crm-danger" aria-hidden />
                  <p className="text-sm font-medium">Couldn’t load rows</p>
                  <p className="text-sm text-crm-muted-fg">{error}</p>
                  {onRetry && (
                    <button type="button" className={toolbarButton} onClick={onRetry}>
                      <RotateCcw className="size-4" aria-hidden /> Retry
                    </button>
                  )}
                </>
              ) : isEmpty ? (
                (emptyState ?? (
                  <>
                    <Inbox className="size-6 text-crm-muted-fg" aria-hidden />
                    <p className="text-sm font-medium">No records yet</p>
                  </>
                ))
              ) : (
                <>
                  <SearchX className="size-6 text-crm-muted-fg" aria-hidden />
                  <p className="text-sm font-medium">No rows match</p>
                  <button
                    type="button"
                    className={toolbarButton}
                    onClick={() => setView({ ...view, filters: [], search: "" })}
                  >
                    Clear filters and search
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-crm-border px-3 py-1.5 text-xs text-crm-muted-fg">
        <span className="tabular-nums">
          {loading
            ? "Loading…"
            : `${filteredRows.length.toLocaleString()} of ${data.length.toLocaleString()} rows${
                view.grouping.length
                  ? ` · ${rows.filter((r) => r.getIsGrouped()).length.toLocaleString()} groups shown`
                  : ""
              }`}
        </span>
        <span className="hidden truncate sm:inline">
          Arrows move · Enter edits · Shift+click multi-sort · Ctrl+Shift+←/→ moves a column · /
          search
        </span>
        <span className="sr-only" role="status" aria-live="polite">
          {status}
        </span>
      </div>
    </div>
  );
}
