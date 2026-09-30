/**
 * Builder state: the page tree, selection and undo/redo history. The tree is the only part
 * persisted (localStorage); history and selection start fresh on reload.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  createPage,
  duplicateNode,
  findNode,
  findParent,
  insertNode,
  isPageNode,
  moveNode,
  removeNode,
  replaceProps,
  ROOT_ID,
  setProp,
  shiftNode,
} from "./tree";
import type { PageNode } from "./types";

export const STORAGE_KEY = "kitbase.builder.page";
const HISTORY_LIMIT = 100;
/** Keystrokes on the same prop within this window collapse into one undo step. */
const COALESCE_MS = 800;

export interface BuilderState {
  tree: PageNode;
  selectedId: string;
  past: PageNode[];
  future: PageNode[];
  select: (id: string) => void;
  insert: (parentId: string, node: PageNode, index?: number) => void;
  remove: (id: string) => void;
  move: (id: string, parentId: string, index: number) => void;
  shift: (id: string, delta: -1 | 1) => void;
  duplicate: (id: string) => void;
  setProp: (id: string, name: string, value: unknown) => void;
  replaceProps: (id: string, props: Record<string, unknown>) => void;
  /** Replaces the whole page (import JSON); invalid input is ignored. */
  load: (tree: unknown) => boolean;
  reset: () => void;
  undo: () => void;
  redo: () => void;
}

type Setter = (fn: (s: BuilderState) => Partial<BuilderState>) => void;

/** Last prop edit per store, so rapid edits of one field become a single undo step. */
interface Edits {
  last: { key: string; at: number } | null;
}

/**
 * Applies a tree change as one undoable step. Unchanged trees (rejected ops) leave history
 * alone; `coalesce` names a field whose repeated edits within COALESCE_MS share one step.
 */
function commit(
  set: Setter,
  edits: Edits,
  next: (tree: PageNode) => PageNode,
  after?: (s: BuilderState, tree: PageNode) => Partial<BuilderState>,
  coalesce?: string,
) {
  set((s) => {
    const tree = next(s.tree);
    if (tree === s.tree) return {};
    const now = Date.now();
    const merge =
      coalesce !== undefined && edits.last?.key === coalesce && now - edits.last.at < COALESCE_MS;
    edits.last = coalesce === undefined ? null : { key: coalesce, at: now };
    return {
      tree,
      past: merge ? s.past : [...s.past.slice(-(HISTORY_LIMIT - 1)), s.tree],
      future: [],
      ...(after ? after(s, tree) : {}),
    };
  });
}

/** Selection after a delete: previous sibling, else next, else the parent. */
function neighbour(tree: PageNode, id: string): string {
  const hit = findParent(tree, id);
  if (!hit) return ROOT_ID;
  const sib = hit.parent.children[hit.index - 1] ?? hit.parent.children[hit.index + 1];
  return sib?.id ?? hit.parent.id;
}

export const createBuilderStore = (storage?: Storage) => {
  const edits: Edits = { last: null };
  return create<BuilderState>()(
    persist(
      (set) => ({
        tree: createPage(),
        selectedId: ROOT_ID,
        past: [],
        future: [],
        select: (id) => set((s) => (findNode(s.tree, id) ? { selectedId: id } : {})),
        insert: (parentId, node, index) =>
          commit(
            set,
            edits,
            (t) => insertNode(t, parentId, node, index),
            () => ({ selectedId: node.id }),
          ),
        remove: (id) =>
          commit(
            set,
            edits,
            (t) => removeNode(t, id),
            (s) =>
              s.selectedId === id || !findNode(s.tree, s.selectedId)
                ? { selectedId: neighbour(s.tree, id) }
                : {},
          ),
        move: (id, parentId, index) => commit(set, edits, (t) => moveNode(t, id, parentId, index)),
        shift: (id, delta) => commit(set, edits, (t) => shiftNode(t, id, delta)),
        duplicate: (id) => {
          let copyId: string | null = null;
          commit(
            set,
            edits,
            (t) => {
              const r = duplicateNode(t, id);
              copyId = r.id;
              return r.tree;
            },
            () => (copyId ? { selectedId: copyId } : {}),
          );
        },
        setProp: (id, name, value) =>
          commit(set, edits, (t) => setProp(t, id, name, value), undefined, `${id}\u0000${name}`),
        replaceProps: (id, props) => commit(set, edits, (t) => replaceProps(t, id, props)),
        load: (tree) => {
          if (!isPageNode(tree) || tree.type !== "page") return false;
          commit(
            set,
            edits,
            () => tree,
            () => ({ selectedId: tree.id }),
          );
          return true;
        },
        reset: () =>
          commit(
            set,
            edits,
            () => createPage(),
            () => ({ selectedId: ROOT_ID }),
          ),
        undo: () => {
          edits.last = null;
          set((s) => {
            const prev = s.past[s.past.length - 1];
            if (!prev) return {};
            return {
              tree: prev,
              past: s.past.slice(0, -1),
              future: [s.tree, ...s.future],
              selectedId: findNode(prev, s.selectedId) ? s.selectedId : ROOT_ID,
            };
          });
        },
        redo: () => {
          edits.last = null;
          set((s) => {
            const next = s.future[0];
            if (!next) return {};
            return {
              tree: next,
              past: [...s.past, s.tree],
              future: s.future.slice(1),
              selectedId: findNode(next, s.selectedId) ? s.selectedId : ROOT_ID,
            };
          });
        },
      }),
      {
        name: STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() => storage ?? localStorage),
        partialize: (s) => ({ tree: s.tree }),
        merge: (persisted, current) => {
          const p = persisted as { tree?: unknown } | undefined;
          return isPageNode(p?.tree) && p.tree.type === "page"
            ? { ...current, tree: p.tree }
            : current;
        },
      },
    ),
  );
};

export const useBuilder = createBuilderStore();
