import * as React from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import type { LineageMode, ResolvedRelation } from "@/components/crm/pro-schema-erd/types";

export interface ErdState {
  focusedId: string | null;
  mode: LineageMode;
  depth: number;
  /** Tables and relation ids on the focused table's lineage; null = nothing focused. */
  nodes: Set<string> | null;
  edges: Set<string> | null;
  matches: Set<string>;
  relations: ResolvedRelation[];
  setRelations: (r: ResolvedRelation[]) => void;
  focus: (id: string | null) => void;
  setMode: (m: LineageMode) => void;
  setDepth: (d: number) => void;
  setMatches: (ids: Set<string>) => void;
}

/** BFS over relations: upstream follows FK -> referenced table, downstream the reverse. */
export function lineage(
  relations: ResolvedRelation[],
  start: string,
  mode: LineageMode,
  depth: number,
) {
  const nodes = new Set([start]);
  const edges = new Set<string>();
  const walk = (dir: "up" | "down") => {
    let frontier = [start];
    const seen = new Set([start]);
    for (let d = 0; d < depth && frontier.length; d++) {
      const next: string[] = [];
      const set = new Set(frontier);
      for (const r of relations) {
        const [a, b] = dir === "up" ? [r.from.table, r.to.table] : [r.to.table, r.from.table];
        if (!set.has(a)) continue;
        edges.add(r.id);
        nodes.add(b);
        if (!seen.has(b)) {
          seen.add(b);
          next.push(b);
        }
      }
      frontier = next;
    }
  };
  if (mode !== "downstream") walk("up");
  if (mode !== "upstream") walk("down");
  return { nodes, edges };
}

export function createErdStore(init: { mode: LineageMode; depth: number }) {
  return createStore<ErdState>()((set, get) => {
    const recompute = (patch: Partial<ErdState>) => {
      const s = { ...get(), ...patch };
      if (!s.focusedId) return set({ ...patch, nodes: null, edges: null });
      const l = lineage(s.relations, s.focusedId, s.mode, s.depth);
      set({ ...patch, nodes: l.nodes, edges: l.edges });
    };
    return {
      focusedId: null,
      mode: init.mode,
      depth: init.depth,
      nodes: null,
      edges: null,
      matches: new Set(),
      relations: [],
      setRelations: (relations) => recompute({ relations }),
      focus: (focusedId) => recompute({ focusedId }),
      setMode: (mode) => recompute({ mode }),
      setDepth: (depth) => recompute({ depth }),
      setMatches: (matches) => set({ matches }),
    };
  });
}

export const ErdStoreContext = React.createContext<StoreApi<ErdState> | null>(null);

export function useErd<T>(selector: (s: ErdState) => T): T {
  const store = React.useContext(ErdStoreContext);
  if (!store) throw new Error("useErd must be used inside <ProSchemaErd>");
  return useStore(store, selector);
}
