import { createStore, type StoreApi } from "zustand";
import { produce, type Draft } from "immer";
import type {
  DashboardConfig,
  WidgetConfig,
  WidgetType,
} from "@/components/crm/pro-dashboard-builder/schema";
import { emptyQuery, uid } from "@/components/crm/pro-dashboard-builder/schema";

const HISTORY_LIMIT = 100;
const COALESCE_MS = 800;

export interface DashboardState {
  present: DashboardConfig;
  past: DashboardConfig[];
  future: DashboardConfig[];
  /** Bumped when layout sizes change from outside a drag (undo, import) so panel groups remount. */
  layoutRev: number;
  selectedId: string | null;
  lastKey: string | null;
  lastAt: number;
  /** Apply an immer recipe as one undoable step. Same `key` within 800ms coalesces (typing). */
  apply: (recipe: (d: Draft<DashboardConfig>) => void, key?: string, layout?: boolean) => void;
  replace: (next: DashboardConfig, resetHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  addWidget: (type: WidgetType, defaults: Partial<WidgetConfig>) => string;
  removeWidget: (id: string) => void;
  duplicateWidget: (id: string) => void;
  moveWidget: (id: string, dir: -1 | 1) => void;
}

const even = (n: number) => Math.round((100 / n) * 100) / 100;

export function createDashboardStore(initial: DashboardConfig): StoreApi<DashboardState> {
  return createStore<DashboardState>()((set, get) => ({
    present: initial,
    past: [],
    future: [],
    layoutRev: 0,
    selectedId: null,
    lastKey: null,
    lastAt: 0,
    apply(recipe, key, layout) {
      const s = get();
      const next = produce(s.present, recipe);
      if (next === s.present) return;
      const now = Date.now();
      const coalesce = key != null && key === s.lastKey && now - s.lastAt < COALESCE_MS;
      set({
        present: next,
        past: coalesce ? s.past : [...s.past, s.present].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: key ?? null,
        lastAt: now,
        layoutRev: layout ? s.layoutRev + 1 : s.layoutRev,
      });
    },
    replace(next, resetHistory) {
      const s = get();
      set({
        present: next,
        past: resetHistory ? [] : [...s.past, s.present].slice(-HISTORY_LIMIT),
        future: [],
        layoutRev: s.layoutRev + 1,
        lastKey: null,
        selectedId: s.selectedId && next.widgets[s.selectedId] ? s.selectedId : null,
      });
    },
    undo() {
      const s = get();
      const prev = s.past[s.past.length - 1];
      if (!prev) return;
      set({
        present: prev,
        past: s.past.slice(0, -1),
        future: [s.present, ...s.future],
        layoutRev: s.layoutRev + 1,
        lastKey: null,
        selectedId: s.selectedId && prev.widgets[s.selectedId] ? s.selectedId : null,
      });
    },
    redo() {
      const s = get();
      const next = s.future[0];
      if (!next) return;
      set({
        present: next,
        past: [...s.past, s.present],
        future: s.future.slice(1),
        layoutRev: s.layoutRev + 1,
        lastKey: null,
        selectedId: s.selectedId && next.widgets[s.selectedId] ? s.selectedId : null,
      });
    },
    select: (id) => set({ selectedId: id }),
    addWidget(type, defaults) {
      const id = uid("w");
      get().apply(
        (d) => {
          d.widgets[id] = {
            id,
            type,
            title: defaults.title ?? "New widget",
            agg: "sum",
            format: "number",
            ...defaults,
            query: defaults.query ?? emptyQuery(),
          } as Draft<WidgetConfig>;
          let row = d.rows[d.rows.length - 1];
          if (!row || row.widgets.length >= 4) {
            row = { id: uid("r"), size: 0, widgets: [] };
            d.rows.push(row);
            const h = even(d.rows.length);
            d.rows.forEach((r) => (r.size = h));
          }
          row.widgets.push({ id, size: 0 });
          const w = even(row.widgets.length);
          row.widgets.forEach((c) => (c.size = w));
        },
        undefined,
        true,
      );
      set({ selectedId: id });
      return id;
    },
    removeWidget(id) {
      get().apply(
        (d) => {
          delete d.widgets[id];
          for (const row of d.rows) {
            const before = row.widgets.length;
            row.widgets = row.widgets.filter((c) => c.id !== id);
            if (row.widgets.length !== before && row.widgets.length) {
              const w = even(row.widgets.length);
              row.widgets.forEach((c) => (c.size = w));
            }
          }
          const kept = d.rows.filter((r) => r.widgets.length);
          if (kept.length !== d.rows.length) {
            d.rows = kept;
            const h = even(Math.max(1, kept.length));
            d.rows.forEach((r) => (r.size = h));
          }
        },
        undefined,
        true,
      );
      if (get().selectedId === id) set({ selectedId: null });
    },
    duplicateWidget(id) {
      const src = get().present.widgets[id];
      if (!src) return;
      const { id: _omit, ...rest } = src;
      void _omit;
      get().addWidget(src.type, { ...structuredClone(rest), title: `${src.title} (copy)` });
    },
    moveWidget(id, dir) {
      get().apply(
        (d) => {
          const r = d.rows.findIndex((row) => row.widgets.some((c) => c.id === id));
          const src = d.rows[r];
          if (!src) return;
          const cells = src.widgets;
          const i = cells.findIndex((c) => c.id === id);
          const j = i + dir;
          if (j >= 0 && j < cells.length) {
            [cells[i], cells[j]] = [cells[j]!, cells[i]!];
            return;
          }
          const target = d.rows[r + dir];
          if (!target || target.widgets.length >= 6) return;
          const [cell] = cells.splice(i, 1);
          if (!cell) return;
          if (dir > 0) target.widgets.unshift(cell);
          else target.widgets.push(cell);
          for (const row of [src, target]) {
            if (!row.widgets.length) continue;
            const w = even(row.widgets.length);
            row.widgets.forEach((c) => (c.size = w));
          }
          if (!src.widgets.length) {
            d.rows.splice(r, 1);
            const h = even(d.rows.length);
            d.rows.forEach((row) => (row.size = h));
          }
        },
        undefined,
        true,
      );
    },
  }));
}
