import * as React from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import { produce } from "immer";
import { addDays } from "date-fns";
import { autoSchedule, buildHierarchy, toDate } from "@/lib/gantt-schedule";
import type { GanttTask, GanttZoom } from "@/components/crm/pro-gantt-roadmap/types";

export type DragMode = "move" | "start" | "end";

export interface GanttState {
  tasks: GanttTask[];
  collapsed: Set<string>;
  zoom: GanttZoom;
  selectedId: string | null;
  showCritical: boolean;
  showBaseline: boolean;
  /** Transient drag preview so pointermove never rewrites the task array. */
  preview: { id: string; ds: number; de: number } | null;
  hoverId: string | null;
  setTasks: (t: GanttTask[]) => void;
  toggle: (id: string, open?: boolean) => void;
  setZoom: (z: GanttZoom) => void;
  select: (id: string | null) => void;
  setHover: (id: string | null) => void;
  setPreview: (p: GanttState["preview"]) => void;
  setFlag: (k: "showCritical" | "showBaseline", v: boolean) => void;
  /** Apply a day delta to start/end, auto-schedule successors, return the new array. */
  commit: (id: string, ds: number, de: number) => GanttTask[] | null;
}

export interface GanttStoreInit {
  tasks: GanttTask[];
  zoom?: GanttZoom;
  collapsed?: string[];
  showCritical?: boolean;
  showBaseline?: boolean;
  autoSchedule?: boolean;
}

export function createGanttStore(init: GanttStoreInit) {
  return createStore<GanttState>()((set, get) => ({
    tasks: init.tasks,
    collapsed: new Set(init.collapsed ?? []),
    zoom: init.zoom ?? "week",
    selectedId: null,
    showCritical: init.showCritical ?? true,
    showBaseline: init.showBaseline ?? false,
    preview: null,
    hoverId: null,
    setTasks: (tasks) => set({ tasks }),
    toggle: (id, open) =>
      set((s) => {
        const want = open ?? s.collapsed.has(id);
        if (want === !s.collapsed.has(id)) return s;
        const collapsed = new Set(s.collapsed);
        if (want) collapsed.delete(id);
        else collapsed.add(id);
        return { collapsed };
      }),
    setZoom: (zoom) => set({ zoom }),
    select: (selectedId) => set({ selectedId }),
    setHover: (hoverId) => set({ hoverId }),
    setPreview: (preview) => set({ preview }),
    setFlag: (k, v) => set({ [k]: v } as Pick<GanttState, typeof k>),
    commit: (id, ds, de) => {
      if (!ds && !de) {
        set({ preview: null });
        return null;
      }
      const { tasks } = get();
      let next = produce(tasks, (draft) => {
        const t = draft.find((x) => x.id === id);
        if (!t) return;
        const s = addDays(toDate(t.start), ds);
        let e = addDays(toDate(t.end), de);
        if (!t.milestone && e <= s) e = addDays(s, 1);
        if (t.milestone) e = s;
        t.start = s;
        t.end = e;
      });
      if (init.autoSchedule !== false) next = autoSchedule(next, buildHierarchy(next).summaryIds);
      set({ tasks: next, preview: null });
      return next;
    },
  }));
}

export type GanttStore = StoreApi<GanttState>;

export const GanttStoreContext = React.createContext<GanttStore | null>(null);

export function useGantt<T>(selector: (s: GanttState) => T): T {
  const store = React.useContext(GanttStoreContext);
  if (!store) throw new Error("useGantt must be used inside <ProGanttRoadmap>");
  return useStore(store, selector);
}

export function useGanttApi() {
  const store = React.useContext(GanttStoreContext);
  if (!store) throw new Error("useGanttApi must be used inside <ProGanttRoadmap>");
  return store;
}
