import * as React from "react";
import { useStore } from "zustand";
import { cn } from "@/lib/utils";
import {
  cellKey,
  normRange,
  type CellPos,
  type CellRange,
} from "@/components/crm/pro-spreadsheet/address";
import { renameSheetRefs, shiftFormula } from "@/components/crm/pro-spreadsheet/formula";
import {
  createSpreadsheetStore,
  type CellFormat,
  type SheetData,
  type WorkbookData,
} from "@/components/crm/pro-spreadsheet/store";
import {
  fillWrites,
  formatValue,
  parseTsv,
  rangeRows,
  toTsv,
} from "@/components/crm/pro-spreadsheet/operations";
import { Grid, type EditState, type GridHandle } from "@/components/crm/pro-spreadsheet/grid";
import { SheetTabs } from "@/components/crm/pro-spreadsheet/sheet-tabs";
import { FormulaBar, SpreadsheetToolbar } from "@/components/crm/pro-spreadsheet/toolbar";

export type { CellFormat, SheetData, WorkbookData } from "@/components/crm/pro-spreadsheet/store";
export type { CellValue } from "@/components/crm/pro-spreadsheet/functions";
export { FUNCTION_NAMES } from "@/components/crm/pro-spreadsheet/functions";
export { cellKey, colName, a1 } from "@/components/crm/pro-spreadsheet/address";

export interface ProSpreadsheetProps {
  /** Controlled workbook. Pair with `onChange`. */
  value?: WorkbookData;
  /** Initial workbook when uncontrolled. */
  defaultValue?: WorkbookData;
  /** Fires with the next workbook after every edit, undo, redo, sheet or format change. */
  onChange?: (workbook: WorkbookData) => void;
  onSelectionChange?: (range: CellRange, sheetId: string) => void;
  readOnly?: boolean;
  /** Shows a skeleton instead of the grid (e.g. while the workbook is fetched). */
  loading?: boolean;
  /** ISO currency for the currency format. */
  currency?: string;
  /** Total component height (any CSS length). */
  height?: number | string;
  className?: string;
}

const MAX_FORMAT_CELLS = 200_000;
const newSheet = (id: string, name: string): SheetData => ({
  id,
  name,
  cells: {},
  rowCount: 1000,
  colCount: 26,
});
const BLANK: WorkbookData = { sheets: [newSheet("sheet-1", "Sheet1")], activeSheetId: "sheet-1" };
const normalise = (wb: WorkbookData | undefined): WorkbookData =>
  wb && wb.sheets.length ? wb : BLANK;

export function ProSpreadsheet({
  value,
  defaultValue,
  onChange,
  onSelectionChange,
  readOnly = false,
  loading = false,
  currency = "USD",
  height = 560,
  className,
}: ProSpreadsheetProps) {
  const [store] = React.useState(() => createSpreadsheetStore(normalise(value ?? defaultValue)));
  const wb = useStore(store, (s) => s.wb);
  const engine = useStore(store, (s) => s.engine);
  const calc = useStore(store, (s) => s.calc);
  const canUndo = useStore(store, (s) => s.past.length > 0);
  const canRedo = useStore(store, (s) => s.future.length > 0);
  const gridId = React.useId().replace(/:/g, "");
  const gridRef = React.useRef<GridHandle>(null);

  // ---- controlled / uncontrolled sync ----
  const emitted = React.useRef<WorkbookData | undefined>(value);
  React.useEffect(() => {
    if (value && value !== emitted.current && value !== store.getState().wb) {
      emitted.current = value;
      store.getState().replace(normalise(value), true);
    }
  }, [value, store]);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  React.useEffect(() => {
    if (wb === emitted.current) return;
    emitted.current = wb;
    onChangeRef.current?.(wb);
  }, [wb]);

  const sheet = wb.sheets.find((s) => s.id === wb.activeSheetId) ?? wb.sheets[0]!;
  const [anchor, setAnchor] = React.useState<CellPos>({ r: 0, c: 0 });
  const [active, setActive] = React.useState<CellPos>({ r: 0, c: 0 });
  const [editing, setEditing] = React.useState<EditState | null>(null);
  const [fillDest, setFillDest] = React.useState<CellRange | null>(null);
  const selection = React.useMemo(() => normRange(anchor, active), [anchor, active]);
  const drag = React.useRef<"select" | "fill" | null>(null);
  const clip = React.useRef<{ text: string; range: CellRange; sheet: string } | null>(null);

  const onSelRef = React.useRef(onSelectionChange);
  onSelRef.current = onSelectionChange;
  React.useEffect(() => onSelRef.current?.(selection, sheet.id), [selection, sheet.id]);

  const clamp = React.useCallback(
    (p: CellPos): CellPos => ({
      r: Math.max(0, Math.min(sheet.rowCount - 1, p.r)),
      c: Math.max(0, Math.min(sheet.colCount - 1, p.c)),
    }),
    [sheet.rowCount, sheet.colCount],
  );
  const moveTo = (p: CellPos, extend = false) => {
    const next = clamp(p);
    if (!extend) setAnchor(next);
    setActive(next);
    gridRef.current?.scrollTo(next);
  };

  const raw = (r: number, c: number) => sheet.cells[cellKey(r, c)] ?? "";

  const write = (label: string, writes: Record<string, string>, grow?: CellPos) => {
    if (readOnly) return;
    store.getState().apply(label, (d) => {
      const s = d.sheets.find((x) => x.id === sheet.id);
      if (!s) return;
      for (const [k, v] of Object.entries(writes)) {
        if (v === "") delete s.cells[k];
        else if (s.cells[k] !== v) s.cells[k] = v;
      }
      if (grow) {
        if (grow.r >= s.rowCount) s.rowCount = grow.r + 1;
        if (grow.c >= s.colCount) s.colCount = grow.c + 1;
      }
    });
  };

  // ---- editing ----
  const startEdit = (initial: string | undefined, mode: EditState["mode"]) => {
    if (readOnly) return;
    setEditing({ value: initial ?? raw(active.r, active.c), mode, from: "cell" });
  };
  const commit = (dr: number, dc: number) => {
    if (!editing) return;
    const key = cellKey(active.r, active.c);
    if (editing.value !== raw(active.r, active.c)) write(`Edit ${key}`, { [key]: editing.value });
    setEditing(null);
    if (dr || dc) moveTo({ r: active.r + dr, c: active.c + dc });
    gridRef.current?.focus();
  };
  const cancel = () => {
    setEditing(null);
    gridRef.current?.focus();
  };
  const onEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commit(e.shiftKey ? -1 : 1, 0);
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit(0, e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (editing?.mode === "enter" && e.key.startsWith("Arrow")) {
      e.preventDefault();
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[
        e.key
      ] as [number, number];
      commit(d[0], d[1]);
    } else if (e.key === "F2" && editing) {
      setEditing({ ...editing, mode: editing.mode === "edit" ? "enter" : "edit" });
    }
  };

  // ---- range operations ----
  const forEachInSelection = (fn: (key: string) => void) => {
    let n = 0;
    for (let r = selection.r1; r <= selection.r2; r++)
      for (let c = selection.c1; c <= selection.c2; c++) {
        if (++n > MAX_FORMAT_CELLS) return;
        fn(cellKey(r, c));
      }
  };
  const clearSelection = () => {
    const writes: Record<string, string> = {};
    // Only touch populated cells: selecting a whole column must stay O(filled cells).
    for (const k of Object.keys(sheet.cells)) {
      const i = k.indexOf(":");
      const r = Number(k.slice(0, i));
      const c = Number(k.slice(i + 1));
      if (r >= selection.r1 && r <= selection.r2 && c >= selection.c1 && c <= selection.c2)
        writes[k] = "";
    }
    write("Clear", writes);
  };
  const setFormat = (f: CellFormat) =>
    store.getState().apply(`Format ${f}`, (d) => {
      const s = d.sheets.find((x) => x.id === sheet.id);
      if (!s) return;
      s.formats ??= {};
      const formats = s.formats;
      forEachInSelection((k) => {
        if (f === "general") delete formats[k];
        else formats[k] = f;
      });
    });
  const toggleFreeze = () =>
    store.getState().apply("Freeze panes", (d) => {
      const s = d.sheets.find((x) => x.id === sheet.id);
      if (!s) return;
      if (s.frozenRows || s.frozenCols) {
        s.frozenRows = 0;
        s.frozenCols = 0;
      } else if (active.r === 0 && active.c === 0) s.frozenRows = 1;
      else {
        s.frozenRows = active.r;
        s.frozenCols = active.c;
      }
    });

  const display = (r: number, c: number) =>
    formatValue(engine.getValue(sheet.id, r, c), sheet.formats?.[cellKey(r, c)], currency);

  const onCopy = (e: React.ClipboardEvent, cut = false) => {
    if (editing) return;
    e.preventDefault();
    const text = toTsv(rangeRows(selection, display));
    e.clipboardData.setData("text/plain", text);
    clip.current = { text, range: selection, sheet: sheet.id };
    if (cut) clearSelection();
  };
  const onPaste = (e: React.ClipboardEvent) => {
    if (editing || readOnly) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const origin = { r: selection.r1, c: selection.c1 };
    const writes: Record<string, string> = {};
    const internal = clip.current && clip.current.text === text ? clip.current : null;
    let maxR = origin.r;
    let maxC = origin.c;
    if (internal) {
      // Same-app paste keeps formulas, shifting relative references like Excel.
      const src = wb.sheets.find((s) => s.id === internal.sheet) ?? sheet;
      const g = internal.range;
      const dr = origin.r - g.r1;
      const dc = origin.c - g.c1;
      for (let r = g.r1; r <= g.r2; r++)
        for (let c = g.c1; c <= g.c2; c++) {
          writes[cellKey(r + dr, c + dc)] = shiftFormula(src.cells[cellKey(r, c)] ?? "", dr, dc);
          maxR = Math.max(maxR, r + dr);
          maxC = Math.max(maxC, c + dc);
        }
    } else {
      const rows = parseTsv(text);
      rows.forEach((row, i) =>
        row.forEach((v, j) => {
          writes[cellKey(origin.r + i, origin.c + j)] = v;
          maxR = Math.max(maxR, origin.r + i);
          maxC = Math.max(maxC, origin.c + j);
        }),
      );
    }
    write("Paste", writes, { r: maxR, c: maxC });
    setAnchor(origin);
    setActive(clamp({ r: maxR, c: maxC }));
  };

  // ---- keyboard ----
  const jump = (p: CellPos, dr: number, dc: number): CellPos => {
    // Ctrl+Arrow: jump to the edge of the current data block (Excel semantics).
    const filled = (r: number, c: number) => raw(r, c) !== "";
    let { r, c } = p;
    const inside = (rr: number, cc: number) =>
      rr >= 0 && cc >= 0 && rr < sheet.rowCount && cc < sheet.colCount;
    if (!inside(r + dr, c + dc)) return p;
    if (filled(r, c) && filled(r + dr, c + dc)) {
      while (inside(r + dr, c + dc) && filled(r + dr, c + dc)) {
        r += dr;
        c += dc;
      }
      return { r, c };
    }
    r += dr;
    c += dc;
    while (inside(r, c) && !filled(r, c) && inside(r + dr, c + dc)) {
      r += dr;
      c += dc;
    }
    return { r, c };
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    const arrows: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (arrows[k]) {
      const [dr, dc] = arrows[k]!;
      moveTo(mod ? jump(active, dr, dc) : { r: active.r + dr, c: active.c + dc }, e.shiftKey);
    } else if (k === "Tab") moveTo({ r: active.r, c: active.c + (e.shiftKey ? -1 : 1) });
    else if (k === "Enter") moveTo({ r: active.r + (e.shiftKey ? -1 : 1), c: active.c });
    else if (k === "Home") moveTo({ r: mod ? 0 : active.r, c: 0 }, e.shiftKey);
    else if (k === "End" && mod)
      moveTo({ r: sheet.rowCount - 1, c: sheet.colCount - 1 }, e.shiftKey);
    else if (k === "PageDown" || k === "PageUp") {
      const n = gridRef.current?.pageRows() ?? 20;
      moveTo({ r: active.r + (k === "PageDown" ? n : -n), c: active.c }, e.shiftKey);
    } else if (k === "F2") startEdit(undefined, "edit");
    else if (k === "Delete" || k === "Backspace") clearSelection();
    else if (mod && (k === "z" || k === "Z")) {
      if (readOnly) return;
      if (e.shiftKey) store.getState().redo();
      else store.getState().undo();
    } else if (mod && (k === "y" || k === "Y")) {
      if (!readOnly) store.getState().redo();
    } else if (mod && (k === "a" || k === "A")) {
      setAnchor({ r: 0, c: 0 });
      setActive({ r: sheet.rowCount - 1, c: sheet.colCount - 1 });
    } else if (!mod && !e.altKey && k.length === 1) {
      startEdit(k, "enter");
    } else if (k === "Escape") setAnchor(active);
    else return;
    e.preventDefault();
  };

  // ---- pointer ----
  React.useEffect(() => {
    const up = () => {
      if (drag.current === "fill" && fillDest) {
        write("Fill", fillWrites(selection, fillDest, raw));
        setAnchor({ r: fillDest.r1, c: fillDest.c1 });
        setActive({ r: fillDest.r2, c: fillDest.c2 });
      }
      drag.current = null;
      setFillDest(null);
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  });

  const onCellPointerDown = (pos: CellPos, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (editing) commit(0, 0);
    drag.current = "select";
    moveTo(pos, e.shiftKey);
    gridRef.current?.focus();
  };
  const onCellPointerEnter = (pos: CellPos) => {
    if (drag.current === "select") setActive(pos);
    else if (drag.current === "fill") {
      const g = selection;
      const down = pos.r > g.r2 ? pos.r - g.r2 : pos.r < g.r1 ? g.r1 - pos.r : 0;
      const across = pos.c > g.c2 ? pos.c - g.c2 : pos.c < g.c1 ? g.c1 - pos.c : 0;
      if (!down && !across) setFillDest(null);
      else if (down >= across)
        setFillDest({ ...g, r1: Math.min(g.r1, pos.r), r2: Math.max(g.r2, pos.r) });
      else setFillDest({ ...g, c1: Math.min(g.c1, pos.c), c2: Math.max(g.c2, pos.c) });
    }
  };
  const onHeaderSelect = (kind: "row" | "col", i: number, extend: boolean) => {
    if (editing) commit(0, 0);
    gridRef.current?.focus();
    if (i < 0) {
      setAnchor({ r: 0, c: 0 });
      setActive({ r: sheet.rowCount - 1, c: sheet.colCount - 1 });
    } else if (kind === "row") {
      if (!extend) setAnchor({ r: i, c: 0 });
      setActive({ r: i, c: sheet.colCount - 1 });
    } else {
      if (!extend) setAnchor({ r: 0, c: i });
      setActive({ r: sheet.rowCount - 1, c: i });
    }
  };
  const resizeColumn = (c: number, w: number) =>
    store.getState().apply(`Resize ${c}`, (d) => {
      const s = d.sheets.find((x) => x.id === sheet.id);
      if (s) (s.colWidths ??= {})[c] = w;
    });

  // ---- sheets ----
  const activate = (id: string) => {
    setEditing(null);
    store.getState().setActive(id);
    setAnchor({ r: 0, c: 0 });
    setActive({ r: 0, c: 0 });
  };
  const addSheet = () => {
    let n = wb.sheets.length + 1;
    while (wb.sheets.some((s) => s.name.toLowerCase() === `sheet${n}`)) n++;
    const id = `sheet-${Date.now().toString(36)}`;
    store.getState().apply("Add sheet", (d) => {
      d.sheets.push(newSheet(id, `Sheet${n}`));
    });
    activate(id);
  };
  const renameSheet = (id: string, name: string) =>
    store.getState().apply("Rename sheet", (d) => {
      const s = d.sheets.find((x) => x.id === id);
      if (!s) return;
      const old = s.name;
      s.name = name;
      // Keep Sheet!A1 references pointing at the renamed sheet, like Excel.
      for (const other of d.sheets)
        for (const [k, v] of Object.entries(other.cells)) {
          const next = renameSheetRefs(v, old, name);
          if (next !== v) other.cells[k] = next;
        }
    });
  const removeSheet = (id: string) => {
    const idx = wb.sheets.findIndex((s) => s.id === id);
    store.getState().apply("Delete sheet", (d) => {
      d.sheets.splice(idx, 1);
    });
    if (id === sheet.id) activate(wb.sheets[idx === 0 ? 1 : idx - 1]!.id);
  };

  const activeFormat = sheet.formats?.[cellKey(active.r, active.c)] ?? "general";

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg text-crm-fg shadow-crm-raised",
        className,
      )}
      style={{ height }}
      aria-busy={loading}
    >
      <SpreadsheetToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => store.getState().undo()}
        onRedo={() => store.getState().redo()}
        format={activeFormat}
        onFormat={setFormat}
        frozen={!!(sheet.frozenRows || sheet.frozenCols)}
        onToggleFreeze={toggleFreeze}
        readOnly={readOnly || loading}
      />
      <FormulaBar
        selection={selection}
        raw={raw(active.r, active.c)}
        editing={editing}
        readOnly={readOnly || loading}
        onFocus={() => {
          if (!readOnly && !editing)
            setEditing({ value: raw(active.r, active.c), mode: "edit", from: "bar" });
          else if (editing) setEditing({ ...editing, from: "bar" });
        }}
        onChange={(v) => setEditing((ed) => ({ value: v, mode: "edit", from: ed?.from ?? "bar" }))}
        onKeyDown={onEditKeyDown}
      />
      {loading ? (
        <div className="flex-1 space-y-2 p-4" role="status" aria-label="Loading spreadsheet">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="h-5 animate-pulse rounded bg-crm-muted"
              style={{ opacity: 1 - i / 14 }}
            />
          ))}
        </div>
      ) : (
        <SheetTabs
          sheets={wb.sheets}
          activeId={sheet.id}
          readOnly={readOnly}
          onActivate={activate}
          onAdd={addSheet}
          onRename={renameSheet}
          onRemove={removeSheet}
        >
          <Grid
            ref={gridRef}
            id={gridId}
            sheet={sheet}
            engine={engine}
            calc={calc}
            anchor={anchor}
            active={active}
            selection={selection}
            fillDest={fillDest}
            editing={editing}
            readOnly={readOnly}
            currency={currency}
            onKeyDown={onKeyDown}
            onCopy={(e) => onCopy(e)}
            onCut={(e) => (readOnly ? onCopy(e) : onCopy(e, true))}
            onPaste={onPaste}
            onCellPointerDown={onCellPointerDown}
            onCellPointerEnter={onCellPointerEnter}
            onCellDoubleClick={() => startEdit(undefined, "edit")}
            onHeaderSelect={onHeaderSelect}
            onFillStart={() => {
              drag.current = "fill";
            }}
            onEditChange={(v) => setEditing((ed) => (ed ? { ...ed, value: v } : ed))}
            onEditKeyDown={onEditKeyDown}
            onColumnResize={resizeColumn}
          />
        </SheetTabs>
      )}
    </div>
  );
}
