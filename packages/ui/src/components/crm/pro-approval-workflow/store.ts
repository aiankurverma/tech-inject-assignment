import { createStore } from "zustand";
import { produce, type Draft } from "immer";
import type { Workflow } from "@/components/crm/pro-approval-workflow/types";

const HISTORY_LIMIT = 100;

export interface WorkflowState {
  workflow: Workflow;
  past: Workflow[];
  future: Workflow[];
  selectedId: string | null;
  /** Mutates the workflow through an immer draft and records an undo entry. */
  edit: (recipe: (draft: Draft<Workflow>) => void) => void;
  /** Replaces the workflow (import / controlled sync). `record` adds an undo entry. */
  replace: (wf: Workflow, record?: boolean) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
}

export type WorkflowStore = ReturnType<typeof createWorkflowStore>;

/** One store per builder instance (not a module singleton), so several builders can coexist. */
export function createWorkflowStore(initial: Workflow) {
  return createStore<WorkflowState>()((set, get) => ({
    workflow: initial,
    past: [],
    future: [],
    selectedId: null,
    edit: (recipe) => {
      const prev = get().workflow;
      const next = produce(prev, recipe);
      if (next === prev) return;
      set({ workflow: next, past: [...get().past, prev].slice(-HISTORY_LIMIT), future: [] });
    },
    replace: (wf, record = false) =>
      set((s) =>
        record
          ? { workflow: wf, past: [...s.past, s.workflow].slice(-HISTORY_LIMIT), future: [] }
          : { workflow: wf },
      ),
    undo: () => {
      const { past, workflow, future } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      set({ workflow: prev, past: past.slice(0, -1), future: [workflow, ...future] });
    },
    redo: () => {
      const { past, workflow, future } = get();
      const next = future[0];
      if (!next) return;
      set({ workflow: next, past: [...past, workflow], future: future.slice(1) });
    },
    select: (id) => set({ selectedId: id }),
  }));
}
