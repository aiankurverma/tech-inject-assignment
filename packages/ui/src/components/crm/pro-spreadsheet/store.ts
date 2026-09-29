import { produce, type Draft } from "immer";
import { createStore } from "zustand";
import { SpreadsheetEngine } from "@/components/crm/pro-spreadsheet/engine";

export type CellFormat = "general" | "number" | "currency" | "percent" | "date" | "text";

export interface SheetData {
  id: string;
  name: string;
  /** Sparse raw cell contents keyed "row:col". Formulas start with "=". */
  cells: Record<string, string>;
  /** Number formats keyed "row:col". */
  formats?: Record<string, CellFormat>;
  rowCount: number;
  colCount: number;
  frozenRows?: number;
  frozenCols?: number;
  /** Column widths in px keyed by column index. */
  colWidths?: Record<number, number>;
}

export interface WorkbookData {
  sheets: SheetData[];
  activeSheetId: string;
}

interface HistoryEntry {
  label: string;
  wb: WorkbookData;
}

export interface SpreadsheetState {
  wb: WorkbookData;
  engine: SpreadsheetEngine;
  /** Bumps whenever computed values may have changed (the engine is mutable). */
  calc: number;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Applies an undoable change through an immer recipe. */
  apply: (label: string, recipe: (draft: Draft<WorkbookData>) => void) => void;
  undo: () => void;
  redo: () => void;
  /** Replaces the workbook from outside (controlled `value`). */
  replace: (wb: WorkbookData, resetHistory?: boolean) => void;
  /** Switches the visible sheet without recording history. */
  setActive: (sheetId: string) => void;
}

const HISTORY_LIMIT = 200;

export function createSpreadsheetStore(initial: WorkbookData) {
  return createStore<SpreadsheetState>()((set, get) => {
    const swap = (next: WorkbookData, patch: Partial<SpreadsheetState>) => {
      const { wb, engine, calc } = get();
      if (next.sheets !== wb.sheets) engine.sync(wb.sheets, next.sheets);
      set({ ...patch, wb: next, calc: calc + 1 });
    };
    return {
      wb: initial,
      engine: new SpreadsheetEngine(initial.sheets),
      calc: 0,
      past: [],
      future: [],
      apply: (label, recipe) => {
        const { wb, past } = get();
        const next = produce(wb, recipe);
        if (next === wb) return;
        swap(next, { past: [...past.slice(-HISTORY_LIMIT + 1), { label, wb }], future: [] });
      },
      undo: () => {
        const { past, future, wb } = get();
        const entry = past[past.length - 1];
        if (!entry) return;
        swap(entry.wb, {
          past: past.slice(0, -1),
          future: [...future, { label: entry.label, wb }],
        });
      },
      redo: () => {
        const { past, future, wb } = get();
        const entry = future[future.length - 1];
        if (!entry) return;
        swap(entry.wb, {
          future: future.slice(0, -1),
          past: [...past, { label: entry.label, wb }],
        });
      },
      replace: (wb, resetHistory = false) => swap(wb, resetHistory ? { past: [], future: [] } : {}),
      setActive: (sheetId) => {
        const { wb } = get();
        if (wb.activeSheetId === sheetId) return;
        set({ wb: { ...wb, activeSheetId: sheetId } });
      },
    };
  });
}
