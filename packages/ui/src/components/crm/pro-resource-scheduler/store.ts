import { createStore } from "zustand";
import type { DragMode } from "@/components/crm/pro-resource-scheduler/types";

export interface DragPreview {
  mode: DragMode;
  /** Occurrence key being dragged; null while creating. */
  key: string | null;
  eventId: string | null;
  resourceId: string;
  start: number;
  end: number;
  conflict: boolean;
}

export interface SchedulerUiState {
  drag: DragPreview | null;
  selectedKey: string | null;
  setDrag: (d: DragPreview | null) => void;
  select: (key: string | null) => void;
}

/**
 * Per-instance UI store. Drag previews update at pointer-move frequency; keeping them in a zustand
 * store lets only the affected row subscribe (via selectors) instead of re-rendering the grid.
 */
export function createSchedulerStore() {
  return createStore<SchedulerUiState>((set) => ({
    drag: null,
    selectedKey: null,
    setDrag: (drag) => set({ drag }),
    select: (selectedKey) => set({ selectedKey }),
  }));
}

export type SchedulerStore = ReturnType<typeof createSchedulerStore>;
