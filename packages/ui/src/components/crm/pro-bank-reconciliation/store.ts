import { createStore, type StoreApi } from "zustand";
import type { ReconMatch, ReconRule } from "@/components/crm/pro-bank-reconciliation/scorer";

export type ReconFilter = "unresolved" | "resolved" | "all";
export type ReconSide = "bank" | "book";

export interface ReconState {
  matches: ReconMatch[];
  rules: ReconRule[];
  selectedBank: ReadonlySet<string>;
  selectedBook: ReadonlySet<string>;
  filter: ReconFilter;
  query: string;
  toggle: (side: ReconSide, id: string, additive: boolean) => void;
  select: (side: ReconSide, ids: string[]) => void;
  clearSelection: () => void;
  setFilter: (f: ReconFilter) => void;
  setQuery: (q: string) => void;
  addMatches: (m: ReconMatch[]) => void;
  unmatch: (matchId: string) => void;
  setMatches: (m: ReconMatch[]) => void;
  addRule: (r: ReconRule) => void;
  removeRule: (id: string) => void;
  setRules: (r: ReconRule[]) => void;
}

const EMPTY: ReadonlySet<string> = new Set();

/** One store per component instance (created in a ref), so several reconcilers can coexist. */
export function createReconStore(init: {
  matches: ReconMatch[];
  rules: ReconRule[];
  filter: ReconFilter;
}): StoreApi<ReconState> {
  return createStore<ReconState>()((set) => ({
    ...init,
    selectedBank: EMPTY,
    selectedBook: EMPTY,
    query: "",
    toggle: (side, id, additive) =>
      set((s) => {
        const key = side === "bank" ? "selectedBank" : "selectedBook";
        const next = new Set(additive ? s[key] : []);
        if (s[key].has(id) && (additive || s[key].size === 1)) next.delete(id);
        else next.add(id);
        return { [key]: next } as Partial<ReconState>;
      }),
    select: (side, ids) =>
      set({
        [side === "bank" ? "selectedBank" : "selectedBook"]: new Set(ids),
      } as Partial<ReconState>),
    clearSelection: () => set({ selectedBank: EMPTY, selectedBook: EMPTY }),
    setFilter: (filter) => set({ filter }),
    setQuery: (query) => set({ query }),
    addMatches: (m) =>
      set((s) => ({ matches: [...s.matches, ...m], selectedBank: EMPTY, selectedBook: EMPTY })),
    unmatch: (matchId) => set((s) => ({ matches: s.matches.filter((m) => m.id !== matchId) })),
    setMatches: (matches) => set({ matches }),
    addRule: (r) =>
      set((s) => ({ rules: [...s.rules.filter((x) => x.contains !== r.contains), r] })),
    removeRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),
    setRules: (rules) => set({ rules }),
  }));
}
