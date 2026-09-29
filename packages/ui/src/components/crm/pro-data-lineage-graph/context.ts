import * as React from "react";
import { useStore } from "zustand";
import type { LineageState, LineageStore } from "@/components/crm/pro-data-lineage-graph/store";
import type { LineageDirection } from "@/components/crm/pro-data-lineage-graph/types";

export interface LineageContextValue {
  store: LineageStore;
  expand: (id: string, direction: LineageDirection) => void;
}

export const LineageContext = React.createContext<LineageContextValue | null>(null);

export function useLineageContext() {
  const ctx = React.useContext(LineageContext);
  if (!ctx) throw new Error("Lineage parts must be rendered inside <ProDataLineageGraph>");
  return ctx;
}

/** Subscribe to a slice of the lineage store; re-renders only when the slice changes. */
export function useLineage<T>(selector: (s: LineageState) => T): T {
  return useStore(useLineageContext().store, selector);
}
