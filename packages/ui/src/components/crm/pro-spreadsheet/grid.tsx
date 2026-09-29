import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import {
  a1,
  cellKey,
  colName,
  inRange,
  type CellPos,
  type CellRange,
} from "@/components/crm/pro-spreadsheet/address";
import type { SpreadsheetEngine } from "@/components/crm/pro-spreadsheet/engine";
import { isError } from "@/components/crm/pro-spreadsheet/functions";
import { formatValue } from "@/components/crm/pro-spreadsheet/operations";
import type { SheetData } from "@/components/crm/pro-spreadsheet/store";

export interface EditState {
  value: string;
  /** "enter": typing replaced the cell, arrows commit. "edit": F2/double-click, arrows move the caret. */
  mode: "enter" | "edit";
  /** Where the editor lives: in the cell or in the formula bar. */
  from: "cell" | "bar";
}

export interface GridHandle {
  scrollTo: (p: CellPos) => void;
  focus: () => void;
  pageRows: () => number;
}

export interface GridProps {
  id: string;
  sheet: SheetData;
  engine: SpreadsheetEngine;
  /** Recalculation counter; forces value re-reads when the engine changes. */
  calc: number;
  anchor: CellPos;
  active: CellPos;
  selection: CellRange;
  fillDest: CellRange | null;
  editing: EditState | null;
  readOnly: boolean;
  currency: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onCopy: (e: React.ClipboardEvent) => void;
  onCut: (e: React.ClipboardEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onCellPointerDown: (pos: CellPos, e: React.PointerEvent) => void;
  onCellPointerEnter: (pos: CellPos) => void;
  onCellDoubleClick: () => void;
  onHeaderSelect: (kind: "row" | "col", index: number, extend: boolean) => void;
  onFillStart: () => void;
  onEditChange: (value: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onColumnResize: (col: number, width: number) => void;
}

const ROW_H = 26;
const HEADER_H = 26;
const HEADER_W = 52;
const DEFAULT_W = 100;
const MIN_W = 36;

interface CellProps {
  id: string;
  r: number;
  c: number;
  x: number;
  y: number;
  w: number;
  text: string;
  kind: "num" | "text" | "error" | "bool";
  selected: boolean;
  active: boolean;
  filling: boolean;
  handle: boolean;
  frozenEdge: boolean;
}

const Cell = React.memo(function Cell(p: CellProps) {
  return (
    <div
      role="gridcell"
      id={p.id}
      aria-colindex={p.c + 2}
      aria-selected={p.selected}
      data-r={p.r}
      data-c={p.c}
      className={cn(
        "absolute truncate border-r border-b border-crm-border/70 bg-crm-bg px-1.5 text-[13px] leading-[25px] tabular-nums select-none",
        p.kind === "num" && "text-right",
        p.kind === "bool" && "text-center",
        p.kind === "error" && "text-center font-medium text-crm-danger",
        p.selected && !p.active && "bg-crm-primary/10",
        p.filling &&
          "bg-crm-primary/5 outline-1 -outline-offset-1 outline-crm-primary outline-dashed",
        p.active && "z-[1] outline-2 -outline-offset-2 outline-crm-primary",
        p.frozenEdge && "border-r-crm-fg/30",
      )}
      style={{ left: p.x, top: p.y, width: p.w, height: ROW_H }}
    >
      {p.text}
      {p.handle && (
        <span
          data-fill=""
          aria-hidden
          className="absolute right-[-3px] bottom-[-3px] z-[2] size-[7px] cursor-crosshair border border-crm-bg bg-crm-primary"
        />
      )}
    </div>
  );
});

export const Grid = React.forwardRef<GridHandle, GridProps>(function Grid(props, ref) {
  const { id, sheet, engine, anchor, active, selection, fillDest, editing, readOnly, currency } =
    props;
  const scroller = React.useRef<HTMLDivElement>(null);
  const latest = React.useRef(props);
  latest.current = props;

  const fr = Math.min(sheet.frozenRows ?? 0, sheet.rowCount - 1);
  const fc = Math.min(sheet.frozenCols ?? 0, sheet.colCount - 1);
  const [resizing, setResizing] = React.useState<{ c: number; w: number } | null>(null);

  const widthOf = React.useCallback(
    (c: number) =>
      resizing && resizing.c === c ? resizing.w : (sheet.colWidths?.[c] ?? DEFAULT_W),
    [sheet.colWidths, resizing],
  );
  // Prefix sums of column widths: O(columns), recomputed only when widths change.
  const colX = React.useMemo(() => {
    const xs = new Float64Array(sheet.colCount + 1);
    for (let c = 0; c < sheet.colCount; c++) xs[c + 1] = xs[c]! + widthOf(c);
    return xs;
  }, [sheet.colCount, widthOf]);
  const frozenW = colX[fc]!;
  const frozenH = fr * ROW_H;
  const totalW = HEADER_W + colX[sheet.colCount]!;
  const totalH = HEADER_H + sheet.rowCount * ROW_H;

  const rowVirt = useVirtualizer({
    count: sheet.rowCount - fr,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_H,
    overscan: 10,
    scrollMargin: HEADER_H + frozenH,
  });
  const colVirt = useVirtualizer({
    horizontal: true,
    count: sheet.colCount - fc,
    getScrollElement: () => scroller.current,
    estimateSize: (i) => widthOf(fc + i),
    overscan: 3,
    scrollMargin: HEADER_W + frozenW,
  });
  React.useEffect(() => colVirt.measure(), [colVirt, widthOf, fc]);

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => scroller.current?.focus({ preventScroll: true }),
      pageRows: () =>
        Math.max(
          1,
          Math.floor(((scroller.current?.clientHeight ?? 400) - HEADER_H - frozenH) / ROW_H) - 1,
        ),
      scrollTo: ({ r, c }) => {
        const el = scroller.current;
        if (!el) return;
        if (r >= fr) {
          const top = HEADER_H + r * ROW_H;
          const viewTop = el.scrollTop + HEADER_H + frozenH;
          if (top < viewTop) el.scrollTop = top - HEADER_H - frozenH;
          else if (top + ROW_H > el.scrollTop + el.clientHeight)
            el.scrollTop = top + ROW_H - el.clientHeight;
        }
        if (c >= fc) {
          const left = HEADER_W + colX[c]!;
          const right = HEADER_W + colX[c + 1]!;
          const viewLeft = el.scrollLeft + HEADER_W + frozenW;
          if (left < viewLeft) el.scrollLeft = left - HEADER_W - frozenW;
          else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
        }
      },
    }),
    [fr, fc, frozenH, frozenW, colX],
  );

  // ---- delegated pointer handling (cells stay handler-free so memo holds) ----
  const lastEnter = React.useRef("");
  const posFrom = (t: EventTarget | null): CellPos | null => {
    const el = (t as HTMLElement | null)?.closest?.("[data-r]") as HTMLElement | null;
    return el ? { r: Number(el.dataset.r), c: Number(el.dataset.c) } : null;
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-editor]")) return;
    if (t.closest("[data-fill]") && !readOnly) {
      e.preventDefault();
      latest.current.onFillStart();
      return;
    }
    const resize = t.closest("[data-resize]") as HTMLElement | null;
    if (resize) {
      e.preventDefault();
      const c = Number(resize.dataset.resize);
      const startX = e.clientX;
      const startW = widthOf(c);
      let w = startW;
      const move = (ev: PointerEvent) => {
        w = Math.max(MIN_W, Math.round(startW + ev.clientX - startX));
        setResizing({ c, w });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        setResizing(null);
        if (w !== startW) latest.current.onColumnResize(c, w);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      return;
    }
    const header = t.closest("[data-header]") as HTMLElement | null;
    if (header) {
      e.preventDefault();
      latest.current.onHeaderSelect(
        header.dataset.header as "row" | "col",
        Number(header.dataset.i),
        e.shiftKey,
      );
      return;
    }
    const pos = posFrom(t);
    if (pos) {
      e.preventDefault();
      lastEnter.current = `${pos.r}:${pos.c}`;
      latest.current.onCellPointerDown(pos, e);
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    const pos = posFrom(e.target);
    if (!pos) return;
    const k = `${pos.r}:${pos.c}`;
    if (k === lastEnter.current) return;
    lastEnter.current = k;
    latest.current.onCellPointerEnter(pos);
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-resize]")) {
      // Auto-fit is out of scope; double-click resets to the default width.
      latest.current.onColumnResize(
        Number((t.closest("[data-resize]") as HTMLElement).dataset.resize),
        DEFAULT_W,
      );
      return;
    }
    if (posFrom(t) && !readOnly) latest.current.onCellDoubleClick();
  };

  // ---- rendering helpers ----
  const handleCell = fillDest ?? selection;
  const cellEl = (r: number, c: number, x: number, y: number) => {
    const w = widthOf(c);
    const isActive = r === active.r && c === active.c;
    if (isActive && editing?.from === "cell") {
      return (
        <input
          key={`${r}:${c}`}
          data-editor=""
          autoFocus
          aria-label={`Edit ${a1(r, c)}`}
          value={editing.value}
          onChange={(e) => props.onEditChange(e.target.value)}
          onKeyDown={props.onEditKeyDown}
          className="absolute z-[3] border-0 bg-crm-bg px-1.5 text-[13px] text-crm-fg shadow-crm-raised outline-2 -outline-offset-2 outline-crm-primary"
          style={{ left: x, top: y, width: Math.max(w, 160), height: ROW_H }}
        />
      );
    }
    const text =
      isActive && editing
        ? editing.value
        : formatValue(engine.getValue(sheet.id, r, c), sheet.formats?.[cellKey(r, c)], currency);
    const v = isActive && editing ? editing.value : engine.getValue(sheet.id, r, c);
    const kind = isError(v)
      ? "error"
      : typeof v === "number"
        ? "num"
        : typeof v === "boolean"
          ? "bool"
          : "text";
    return (
      <Cell
        key={`${r}:${c}`}
        id={`${id}-${r}-${c}`}
        r={r}
        c={c}
        x={x}
        y={y}
        w={w}
        text={text}
        kind={kind}
        selected={inRange(selection, r, c)}
        active={isActive}
        filling={!!fillDest && inRange(fillDest, r, c) && !inRange(selection, r, c)}
        handle={!readOnly && r === handleCell.r2 && c === handleCell.c2}
        frozenEdge={fc > 0 && c === fc - 1}
      />
    );
  };
  const colHeader = (c: number, x: number) => {
    const on = c >= selection.c1 && c <= selection.c2;
    return (
      <div
        key={`h${c}`}
        role="columnheader"
        aria-colindex={c + 2}
        data-header="col"
        data-i={c}
        className={cn(
          "absolute top-0 flex items-center justify-center border-r border-b border-crm-border bg-crm-muted text-xs font-medium text-crm-muted-fg select-none",
          on && "bg-crm-primary/15 text-crm-fg",
        )}
        style={{ left: x, width: widthOf(c), height: HEADER_H }}
      >
        {colName(c)}
        {!readOnly && (
          <span
            data-resize={c}
            aria-hidden
            className="absolute top-0 right-[-3px] z-[1] h-full w-[6px] cursor-col-resize hover:bg-crm-primary/40"
          />
        )}
      </div>
    );
  };
  const rowHeader = (r: number, y: number) => {
    const on = r >= selection.r1 && r <= selection.r2;
    return (
      <div
        key={`r${r}`}
        role="rowheader"
        data-header="row"
        data-i={r}
        className={cn(
          "absolute left-0 flex items-center justify-end border-r border-b border-crm-border bg-crm-muted pr-2 text-xs text-crm-muted-fg tabular-nums select-none",
          on && "bg-crm-primary/15 text-crm-fg",
        )}
        style={{ top: y, width: HEADER_W, height: ROW_H }}
      >
        {r + 1}
      </div>
    );
  };

  const rows = rowVirt.getVirtualItems();
  const cols = colVirt.getVirtualItems();
  const frozenColList = Array.from({ length: fc }, (_, c) => c);
  const frozenRowList = Array.from({ length: fr }, (_, r) => r);

  // Body: scrolls both ways (content coordinates).
  const body = rows.map((ri) => {
    const r = fr + ri.index;
    return (
      <div role="row" aria-rowindex={r + 2} key={r} className="contents">
        {cols.map((ci) => cellEl(r, fc + ci.index, ci.start, ri.start))}
      </div>
    );
  });
  // Left layer: frozen columns + row headers, sticky horizontally.
  const left = rows.map((ri) => {
    const r = fr + ri.index;
    return (
      <div role="row" aria-rowindex={r + 2} key={r} className="contents">
        {rowHeader(r, ri.start)}
        {frozenColList.map((c) => cellEl(r, c, HEADER_W + colX[c]!, ri.start))}
      </div>
    );
  });
  // Top layer: column headers + frozen rows, sticky vertically.
  const top = (
    <>
      <div role="row" aria-rowindex={1} className="contents">
        {cols.map((ci) => colHeader(fc + ci.index, ci.start))}
      </div>
      {frozenRowList.map((r) => (
        <div role="row" aria-rowindex={r + 2} key={r} className="contents">
          {cols.map((ci) => cellEl(r, fc + ci.index, ci.start, HEADER_H + r * ROW_H))}
        </div>
      ))}
    </>
  );
  // Corner: select-all, frozen column headers, frozen row headers, frozen x frozen cells.
  const corner = (
    <>
      <div
        data-header="col"
        data-i={-1}
        role="columnheader"
        aria-label="Select all"
        className="absolute top-0 left-0 border-r border-b border-crm-border bg-crm-muted"
        style={{ width: HEADER_W, height: HEADER_H }}
      />
      {frozenColList.map((c) => colHeader(c, HEADER_W + colX[c]!))}
      {frozenRowList.map((r) => (
        <div role="row" aria-rowindex={r + 2} key={r} className="contents">
          {rowHeader(r, HEADER_H + r * ROW_H)}
          {frozenColList.map((c) => cellEl(r, c, HEADER_W + colX[c]!, HEADER_H + r * ROW_H))}
        </div>
      ))}
    </>
  );

  const activeVisible =
    (active.r < fr || rows.some((ri) => fr + ri.index === active.r)) &&
    (active.c < fc || cols.some((ci) => fc + ci.index === active.c));

  return (
    <div
      ref={scroller}
      role="grid"
      tabIndex={0}
      aria-label={`${sheet.name} cells`}
      aria-rowcount={sheet.rowCount + 1}
      aria-colcount={sheet.colCount + 1}
      aria-multiselectable
      aria-readonly={readOnly || undefined}
      aria-activedescendant={
        activeVisible && !editing ? `${id}-${active.r}-${active.c}` : undefined
      }
      aria-describedby={`${id}-status`}
      className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-crm-bg text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:ring-inset"
      onKeyDown={props.onKeyDown}
      onCopy={props.onCopy}
      onCut={props.onCut}
      onPaste={props.onPaste}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onDoubleClick={onDoubleClick}
    >
      <div className="relative" style={{ width: totalW, height: totalH }}>
        <div className="sticky top-0 left-0 z-[4] h-0 w-0">{corner}</div>
        <div className="sticky top-0 z-[3] h-0 w-0">{top}</div>
        <div className="sticky left-0 z-[2] h-0 w-0">{left}</div>
        {body}
      </div>
      <span id={`${id}-status`} className="sr-only" aria-live="polite">
        {`${a1(anchor.r, anchor.c)} selected`}
      </span>
    </div>
  );
});
