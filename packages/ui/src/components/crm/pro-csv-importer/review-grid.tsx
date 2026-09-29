import * as React from "react";
import {
  columnResizingFeature,
  columnSizingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertCircle, Copy, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CsvImportController } from "@/hooks/use-csv-import";
import type { ImporterField } from "@/components/crm/pro-csv-importer/types";

export type ReviewFilter = "all" | "errors" | "duplicates" | "excluded";

const features = tableFeatures({ columnSizingFeature, columnResizingFeature });
interface RowRef {
  i: number;
}

export interface ReviewGridProps {
  ctl: CsvImportController;
  fields: readonly ImporterField[];
  filter: ReviewFilter;
  height: number;
}

const ROW_H = 34;
const HEAD_H = 34;
const GUTTER = 88;

export function ReviewGrid({ ctl, fields, filter, height }: ReviewGridProps) {
  const { state, rows, errors, duplicates, excludedRows, bodyStart } = ctl;
  const fieldByKey = React.useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const mappedCols = React.useMemo(
    () =>
      state.mapping
        .map((key, col) => (key ? { key, col, field: fieldByKey.get(key)! } : null))
        .filter((x): x is { key: string; col: number; field: ImporterField } => !!x?.field),
    [state.mapping, fieldByKey],
  );

  // Index list for the active tab; recomputed only when data or the tab changes.
  const data = React.useMemo<RowRef[]>(() => {
    const out: RowRef[] = [];
    const all = rows.current;
    for (let i = bodyStart; i < all.length; i++) {
      const ex = excludedRows.current.has(i);
      if (filter === "excluded" ? !ex : ex) continue;
      if (filter === "errors" && !errors.current.has(i)) continue;
      if (
        filter === "duplicates" &&
        !duplicates.current.inFile.has(i) &&
        !duplicates.current.existing.has(i)
      )
        continue;
      out.push({ i });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, state.version, bodyStart, state.validating]);

  const columns = React.useMemo<ColumnDef<typeof features, RowRef, unknown>[]>(
    () =>
      mappedCols.map((m) => ({
        id: m.key,
        header: m.field.label,
        size: Math.min(280, Math.max(120, m.field.label.length * 9 + 48)),
        minSize: 80,
      })),
    [mappedCols],
  );
  const table = useTable({ features, data, columns, columnResizeMode: "onChange" });
  const headers = table.getFlatHeaders();
  const totalWidth = GUTTER + table.getTotalSize();

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
    scrollPaddingStart: HEAD_H,
    initialRect: { width: 1000, height },
  });

  const [active, setActive] = React.useState({ row: 0, col: 0 });
  const [edit, setEdit] = React.useState<{ row: number; col: number; draft: string } | null>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const gid = React.useId().replace(/:/g, "");
  React.useEffect(() => {
    setActive((a) => ({
      row: Math.min(a.row, Math.max(0, data.length - 1)),
      col: Math.min(a.col, Math.max(0, mappedCols.length - 1)),
    }));
  }, [data.length, mappedCols.length]);

  const move = (row: number, col: number) => {
    const r = Math.max(0, Math.min(data.length - 1, row));
    const c = Math.max(0, Math.min(mappedCols.length - 1, col));
    setActive({ row: r, col: c });
    v.scrollToIndex(r, { align: "auto" });
  };
  const beginEdit = (row: number, col: number, initial?: string) => {
    const ref = data[row];
    const m = mappedCols[col];
    if (!ref || !m) return;
    setEdit({ row, col, draft: initial ?? rows.current[ref.i]?.[m.col] ?? "" });
  };
  const commitEdit = (dr: number, dc: number) => {
    if (!edit) return;
    const ref = data[edit.row];
    const m = mappedCols[edit.col];
    if (ref && m && (rows.current[ref.i]?.[m.col] ?? "") !== edit.draft) {
      ctl.setCell(ref.i, m.col, edit.draft);
    }
    setEdit(null);
    move(edit.row + dr, edit.col + dc);
    gridRef.current?.focus({ preventScroll: true });
  };
  const toggleExclude = (row: number) => {
    const ref = data[row];
    if (ref) ctl.setExcluded([ref.i], !excludedRows.current.has(ref.i));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (edit || e.target !== gridRef.current) return;
    const { row, col } = active;
    const mod = e.ctrlKey || e.metaKey;
    const page = Math.floor((height - HEAD_H) / ROW_H) - 1;
    let handled = true;
    if (e.key === "ArrowDown") move(mod ? data.length - 1 : row + 1, col);
    else if (e.key === "ArrowUp") move(mod ? 0 : row - 1, col);
    else if (e.key === "ArrowRight") move(row, mod ? mappedCols.length - 1 : col + 1);
    else if (e.key === "ArrowLeft") move(row, mod ? 0 : col - 1);
    else if (e.key === "Home") move(mod ? 0 : row, 0);
    else if (e.key === "End") move(mod ? data.length - 1 : row, mappedCols.length - 1);
    else if (e.key === "PageDown") move(row + page, col);
    else if (e.key === "PageUp") move(row - page, col);
    else if (e.key === "Enter" || e.key === "F2") beginEdit(row, col);
    else if (e.key === "Delete" && mod) toggleExclude(row);
    else if (e.key === "Delete" || e.key === "Backspace") beginEdit(row, col, "");
    else if (e.key.length === 1 && !mod && !e.altKey) beginEdit(row, col, e.key);
    else handled = false;
    if (handled) e.preventDefault();
  };

  const cellId = (r: number, c: number) => `${gid}-${r}-${c}`;
  const activeRef = data[active.row];

  if (!mappedCols.length) return null;

  return (
    <div
      ref={scrollRef}
      style={{ height }}
      className="overflow-auto overscroll-contain [contain:strict]"
    >
      <div
        ref={gridRef}
        role="grid"
        aria-label="Rows to import"
        aria-rowcount={data.length + 1}
        aria-colcount={mappedCols.length + 1}
        aria-activedescendant={!edit && activeRef ? cellId(active.row, active.col) : undefined}
        tabIndex={0}
        onKeyDown={onKeyDown}
        style={{ width: totalWidth, minWidth: "100%" }}
        className="relative outline-none focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:ring-inset"
      >
        <div
          role="row"
          aria-rowindex={1}
          className="sticky top-0 z-[3] flex bg-crm-card"
          style={{ height: HEAD_H }}
        >
          <div
            role="columnheader"
            className="sticky left-0 z-[1] flex shrink-0 items-center border-r border-b border-crm-border bg-crm-card px-2 text-xs text-crm-muted-fg"
            style={{ width: GUTTER }}
          >
            Row
          </div>
          {headers.map((h) => {
            const f = fieldByKey.get(h.column.id)!;
            return (
              <div
                key={h.id}
                role="columnheader"
                className="relative flex shrink-0 items-center border-r border-b border-crm-border px-2 text-xs font-medium text-crm-soft"
                style={{ width: h.getSize() }}
              >
                <span className="truncate">
                  {f.label}
                  {f.required && <span className="text-crm-danger"> *</span>}
                </span>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize ${f.label}`}
                  onMouseDown={h.getResizeHandler()}
                  onTouchStart={h.getResizeHandler()}
                  className="absolute top-0 -right-1 z-[2] h-full w-2 cursor-col-resize touch-none after:absolute after:inset-y-2 after:left-[3px] after:w-0.5 after:bg-crm-primary after:opacity-0 hover:after:opacity-100"
                />
              </div>
            );
          })}
        </div>

        <div role="rowgroup" className="relative" style={{ height: v.getTotalSize() }}>
          {v.getVirtualItems().map((item) => {
            const ref = data[item.index]!;
            const row = rows.current[ref.i] ?? [];
            const rowErr = errors.current.get(ref.i);
            const dupe = duplicates.current.inFile.has(ref.i)
              ? "Duplicate in file"
              : duplicates.current.existing.has(ref.i)
                ? "Already in CRM"
                : null;
            const excluded = excludedRows.current.has(ref.i);
            return (
              <div
                key={ref.i}
                role="row"
                aria-rowindex={item.index + 2}
                className={cn(
                  "absolute top-0 left-0 flex",
                  excluded && "opacity-50",
                  rowErr ? "bg-crm-danger/[0.04]" : "hover:bg-crm-muted/40",
                )}
                style={{
                  height: ROW_H,
                  width: totalWidth,
                  transform: `translateY(${item.start}px)`,
                }}
              >
                <div
                  role="rowheader"
                  className="sticky left-0 z-[1] flex shrink-0 items-center gap-1 border-r border-b border-crm-border bg-crm-card px-1.5 text-xs text-crm-muted-fg tabular-nums"
                  style={{ width: GUTTER }}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {(ref.i - bodyStart + 1).toLocaleString()}
                  </span>
                  {dupe && (
                    <Copy className="size-3.5 shrink-0 text-crm-warning" aria-label={dupe} />
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => toggleExclude(item.index)}
                    aria-label={
                      excluded
                        ? `Restore row ${ref.i - bodyStart + 1}`
                        : `Remove row ${ref.i - bodyStart + 1}`
                    }
                    title={excluded ? "Restore row" : "Remove row (Ctrl+Delete)"}
                    className="grid size-6 shrink-0 place-items-center rounded-[6px] hover:bg-crm-muted hover:text-crm-fg"
                  >
                    {excluded ? (
                      <RotateCcw className="size-3.5" aria-hidden />
                    ) : (
                      <Trash2 className="size-3.5" aria-hidden />
                    )}
                  </button>
                </div>
                {mappedCols.map((m, c) => {
                  const err = rowErr?.[m.key];
                  const isActive = active.row === item.index && active.col === c;
                  const isEdit = edit?.row === item.index && edit.col === c;
                  const value = row[m.col] ?? "";
                  return (
                    <div
                      key={m.key}
                      id={cellId(item.index, c)}
                      role="gridcell"
                      aria-invalid={err ? true : undefined}
                      aria-description={err}
                      title={err}
                      onMouseDown={() => !edit && setActive({ row: item.index, col: c })}
                      onDoubleClick={() => beginEdit(item.index, c)}
                      style={{ width: table.getColumn(m.key)?.getSize() ?? 150 }}
                      className={cn(
                        "relative flex shrink-0 cursor-cell items-center gap-1 border-r border-b border-crm-border px-2 text-sm text-crm-fg",
                        err && "bg-crm-danger/10 text-crm-danger",
                        isActive &&
                          !isEdit &&
                          "z-[2] outline-2 -outline-offset-2 outline-crm-primary",
                        isEdit && "z-[2] px-0.5",
                      )}
                    >
                      {isEdit ? (
                        <input
                          autoFocus
                          value={edit.draft}
                          aria-label={`Edit ${m.field.label}`}
                          onChange={(e) => setEdit({ ...edit, draft: e.target.value })}
                          onBlur={() => commitEdit(0, 0)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitEdit(e.shiftKey ? -1 : 1, 0);
                            } else if (e.key === "Tab") {
                              e.preventDefault();
                              commitEdit(0, e.shiftKey ? -1 : 1);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              setEdit(null);
                              gridRef.current?.focus({ preventScroll: true });
                            }
                          }}
                          className="h-full w-full rounded-[4px] border border-crm-primary bg-crm-bg px-1.5 text-sm text-crm-fg outline-none"
                        />
                      ) : (
                        <>
                          {err && <AlertCircle className="size-3.5 shrink-0" aria-hidden />}
                          <span className={cn("truncate", !value && "text-crm-faint")}>
                            {value || (err ? "empty" : "—")}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {data.length === 0 && !state.validating && (
        <p className="p-8 text-center text-sm text-crm-muted-fg" role="status">
          {filter === "errors"
            ? "No rows with errors. Nice."
            : filter === "duplicates"
              ? "No duplicates found."
              : filter === "excluded"
                ? "No rows removed."
                : "No rows."}
        </p>
      )}
    </div>
  );
}
