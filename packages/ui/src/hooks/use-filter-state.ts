import * as React from "react";
import { createParser, useQueryState } from "nuqs";
import {
  parseFilters,
  sameFilters,
  serializeFilters,
} from "@/components/crm/pro-filter-bar/operators";
import type { FilterCondition } from "@/components/crm/pro-filter-bar/types";

export interface UseFilterStateOptions {
  value?: FilterCondition[];
  defaultValue?: FilterCondition[];
  onChange?: (filters: FilterCondition[]) => void;
  /** How many steps "Undo" can go back. */
  historyLimit?: number;
}

export interface FilterState {
  filters: FilterCondition[];
  setFilters: (next: FilterCondition[] | ((prev: FilterCondition[]) => FilterCondition[])) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Controlled/uncontrolled filter list with an undo/redo stack. Every committed change
 * (add, edit, remove, clear, apply view) is one undo step.
 */
export function useFilterState({
  value,
  defaultValue = [],
  onChange,
  historyLimit = 50,
}: UseFilterStateOptions): FilterState {
  const [inner, setInner] = React.useState(defaultValue);
  const controlled = value !== undefined;
  const filters = controlled ? value : inner;
  // History lives in refs (no side effects inside state updaters); `tick` re-renders buttons.
  const past = React.useRef<FilterCondition[][]>([]);
  const future = React.useRef<FilterCondition[][]>([]);
  const [, setTick] = React.useState(0);
  const latest = React.useRef(filters);
  latest.current = filters;

  const commit = React.useCallback(
    (next: FilterCondition[]) => {
      latest.current = next;
      if (!controlled) setInner(next);
      onChange?.(next);
      setTick((t) => t + 1);
    },
    [controlled, onChange],
  );

  const setFilters = React.useCallback<FilterState["setFilters"]>(
    (next) => {
      const prev = latest.current;
      const resolved = typeof next === "function" ? next(prev) : next;
      if (resolved === prev) return;
      // Chip ids differ but the query is the same (e.g. re-applying a view): no history entry.
      if (!sameFilters(prev, resolved)) {
        past.current = [...past.current.slice(-(historyLimit - 1)), prev];
        future.current = [];
      }
      commit(resolved);
    },
    [commit, historyLimit],
  );

  const undo = React.useCallback(() => {
    const prev = past.current.at(-1);
    if (!prev) return;
    past.current = past.current.slice(0, -1);
    future.current = [latest.current, ...future.current];
    commit(prev);
  }, [commit]);

  const redo = React.useCallback(() => {
    const next = future.current[0];
    if (!next) return;
    future.current = future.current.slice(1);
    past.current = [...past.current, latest.current];
    commit(next);
  }, [commit]);

  return {
    filters,
    setFilters,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}

const filtersParser = createParser<FilterCondition[]>({
  parse: (v) => parseFilters(v),
  serialize: (v) => serializeFilters(v),
  eq: sameFilters,
});

/**
 * Filters mirrored to a URL query param (`?f=status.is.won~amount.gt.5000`) through nuqs, so
 * links, reloads and back/forward restore the view. Needs a nuqs adapter at the app root
 * (`NuqsAdapter` from "nuqs/adapters/next/app", ".../react", ".../react-router", ...).
 * Chip ids survive the round trip so open popovers stay attached to their chip.
 */
export function useUrlFilters(key = "f"): [FilterCondition[], (next: FilterCondition[]) => void] {
  const [fromUrl, setUrl] = useQueryState(
    key,
    filtersParser.withDefault([]).withOptions({ history: "replace", clearOnDefault: true }),
  );
  const [local, setLocal] = React.useState<FilterCondition[]>(fromUrl);
  // Pending chips (no value yet) serialise too, so the URL and local state stay in step; an
  // external change (back button, pasted link) replaces local state.
  const value = sameFilters(local, fromUrl) ? local : fromUrl;
  const set = React.useCallback(
    (next: FilterCondition[]) => {
      setLocal(next);
      void setUrl(next.length ? next : null);
    },
    [setUrl],
  );
  return [value, set];
}
