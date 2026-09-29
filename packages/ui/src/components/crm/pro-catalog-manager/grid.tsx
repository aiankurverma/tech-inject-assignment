import * as React from "react";
import type { Row } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseTsv,
  productErrors,
  toTsv,
  variantErrors,
} from "@/components/crm/pro-catalog-manager/catalog";
import {
  GRID_COLUMNS,
  displayValue,
  fieldFor,
  rawValue,
  tableFeatureSet,
} from "@/components/crm/pro-catalog-manager/columns";
import {
  STATUSES,
  type CatalogRow,
  type CellEdit,
} from "@/components/crm/pro-catalog-manager/types";

const ROW_H = 34;
const SEL_W = 40;
const COLS = GRID_COLUMNS;
const TEMPLATE = `${SEL_W}px ${COLS.map((c) => `${c.width}px`).join(" ")}`;
const TOTAL_W = SEL_W + COLS.reduce((a, c) => a + c.width, 0);

interface Pos {
  r: number;
  c: number;
}

type GridRow = Row<typeof tableFeatureSet, CatalogRow>;

export interface CatalogGridProps {
  rows: GridRow[];
  dirty: Set<string>;
  dupes: Set<string>;
  readOnly: boolean;
  onEdits: (edits: CellEdit[], label: string) => void;
  onEditOptions: (productId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  /** Reports the selected cell range so the toolbar can target it. */
  onRangeChange?: (rowIds: string[]) => void;
  gridId: string;
}

export function CatalogGrid({
  rows,
  dirty,
  dupes,
  readOnly,
  onEdits,
  onEditOptions,
  onUndo,
  onRedo,
  allSelected,
  someSelected,
  onToggleAll,
  onRangeChange,
  gridId,
}: CatalogGridProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  const [anchor, setAnchor] = React.useState<Pos>({ r: 0, c: 0 });
  const [focus, setFocus] = React.useState<Pos>({ r: 0, c: 0 });
  const [editing, setEditing] = React.useState<{ pos: Pos; value: string } | null>(null);
  const dragging = React.useRef(false);

  const clamp = React.useCallback(
    (p: Pos): Pos => ({
      r: Math.max(0, Math.min(rows.length - 1, p.r)),
      c: Math.max(0, Math.min(COLS.length - 1, p.c)),
    }),
    [rows.length],
  );
  const range = {
    r0: Math.min(anchor.r, focus.r),
    r1: Math.max(anchor.r, focus.r),
    c0: Math.min(anchor.c, focus.c),
    c1: Math.max(anchor.c, focus.c),
  };
  const multi = range.r0 !== range.r1 || range.c0 !== range.c1;

  React.useEffect(() => {
    if (!onRangeChange) return;
    const ids: string[] = [];
    for (let r = range.r0; r <= Math.min(range.r1, rows.length - 1); r++) {
      const row = rows[r];
      if (row) ids.push(row.original.id);
    }
    onRangeChange(ids);
  }, [range.r0, range.r1, rows, onRangeChange]);

  const moveTo = (p: Pos, extend = false) => {
    const n = clamp(p);
    setFocus(n);
    if (!extend) setAnchor(n);
    virtualizer.scrollToIndex(n.r, { align: "auto" });
  };

  const editableAt = (p: Pos) => {
    const row = rows[p.r]?.original;
    const col = COLS[p.c];
    return !readOnly && !!row && !!col && !!fieldFor(row, col);
  };

  const startEdit = (p: Pos, initial?: string) => {
    if (!editableAt(p)) return;
    const row = rows[p.r]!.original;
    setEditing({ pos: p, value: initial ?? rawValue(row, COLS[p.c]!) });
  };

  const commit = (value: string, move?: Pos) => {
    if (!editing) return;
    const row = rows[editing.pos.r]?.original;
    const col = COLS[editing.pos.c];
    const field = row && col ? fieldFor(row, col) : undefined;
    if (row && col && field && value !== rawValue(row, col))
      onEdits([{ rowId: row.id, field, value }], `Edit ${col.header}`);
    setEditing(null);
    gridRef.current?.focus();
    if (move) moveTo(move);
  };

  /** Writes a 2D block of text starting at the range's top-left (or tiles one value over the range). */
  const writeBlock = (block: string[][], label: string) => {
    const edits: CellEdit[] = [];
    const single = block.length === 1 && block[0]?.length === 1;
    const h = single ? range.r1 - range.r0 + 1 : block.length;
    const w = single ? range.c1 - range.c0 + 1 : Math.max(...block.map((r) => r.length));
    for (let i = 0; i < h; i++) {
      const row = rows[range.r0 + i]?.original;
      if (!row) break;
      for (let j = 0; j < w; j++) {
        const col = COLS[range.c0 + j];
        if (!col) break;
        const field = fieldFor(row, col);
        const value = single ? block[0]![0] : block[i]?.[j];
        if (field && value !== undefined) edits.push({ rowId: row.id, field, value });
      }
    }
    if (edits.length) onEdits(edits, label);
    if (!single) setFocus(clamp({ r: range.r0 + h - 1, c: range.c0 + w - 1 }));
  };

  const fillDown = () => {
    const edits: CellEdit[] = [];
    for (let c = range.c0; c <= range.c1; c++) {
      const col = COLS[c]!;
      // Source is the first editable cell of the column inside the range.
      let src: string | null = null;
      for (let r = range.r0; r <= range.r1; r++) {
        const row = rows[r]?.original;
        if (!row) break;
        const field = fieldFor(row, col);
        if (!field) continue;
        if (src === null) {
          src = rawValue(row, col);
          continue;
        }
        if (row.kind === "variant" || col.productField)
          edits.push({ rowId: row.id, field, value: src });
      }
    }
    if (edits.length) onEdits(edits, "Fill down");
  };

  const copy = (e?: React.ClipboardEvent) => {
    const grid: string[][] = [];
    for (let r = range.r0; r <= range.r1; r++) {
      const row = rows[r]?.original;
      if (!row) break;
      const line: string[] = [];
      for (let c = range.c0; c <= range.c1; c++) line.push(rawValue(row, COLS[c]!));
      grid.push(line);
    }
    const text = toTsv(grid);
    if (e) {
      e.clipboardData.setData("text/plain", text);
      e.preventDefault();
    } else void navigator.clipboard?.writeText(text).catch(() => undefined);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editing || !rows.length) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key;
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / ROW_H) - 1);
    const nav: Record<string, Pos> = {
      ArrowDown: { r: focus.r + 1, c: focus.c },
      ArrowUp: { r: focus.r - 1, c: focus.c },
      ArrowLeft: { r: focus.r, c: focus.c - 1 },
      ArrowRight: { r: focus.r, c: focus.c + 1 },
      PageDown: { r: focus.r + page, c: focus.c },
      PageUp: { r: focus.r - page, c: focus.c },
      Home: mod ? { r: 0, c: 0 } : { r: focus.r, c: 0 },
      End: mod ? { r: rows.length - 1, c: COLS.length - 1 } : { r: focus.r, c: COLS.length - 1 },
    };
    if (nav[k]) {
      e.preventDefault();
      moveTo(nav[k]!, e.shiftKey);
      return;
    }
    const row = rows[focus.r];
    if (mod && k.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) onRedo();
      else onUndo();
    } else if (mod && k.toLowerCase() === "y") {
      e.preventDefault();
      onRedo();
    } else if (mod && k.toLowerCase() === "d") {
      e.preventDefault();
      if (!readOnly) fillDown();
    } else if (mod && k.toLowerCase() === "a") {
      e.preventDefault();
      setAnchor({ r: 0, c: 0 });
      setFocus({ r: rows.length - 1, c: COLS.length - 1 });
    } else if (k === "Enter" || k === "F2") {
      e.preventDefault();
      if (k === "Enter" && e.altKey && row?.getCanExpand()) row.toggleExpanded();
      else startEdit(focus);
    } else if (k === "Tab") {
      e.preventDefault();
      moveTo({ r: focus.r, c: focus.c + (e.shiftKey ? -1 : 1) });
    } else if (k === " " && row && !e.shiftKey) {
      e.preventDefault();
      if (focus.c === 0 && row.getCanExpand()) row.toggleExpanded();
      else row.toggleSelected();
    } else if ((k === "Delete" || k === "Backspace") && !readOnly) {
      e.preventDefault();
      writeBlock([[""]], "Clear cells");
    } else if (k === "Escape") {
      setAnchor(focus);
    } else if (k.length === 1 && !mod && !e.altKey && !readOnly) {
      e.preventDefault();
      startEdit(focus, k);
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (editing || readOnly) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    const block = parseTsv(text.replace(/\r?\n$/, ""));
    if (block.length) writeBlock(block, `Paste ${block.length}×${block[0]?.length ?? 0}`);
  };

  React.useEffect(() => {
    const up = () => (dragging.current = false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);
  React.useEffect(() => {
    // Keep the cursor inside the data after filtering / collapsing.
    if (focus.r >= rows.length || anchor.r >= rows.length) {
      const p = clamp(focus);
      setFocus(p);
      setAnchor(p);
    }
  }, [rows.length, focus, anchor, clamp]);

  const items = virtualizer.getVirtualItems();
  const activeId = `${gridId}-r${focus.r}-c${focus.c}`;

  return (
    <div
      ref={scrollRef}
      className="relative min-h-0 flex-1 overflow-auto"
      onMouseLeave={() => (dragging.current = false)}
    >
      <div
        ref={gridRef}
        role="grid"
        tabIndex={0}
        aria-label="Catalog"
        aria-rowcount={rows.length + 1}
        aria-colcount={COLS.length + 1}
        aria-multiselectable
        aria-readonly={readOnly || undefined}
        aria-activedescendant={rows.length ? activeId : undefined}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onCopy={(e) => !editing && copy(e)}
        className="outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-crm-ring"
        style={{ width: TOTAL_W, minWidth: "100%" }}
      >
        <div
          role="row"
          aria-rowindex={1}
          className="sticky top-0 z-20 grid border-b border-crm-border bg-crm-raised text-[11.5px] font-medium text-crm-muted-fg"
          style={{ gridTemplateColumns: TEMPLATE, height: ROW_H }}
        >
          <div role="columnheader" className="grid place-items-center">
            <input
              type="checkbox"
              aria-label="Select all rows"
              className="size-3.5 accent-[var(--color-crm-primary)]"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = !allSelected && someSelected;
              }}
              onChange={onToggleAll}
            />
          </div>
          {COLS.map((c) => (
            <div
              key={c.id}
              role="columnheader"
              className={cn("flex items-center px-2", c.align === "right" && "justify-end")}
            >
              {c.header}
            </div>
          ))}
        </div>
        {rows.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-crm-muted-fg">
            No products match this view.
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {items.map((vi) => {
              const row = rows[vi.index]!;
              const data = row.original;
              const isProduct = data.kind === "product";
              const errs = isProduct ? productErrors(data.product) : variantErrors(data.variant);
              const selected = row.getIsSelected();
              return (
                <div
                  key={row.id}
                  role="row"
                  aria-rowindex={vi.index + 2}
                  aria-level={isProduct ? 1 : 2}
                  aria-expanded={isProduct && row.getCanExpand() ? row.getIsExpanded() : undefined}
                  aria-selected={selected}
                  className={cn(
                    "absolute left-0 grid w-full border-b border-crm-border/70 text-[12.5px]",
                    isProduct ? "bg-crm-card font-medium" : "bg-crm-bg",
                    selected && "bg-crm-primary/10",
                  )}
                  style={{
                    gridTemplateColumns: TEMPLATE,
                    height: ROW_H,
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  <div role="gridcell" className="grid place-items-center">
                    <input
                      type="checkbox"
                      tabIndex={-1}
                      aria-label={`Select ${isProduct ? data.product.title : data.variant.sku}`}
                      className="size-3.5 accent-[var(--color-crm-primary)]"
                      checked={selected}
                      ref={(el) => {
                        if (el) el.indeterminate = !selected && row.getIsSomeSelected();
                      }}
                      onChange={row.getToggleSelectedHandler()}
                    />
                  </div>
                  {COLS.map((col, c) => {
                    const pos = { r: vi.index, c };
                    const field = fieldFor(data, col);
                    const key = `${data.id}:${field ?? col.id}`;
                    const err =
                      (field && errs?.[field]) ||
                      (col.id === "sku" && !isProduct && dupes.has(data.variant.sku.toUpperCase())
                        ? "Duplicate SKU"
                        : undefined);
                    const inRange =
                      vi.index >= range.r0 &&
                      vi.index <= range.r1 &&
                      c >= range.c0 &&
                      c <= range.c1;
                    const isFocus = focus.r === vi.index && focus.c === c;
                    const isEditing = editing?.pos.r === vi.index && editing.pos.c === c;
                    return (
                      <div
                        key={col.id}
                        id={`${gridId}-r${vi.index}-c${c}`}
                        role="gridcell"
                        aria-colindex={c + 2}
                        aria-selected={inRange}
                        aria-readonly={!field || readOnly || undefined}
                        aria-invalid={err ? true : undefined}
                        title={err || undefined}
                        onMouseDown={(e) => {
                          if (e.button !== 0 || isEditing) return;
                          dragging.current = true;
                          moveTo(pos, e.shiftKey);
                        }}
                        onMouseEnter={() => dragging.current && moveTo(pos, true)}
                        onDoubleClick={() => startEdit(pos)}
                        className={cn(
                          "relative flex min-w-0 items-center px-2",
                          col.align === "right" && "justify-end tabular-nums",
                          !field && !isProduct && "text-crm-muted-fg",
                          dirty.has(key) && "bg-tag-amber-bg/50",
                          err && "text-crm-danger",
                          inRange && multi && "bg-crm-primary/15",
                          isFocus && "z-10 outline outline-2 -outline-offset-2 outline-crm-primary",
                        )}
                      >
                        {err && (
                          <span
                            aria-hidden
                            className="absolute right-0 top-0 size-0 border-l-[6px] border-t-[6px] border-l-transparent border-t-crm-danger"
                          />
                        )}
                        {c === 0 && (
                          <span
                            className="flex shrink-0 items-center"
                            style={{ paddingLeft: row.depth * 20 }}
                          >
                            {row.getCanExpand() ? (
                              <button
                                type="button"
                                tabIndex={-1}
                                aria-label={row.getIsExpanded() ? "Collapse" : "Expand"}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => row.toggleExpanded()}
                                className="mr-1 grid size-5 place-items-center rounded text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg"
                              >
                                <ChevronRight
                                  className={cn(
                                    "size-3.5 transition-transform",
                                    row.getIsExpanded() && "rotate-90",
                                  )}
                                />
                              </button>
                            ) : (
                              isProduct && <span className="mr-1 w-5" />
                            )}
                          </span>
                        )}
                        {isEditing ? (
                          <CellEditor
                            kind={col.kind}
                            initial={editing.value}
                            align={col.align}
                            onCommit={(v, dir) =>
                              commit(
                                v,
                                dir === "down"
                                  ? clamp({ r: vi.index + 1, c })
                                  : dir === "right"
                                    ? clamp({ r: vi.index, c: c + 1 })
                                    : dir === "left"
                                      ? clamp({ r: vi.index, c: c - 1 })
                                      : undefined,
                              )
                            }
                            onCancel={() => {
                              setEditing(null);
                              gridRef.current?.focus();
                            }}
                          />
                        ) : col.kind === "status" ? (
                          <StatusPill status={displayValue(data, col)} />
                        ) : (
                          <span className="truncate">{displayValue(data, col)}</span>
                        )}
                        {c === 0 && isProduct && !readOnly && (
                          <button
                            type="button"
                            tabIndex={-1}
                            aria-label={`Edit options of ${data.product.title}`}
                            title="Edit options and generate variants"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => onEditOptions(data.product.id)}
                            className="ml-auto grid size-6 shrink-0 place-items-center rounded text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg"
                          >
                            <SlidersHorizontal className="size-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  active: "border-tag-green-border bg-tag-green-bg text-tag-green-text",
  draft: "border-tag-neutral-border bg-tag-neutral-bg text-tag-neutral-text",
  archived: "border-tag-red-border bg-tag-red-bg text-tag-red-text",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-px text-[11px] font-normal capitalize",
        STATUS_TONE[status] ?? STATUS_TONE.draft,
      )}
    >
      {status}
    </span>
  );
}

function CellEditor({
  kind,
  initial,
  align,
  onCommit,
  onCancel,
}: {
  kind: string;
  initial: string;
  align?: "right";
  onCommit: (v: string, dir?: "down" | "right" | "left") => void;
  onCancel: () => void;
}) {
  const [v, setV] = React.useState(initial);
  const done = React.useRef(false);
  const finish = (val: string, dir?: "down" | "right" | "left") => {
    if (done.current) return;
    done.current = true;
    onCommit(val, dir);
  };
  const cls =
    "absolute inset-0 z-20 w-full border-2 border-crm-primary bg-crm-popover px-2 text-[12.5px] text-crm-fg outline-none";
  if (kind === "status")
    return (
      <select
        autoFocus
        aria-label="Status"
        className={cls}
        value={STATUSES.includes(v as never) ? v : "draft"}
        onChange={(e) => finish(e.target.value)}
        onBlur={() => finish(v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            done.current = true;
            onCancel();
          }
          if (e.key === "Enter") finish(v, "down");
        }}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    );
  return (
    <input
      autoFocus
      aria-label="Cell value"
      inputMode={kind === "money" ? "decimal" : kind === "int" ? "numeric" : undefined}
      className={cn(cls, align === "right" && "text-right tabular-nums")}
      value={v}
      onFocus={(e) => {
        const n = e.currentTarget.value.length;
        e.currentTarget.setSelectionRange(n, n);
      }}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => finish(v)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          finish(v, "down");
        } else if (e.key === "Tab") {
          e.preventDefault();
          finish(v, e.shiftKey ? "left" : "right");
        } else if (e.key === "Escape") {
          e.preventDefault();
          done.current = true;
          onCancel();
        }
      }}
    />
  );
}
