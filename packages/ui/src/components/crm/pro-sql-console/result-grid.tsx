import * as React from "react";
import {
  columnResizingFeature,
  columnSizingFeature,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueryResult } from "@/components/crm/pro-sql-console/types";

type Row = unknown[];

/** Nulls last, numbers numerically, dates/strings with locale-aware natural order. */
function compareValues(a: unknown, b: unknown): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return collator.compare(String(a), String(b));
}
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const features = tableFeatures({
  rowSortingFeature,
  columnSizingFeature,
  columnResizingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic },
});

export function formatCell(v: unknown): string {
  if (v == null) return "NULL";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const NUMERIC = /^(int|integer|bigint|smallint|numeric|decimal|real|float|double)/i;
const ROW_H = 30;
const INDEX_W = 56;

export interface ResultGridProps {
  result: QueryResult;
  className?: string;
  /** Fired with the sorted rows so exports match what the user sees. */
  onSortedRowsChange?: (rows: Row[]) => void;
}

/**
 * Virtualised result grid on TanStack Table (sorting, column sizing/resizing) and TanStack
 * Virtual. Only visible rows mount, so 100k-row results stay at 60fps. Keyboard: arrows/Home/End/
 * PageUp/PageDown move the active cell, Mod+C copies it, Enter on a header toggles sort.
 */
export function ResultGrid({ result, className, onSortedRowsChange }: ResultGridProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  React.useEffect(() => setSorting([]), [result]);

  const columns = React.useMemo<ColumnDef<typeof features, Row>[]>(
    () =>
      result.columns.map((c, i) => ({
        id: `c${i}`,
        header: c.name,
        accessorFn: (row: Row) => row[i],
        sortFn: (a, b, id) => compareValues(a.getValue(id), b.getValue(id)),
        size: Math.min(320, Math.max(90, c.name.length * 9 + 40)),
        minSize: 60,
        maxSize: 900,
      })),
    [result.columns],
  );

  const table = useTable({
    features,
    columns,
    data: result.rows,
    state: { sorting },
    onSortingChange: setSorting,
    columnResizeMode: "onChange",
  });

  const rows = table.getRowModel().rows;
  const onSortedRef = React.useRef(onSortedRowsChange);
  onSortedRef.current = onSortedRowsChange;
  React.useEffect(() => {
    onSortedRef.current?.(rows.map((r) => r.original));
  }, [rows]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 16,
  });

  const [cell, setCell] = React.useState<{ r: number; c: number } | null>(null);
  React.useEffect(() => setCell(null), [result]);
  const headers = table.getFlatHeaders();
  const numeric = React.useMemo(
    () => result.columns.map((c) => NUMERIC.test(c.type ?? "")),
    [result.columns],
  );
  const totalWidth = INDEX_W + table.getTotalSize();

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!rows.length || !headers.length) return;
    const cur = cell ?? { r: 0, c: 0 };
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 300) / ROW_H) - 1);
    const lastR = rows.length - 1;
    const lastC = headers.length - 1;
    let next = cur;
    switch (e.key) {
      case "ArrowDown":
        next = { ...cur, r: Math.min(lastR, cur.r + 1) };
        break;
      case "ArrowUp":
        next = { ...cur, r: Math.max(0, cur.r - 1) };
        break;
      case "ArrowRight":
        next = { ...cur, c: Math.min(lastC, cur.c + 1) };
        break;
      case "ArrowLeft":
        next = { ...cur, c: Math.max(0, cur.c - 1) };
        break;
      case "PageDown":
        next = { ...cur, r: Math.min(lastR, cur.r + page) };
        break;
      case "PageUp":
        next = { ...cur, r: Math.max(0, cur.r - page) };
        break;
      case "Home":
        next = e.ctrlKey || e.metaKey ? { r: 0, c: 0 } : { ...cur, c: 0 };
        break;
      case "End":
        next = e.ctrlKey || e.metaKey ? { r: lastR, c: lastC } : { ...cur, c: lastC };
        break;
      case "c":
        if ((e.ctrlKey || e.metaKey) && cell) {
          const v = rows[cell.r]?.getValue(headers[cell.c]!.column.id);
          void navigator.clipboard?.writeText(formatCell(v)).catch(() => undefined);
          e.preventDefault();
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    setCell(next);
    virtualizer.scrollToIndex(next.r, { align: "auto" });
    const el = scrollRef.current;
    if (el) {
      let left = INDEX_W;
      for (let i = 0; i < next.c; i++) left += headers[i]!.getSize();
      const w = headers[next.c]!.getSize();
      if (left < el.scrollLeft + INDEX_W) el.scrollLeft = left - INDEX_W;
      else if (left + w > el.scrollLeft + el.clientWidth) el.scrollLeft = left + w - el.clientWidth;
    }
  };

  if (!result.columns.length)
    return (
      <div
        className={cn("flex h-full items-center justify-center text-xs text-crm-subtle", className)}
      >
        Statement executed. {result.rowCount ?? 0} row(s) affected.
      </div>
    );

  const activeId = cell ? `kb-sql-cell-${cell.r}-${cell.c}` : undefined;

  return (
    <div
      ref={scrollRef}
      role="grid"
      aria-label="Query results"
      aria-rowcount={rows.length + 1}
      aria-colcount={headers.length + 1}
      aria-activedescendant={activeId}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn(
        "relative h-full overflow-auto font-mono text-xs outline-none focus-visible:ring-1 focus-visible:ring-crm-ring",
        className,
      )}
    >
      <div style={{ width: totalWidth, minWidth: "100%" }}>
        <div
          role="row"
          aria-rowindex={1}
          className="sticky top-0 z-10 flex border-b border-crm-border bg-crm-raised"
          style={{ height: ROW_H }}
        >
          <div
            role="columnheader"
            className="sticky left-0 z-10 shrink-0 border-r border-crm-border bg-crm-raised"
            style={{ width: INDEX_W }}
          />
          {headers.map((h, ci) => {
            const sorted = h.column.getIsSorted();
            const meta = result.columns[ci];
            return (
              <div
                key={h.id}
                role="columnheader"
                aria-colindex={ci + 2}
                aria-sort={
                  sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                }
                className="relative flex shrink-0 items-center border-r border-crm-border"
                style={{ width: h.getSize() }}
              >
                <button
                  type="button"
                  onClick={h.column.getToggleSortingHandler()}
                  title={meta?.type ? `${meta.name} · ${meta.type}` : meta?.name}
                  className={cn(
                    "flex h-full min-w-0 flex-1 items-center gap-1 px-2 text-left font-sans font-medium text-crm-soft hover:text-crm-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-crm-ring",
                    numeric[ci] && "flex-row-reverse text-right",
                  )}
                >
                  <span className="truncate">{meta?.name}</span>
                  {meta?.type && (
                    <span className="shrink-0 text-[10px] font-normal text-crm-faint">
                      {meta.type}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-crm-subtle" aria-hidden>
                    {sorted === "asc" ? (
                      <ArrowUp className="size-3" />
                    ) : sorted === "desc" ? (
                      <ArrowDown className="size-3" />
                    ) : (
                      <ChevronsUpDown className="size-3 opacity-40" />
                    )}
                  </span>
                </button>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize ${meta?.name ?? "column"}`}
                  onMouseDown={h.getResizeHandler()}
                  onTouchStart={h.getResizeHandler()}
                  onDoubleClick={() => h.column.resetSize()}
                  className={cn(
                    "absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize touch-none select-none",
                    "after:absolute after:left-1/2 after:top-1 after:h-[calc(100%-8px)] after:w-px after:bg-transparent hover:after:bg-crm-primary",
                    h.column.getIsResizing() && "after:bg-crm-primary",
                  )}
                />
              </div>
            );
          })}
        </div>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index];
            if (!row) return null;
            return (
              <div
                key={row.id}
                role="row"
                aria-rowindex={vi.index + 2}
                className="absolute left-0 flex border-b border-crm-border/60 hover:bg-crm-muted/40"
                style={{ height: ROW_H, width: totalWidth, transform: `translateY(${vi.start}px)` }}
              >
                <div
                  role="rowheader"
                  className="sticky left-0 shrink-0 border-r border-crm-border bg-crm-bg px-2 text-right leading-[30px] text-crm-faint"
                  style={{ width: INDEX_W }}
                >
                  {vi.index + 1}
                </div>
                {headers.map((h, ci) => {
                  const v = row.getValue(h.column.id);
                  const isActive = cell?.r === vi.index && cell.c === ci;
                  return (
                    <div
                      key={h.id}
                      id={`kb-sql-cell-${vi.index}-${ci}`}
                      role="gridcell"
                      aria-colindex={ci + 2}
                      aria-selected={isActive}
                      onMouseDown={() => setCell({ r: vi.index, c: ci })}
                      title={typeof v === "string" && v.length > 40 ? v : undefined}
                      className={cn(
                        "shrink-0 truncate border-r border-crm-border/60 px-2 leading-[30px]",
                        v == null ? "italic text-crm-faint" : "text-crm-fg",
                        numeric[ci] && "text-right tabular-nums",
                        typeof v === "boolean" && "text-crm-status",
                        isActive &&
                          "bg-crm-primary/15 outline outline-1 -outline-offset-1 outline-crm-primary",
                      )}
                      style={{ width: h.getSize() }}
                    >
                      {formatCell(v)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {!rows.length && (
        <div className="py-10 text-center font-sans text-xs text-crm-subtle">
          Query returned no rows
        </div>
      )}
    </div>
  );
}
