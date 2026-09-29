import * as React from "react";
import { produce, type Draft } from "immer";
import type { Product } from "@/components/crm/pro-catalog-manager/types";

const LIMIT = 100;

interface State {
  doc: Product[];
  saved: Product[];
  past: { doc: Product[]; label: string }[];
  future: { doc: Product[]; label: string }[];
}

type Action =
  | { type: "apply"; label: string; recipe: (d: Draft<Product[]>) => void }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; doc: Product[] }
  | { type: "saved"; doc: Product[] };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "apply": {
      const next = produce(s.doc, a.recipe);
      if (next === s.doc) return s;
      return {
        ...s,
        doc: next,
        past: [...s.past, { doc: s.doc, label: a.label }].slice(-LIMIT),
        future: [],
      };
    }
    case "undo": {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return {
        ...s,
        doc: prev.doc,
        past: s.past.slice(0, -1),
        future: [{ doc: s.doc, label: prev.label }, ...s.future],
      };
    }
    case "redo": {
      const next = s.future[0];
      if (!next) return s;
      return {
        ...s,
        doc: next.doc,
        past: [...s.past, { doc: s.doc, label: next.label }],
        future: s.future.slice(1),
      };
    }
    case "reset":
      return { doc: a.doc, saved: a.doc, past: [], future: [] };
    case "saved":
      return { ...s, saved: a.doc };
  }
}

/**
 * Immutable catalog document with undo/redo. Every edit goes through an immer recipe, so
 * untouched products keep object identity (cheap diffing, memoised validation and rows).
 * Snapshots share structure, so 100 history entries of a 10k-variant catalog cost little memory.
 */
export function useCatalogHistory(initial: Product[]) {
  const [state, dispatch] = React.useReducer(reducer, initial, (doc) => ({
    doc,
    saved: doc,
    past: [],
    future: [],
  }));
  const apply = React.useCallback(
    (label: string, recipe: (d: Draft<Product[]>) => void) =>
      dispatch({ type: "apply", label, recipe }),
    [],
  );
  const undo = React.useCallback(() => dispatch({ type: "undo" }), []);
  const redo = React.useCallback(() => dispatch({ type: "redo" }), []);
  const reset = React.useCallback((doc: Product[]) => dispatch({ type: "reset", doc }), []);
  const markSaved = React.useCallback((doc: Product[]) => dispatch({ type: "saved", doc }), []);
  return {
    doc: state.doc,
    saved: state.saved,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undoLabel: state.past[state.past.length - 1]?.label,
    redoLabel: state.future[0]?.label,
    apply,
    undo,
    redo,
    reset,
    markSaved,
  };
}
