import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { Immer } from "immer";
import { createStore } from "zustand";
import type {
  NodeDefinition,
  WorkflowEdge,
  WorkflowJSON,
  WorkflowNode,
} from "@/components/crm/pro-workflow-builder/types";

type Snapshot = { nodes: WorkflowNode[]; edges: WorkflowEdge[] };

export interface WorkflowState extends Snapshot {
  name: string;
  past: Snapshot[];
  future: Snapshot[];
  /** Bumps on every committed (history-worthy) change; drives onChange. */
  revision: number;
  selectedId: string | null;
  lastKey: string | null;
  lastAt: number;

  checkpoint: (key?: string) => void;
  commit: () => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
  connect: (c: Connection) => void;
  addNode: (def: NodeDefinition, position: XYPosition) => string;
  duplicate: (id: string) => void;
  remove: (ids: string[]) => void;
  updateConfig: (id: string, key: string, value: unknown) => void;
  rename: (id: string, label: string) => void;
  setName: (name: string) => void;
  select: (id: string | null) => void;
  setPositions: (positions: Map<string, XYPosition>) => void;
  undo: () => void;
  redo: () => void;
  load: (wf: WorkflowJSON) => void;
}

// Local Immer instance: no auto-freeze, because xyflow node objects flow back into the canvas.
const { produce } = new Immer({ autoFreeze: false });

const HISTORY_LIMIT = 100;
const COALESCE_MS = 700;

let counter = 0;
export const nodeId = () => `n_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export function fromJSON(wf: WorkflowJSON, defs: ReadonlyMap<string, NodeDefinition>): Snapshot {
  return {
    nodes: wf.nodes.map((n) => ({
      id: n.id,
      type: "workflow",
      position: n.position,
      data: {
        defType: n.type,
        label: n.label ?? defs.get(n.type)?.label ?? n.type,
        config: n.config ?? {},
      },
    })),
    edges: wf.edges.map((e) => ({ ...e })),
  };
}

export function toJSON(
  name: string,
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
): WorkflowJSON {
  return {
    version: 1,
    name,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.defType,
      label: n.data.label,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      config: n.data.config,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle ?? "",
      target: e.target,
      targetHandle: e.targetHandle ?? "",
    })),
  };
}

/**
 * One store per builder instance (zustand vanilla store + immer for nested
 * config edits). History stores whole snapshots; xyflow nodes are immutable so
 * snapshots share structure and stay cheap.
 */
export function createWorkflowStore(
  initial: WorkflowJSON,
  defs: ReadonlyMap<string, NodeDefinition>,
) {
  const snap = fromJSON(initial, defs);
  return createStore<WorkflowState>()((set, get) => ({
    ...snap,
    name: initial.name,
    past: [],
    future: [],
    revision: 0,
    selectedId: null,
    lastKey: null,
    lastAt: 0,

    checkpoint: (key) => {
      const s = get();
      const now = Date.now();
      if (key && key === s.lastKey && now - s.lastAt < COALESCE_MS) {
        set({ lastAt: now });
        return;
      }
      set({
        past: [...s.past.slice(-(HISTORY_LIMIT - 1)), { nodes: s.nodes, edges: s.edges }],
        future: [],
        lastKey: key ?? null,
        lastAt: now,
      });
    },
    commit: () => set((s) => ({ revision: s.revision + 1 })),

    onNodesChange: (changes) => {
      if (changes.some((c) => c.type === "remove")) get().checkpoint("remove");
      const selected = changes.find((c) => c.type === "select");
      const removed = changes.some((c) => c.type === "remove");
      set((s) => ({
        nodes: applyNodeChanges(changes, s.nodes),
        selectedId:
          selected && selected.type === "select"
            ? selected.selected
              ? selected.id
              : s.selectedId === selected.id
                ? null
                : s.selectedId
            : removed && changes.some((c) => c.type === "remove" && c.id === s.selectedId)
              ? null
              : s.selectedId,
      }));
      if (removed) get().commit();
    },
    onEdgesChange: (changes) => {
      const removed = changes.some((c) => c.type === "remove");
      if (removed) get().checkpoint("remove");
      set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }));
      if (removed) get().commit();
    },
    connect: (c) => {
      get().checkpoint();
      set((s) => ({
        edges: addEdge(
          { ...c, id: `e_${c.source}_${c.sourceHandle}_${c.target}_${c.targetHandle}` },
          s.edges,
        ),
      }));
      get().commit();
    },
    addNode: (def, position) => {
      get().checkpoint();
      const id = nodeId();
      set((s) => ({
        nodes: [
          ...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
          {
            id,
            type: "workflow",
            position,
            selected: true,
            data: { defType: def.type, label: def.label, config: { ...(def.defaults ?? {}) } },
          },
        ],
        selectedId: id,
      }));
      get().commit();
      return id;
    },
    duplicate: (id) => {
      const src = get().nodes.find((n) => n.id === id);
      if (!src) return;
      get().checkpoint();
      const copy: WorkflowNode = {
        id: nodeId(),
        type: "workflow",
        position: { x: src.position.x + 40, y: src.position.y + 40 },
        selected: true,
        data: structuredClone({ ...src.data, label: `${src.data.label} copy` }),
      };
      set((s) => ({
        nodes: [...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), copy],
        selectedId: copy.id,
      }));
      get().commit();
    },
    remove: (ids) => {
      if (!ids.length) return;
      get().checkpoint();
      const drop = new Set(ids);
      set((s) => ({
        nodes: s.nodes.filter((n) => !drop.has(n.id)),
        edges: s.edges.filter((e) => !drop.has(e.source) && !drop.has(e.target)),
        selectedId: s.selectedId && drop.has(s.selectedId) ? null : s.selectedId,
      }));
      get().commit();
    },
    updateConfig: (id, key, value) => {
      get().checkpoint(`cfg:${id}:${key}`);
      set(
        produce<WorkflowState>((s) => {
          const n = s.nodes.find((x) => x.id === id);
          if (n) n.data.config[key] = value;
        }),
      );
      get().commit();
    },
    rename: (id, label) => {
      get().checkpoint(`label:${id}`);
      set(
        produce<WorkflowState>((s) => {
          const n = s.nodes.find((x) => x.id === id);
          if (n) n.data.label = label;
        }),
      );
      get().commit();
    },
    setName: (name) => {
      set({ name });
      get().commit();
    },
    select: (id) =>
      set((s) => ({
        selectedId: id,
        nodes: s.nodes.map((n) =>
          n.selected === (n.id === id) ? n : { ...n, selected: n.id === id },
        ),
      })),
    setPositions: (positions) => {
      get().checkpoint();
      set((s) => ({
        nodes: s.nodes.map((n) => {
          const p = positions.get(n.id);
          return p ? { ...n, position: p } : n;
        }),
      }));
      get().commit();
    },
    undo: () => {
      const s = get();
      const prev = s.past.at(-1);
      if (!prev) return;
      set({
        nodes: prev.nodes,
        edges: prev.edges,
        past: s.past.slice(0, -1),
        future: [{ nodes: s.nodes, edges: s.edges }, ...s.future],
        lastKey: null,
      });
      get().commit();
    },
    redo: () => {
      const s = get();
      const next = s.future[0];
      if (!next) return;
      set({
        nodes: next.nodes,
        edges: next.edges,
        past: [...s.past, { nodes: s.nodes, edges: s.edges }],
        future: s.future.slice(1),
        lastKey: null,
      });
      get().commit();
    },
    load: (wf) => {
      const next = fromJSON(wf, defs);
      set({ ...next, name: wf.name, past: [], future: [], selectedId: null, lastKey: null });
    },
  }));
}

export type WorkflowStore = ReturnType<typeof createWorkflowStore>;
