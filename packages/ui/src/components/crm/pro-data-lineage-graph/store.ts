import { createStore } from "zustand";
import {
  colKey,
  edgeKey,
  type ColumnRef,
  type LineageDataset,
  type LineageDirection,
  type LineageEdge,
  type LineagePage,
} from "@/components/crm/pro-data-lineage-graph/types";

export interface LineageState {
  datasets: Record<string, LineageDataset>;
  edges: Record<string, LineageEdge>;
  /** Directions already fetched per node ("id:upstream"). */
  expanded: Record<string, true>;
  loading: Record<string, true>;
  errors: Record<string, string>;
  /** Nodes whose column list is open. */
  openColumns: Record<string, true>;
  selectedId: string | null;
  focusId: string | null;
  selectedColumn: ColumnRef | null;
  /** Bumped whenever the node/edge set changes, used as a cheap layout cache key. */
  graphVersion: number;
  /** Nodes / columns lit by focus mode or a column trace; null means "everything". */
  litNodes: Set<string> | null;
  litColumns: Set<string> | null;
  setLit: (nodes: Set<string> | null, columns: Set<string> | null) => void;
  merge: (page: LineagePage) => void;
  markExpanded: (id: string, dir: LineageDirection) => void;
  setLoading: (id: string, dir: LineageDirection, on: boolean) => void;
  setError: (id: string, dir: LineageDirection, message: string | null) => void;
  toggleColumns: (id: string, open?: boolean) => void;
  select: (id: string | null) => void;
  focus: (id: string | null) => void;
  selectColumn: (ref: ColumnRef | null) => void;
  reset: () => void;
}

export const dirKey = (id: string, dir: LineageDirection) => `${id}:${dir}`;

const empty = {
  datasets: {},
  edges: {},
  expanded: {},
  loading: {},
  errors: {},
  openColumns: {},
  selectedId: null,
  focusId: null,
  selectedColumn: null,
  graphVersion: 0,
  litNodes: null,
  litColumns: null,
};

export function createLineageStore() {
  return createStore<LineageState>()((set) => ({
    ...empty,
    merge: (page) =>
      set((s) => {
        let changed = false;
        const datasets = { ...s.datasets };
        for (const n of page.nodes) {
          const prev = datasets[n.id];
          if (!prev) changed = true;
          datasets[n.id] = prev ? { ...prev, ...n } : n;
        }
        const edges = { ...s.edges };
        for (const e of page.edges) {
          const k = edgeKey(e.source, e.target);
          if (!edges[k]) changed = true;
          edges[k] = e;
        }
        return { datasets, edges, graphVersion: changed ? s.graphVersion + 1 : s.graphVersion };
      }),
    markExpanded: (id, dir) =>
      set((s) => ({ expanded: { ...s.expanded, [dirKey(id, dir)]: true } })),
    setLoading: (id, dir, on) =>
      set((s) => {
        const loading = { ...s.loading };
        if (on) loading[dirKey(id, dir)] = true;
        else delete loading[dirKey(id, dir)];
        return { loading };
      }),
    setError: (id, dir, message) =>
      set((s) => {
        const errors = { ...s.errors };
        if (message) errors[dirKey(id, dir)] = message;
        else delete errors[dirKey(id, dir)];
        return { errors };
      }),
    toggleColumns: (id, open) =>
      set((s) => {
        const openColumns = { ...s.openColumns };
        const next = open ?? !openColumns[id];
        if (next) openColumns[id] = true;
        else delete openColumns[id];
        return { openColumns, graphVersion: s.graphVersion + 1 };
      }),
    select: (selectedId) => set({ selectedId }),
    focus: (focusId) => set({ focusId }),
    selectColumn: (selectedColumn) => set({ selectedColumn }),
    setLit: (litNodes, litColumns) => set({ litNodes, litColumns }),
    reset: () => set({ ...empty }),
  }));
}

export type LineageStore = ReturnType<typeof createLineageStore>;

/** Adjacency built once per graph version: O(V + E). */
export interface LineageIndex {
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
  colUp: Map<string, string[]>;
  colDown: Map<string, string[]>;
}

export function buildIndex(edges: Record<string, LineageEdge>): LineageIndex {
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const colUp = new Map<string, string[]>();
  const colDown = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string) => {
    const list = m.get(k);
    if (list) list.push(v);
    else m.set(k, [v]);
  };
  for (const e of Object.values(edges)) {
    push(parents, e.target, e.source);
    push(children, e.source, e.target);
    for (const c of e.columns ?? []) {
      push(colUp, colKey(e.target, c.to), colKey(e.source, c.from));
      push(colDown, colKey(e.source, c.from), colKey(e.target, c.to));
    }
  }
  return { parents, children, colUp, colDown };
}

/** Breadth-first walk in one direction; returns every reachable key including the start. */
export function walk(start: string, next: Map<string, string[]>, into = new Set<string>()) {
  const queue = [start];
  into.add(start);
  for (let i = 0; i < queue.length; i++) {
    for (const n of next.get(queue[i]!) ?? []) {
      if (!into.has(n)) {
        into.add(n);
        queue.push(n);
      }
    }
  }
  return into;
}
