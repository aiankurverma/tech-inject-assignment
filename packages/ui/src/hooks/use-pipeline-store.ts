import * as React from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import type { CellTarget } from "@/components/crm/pro-pipeline-board/model";

/**
 * Per-board UI state (drag, focus, pending saves, announcements) kept in a zustand store so
 * that a drag over 10k cards only re-renders the handful of components whose slice changed.
 */
export interface PipelineUiState {
  active: { dealId: string; mode: "pointer" | "keyboard"; origin: CellTarget } | null;
  over: CellTarget | null;
  pointer: { x: number; y: number } | null;
  focusedId: string | null;
  /** Bumped when focus should be moved programmatically (keyboard nav, after drop). */
  focusNonce: number;
  pending: Record<string, true>;
  announcement: { text: string; id: number };
  error: { text: string; id: number } | null;
  collapsedLanes: Record<string, true>;
}

export interface PipelineUiActions {
  startDrag: (dealId: string, mode: "pointer" | "keyboard", origin: CellTarget) => void;
  setOver: (over: CellTarget | null) => void;
  setPointer: (p: { x: number; y: number } | null) => void;
  endDrag: () => void;
  focus: (dealId: string | null, move?: boolean) => void;
  setPending: (dealId: string, pending: boolean) => void;
  announce: (text: string) => void;
  fail: (text: string | null) => void;
  toggleLane: (laneId: string) => void;
}

export type PipelineStore = StoreApi<PipelineUiState & PipelineUiActions>;

export function createPipelineStore(): PipelineStore {
  return createStore<PipelineUiState & PipelineUiActions>()((set) => ({
    active: null,
    over: null,
    pointer: null,
    focusedId: null,
    focusNonce: 0,
    pending: {},
    announcement: { text: "", id: 0 },
    error: null,
    collapsedLanes: {},
    startDrag: (dealId, mode, origin) =>
      set({ active: { dealId, mode, origin }, over: origin, pointer: null }),
    setOver: (over) =>
      set((s) =>
        s.over &&
        over &&
        s.over.stageId === over.stageId &&
        s.over.laneId === over.laneId &&
        s.over.index === over.index
          ? s
          : { over },
      ),
    setPointer: (pointer) => set({ pointer }),
    endDrag: () => set({ active: null, over: null, pointer: null }),
    focus: (focusedId, move = true) =>
      set((s) => ({ focusedId, focusNonce: move ? s.focusNonce + 1 : s.focusNonce })),
    setPending: (dealId, pending) =>
      set((s) => {
        const next = { ...s.pending };
        if (pending) next[dealId] = true;
        else delete next[dealId];
        return { pending: next };
      }),
    announce: (text) => set((s) => ({ announcement: { text, id: s.announcement.id + 1 } })),
    fail: (text) => set((s) => ({ error: text ? { text, id: (s.error?.id ?? 0) + 1 } : null })),
    toggleLane: (laneId) =>
      set((s) => {
        const next = { ...s.collapsedLanes };
        if (next[laneId]) delete next[laneId];
        else next[laneId] = true;
        return { collapsedLanes: next };
      }),
  }));
}

export const PipelineStoreContext = React.createContext<PipelineStore | null>(null);

export function usePipelineStore<T>(selector: (s: PipelineUiState & PipelineUiActions) => T): T {
  const store = React.useContext(PipelineStoreContext);
  if (!store) throw new Error("usePipelineStore must be used inside ProPipelineBoard");
  return useStore(store, selector);
}

export function usePipelineStoreApi(): PipelineStore {
  const store = React.useContext(PipelineStoreContext);
  if (!store) throw new Error("usePipelineStoreApi must be used inside ProPipelineBoard");
  return store;
}
