import * as React from "react";
import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from "immer";

enablePatches();

export interface HistoryEntry {
  id: number;
  label: string;
  at: number;
  patches: Patch[];
  inverse: Patch[];
}

/**
 * Undo/redo over an immutable collection using immer patches: each change stores only the
 * diff (not a full copy of 10k records), so history stays cheap.
 */
export function useRecordHistory<T>(value: T, setValue: (next: T) => void, limit = 50) {
  const latest = React.useRef(value);
  React.useLayoutEffect(() => {
    latest.current = value;
  });
  const [past, setPast] = React.useState<HistoryEntry[]>([]);
  const [future, setFuture] = React.useState<HistoryEntry[]>([]);
  const seq = React.useRef(0);

  const commit = React.useCallback(
    (label: string, recipe: (draft: Draft<T>) => void) => {
      const [next, patches, inverse] = produceWithPatches(latest.current, recipe);
      if (!patches.length) return null;
      latest.current = next as T;
      setValue(next as T);
      const entry: HistoryEntry = { id: ++seq.current, label, at: Date.now(), patches, inverse };
      setPast((p) => [...p.slice(-(limit - 1)), entry]);
      setFuture([]);
      return entry;
    },
    [setValue, limit],
  );

  const undo = React.useCallback(() => {
    const entry = past[past.length - 1];
    if (!entry) return null;
    const next = applyPatches(latest.current as object, entry.inverse) as T;
    latest.current = next;
    setValue(next);
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [entry, ...f]);
    return entry;
  }, [past, setValue]);

  const redo = React.useCallback(() => {
    const entry = future[0];
    if (!entry) return null;
    const next = applyPatches(latest.current as object, entry.patches) as T;
    latest.current = next;
    setValue(next);
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, entry]);
    return entry;
  }, [future, setValue]);

  return { commit, undo, redo, past, future, canUndo: past.length > 0, canRedo: future.length > 0 };
}
