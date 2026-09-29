import * as React from "react";
import {
  ancestorIds,
  containerIds,
  flatten,
  searchJson,
  type FlatRow,
  type SearchResult,
} from "@/lib/json-explorer";

export interface UseJsonTreeOptions {
  data: unknown;
  expanded?: string[];
  defaultExpanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  /** Depth auto-expanded on first render when uncontrolled. */
  initialDepth?: number;
  query: string;
  searchLimit?: number;
}

export interface JsonTree {
  rows: FlatRow[];
  expandedSet: ReadonlySet<string>;
  toggle: (id: string) => void;
  setOpen: (id: string, open: boolean) => void;
  expandAll: (depth?: number) => void;
  collapseAll: () => void;
  reveal: (id: string) => void;
  search: SearchResult;
  matchSet: ReadonlySet<string>;
  searching: boolean;
}

/**
 * Expansion state (controlled or uncontrolled), lazy flattening and search for the explorer.
 * Search runs on a deferred query so typing never blocks on a multi-megabyte scan.
 */
export function useJsonTree(opts: UseJsonTreeOptions): JsonTree {
  const { data, expanded, defaultExpanded, onExpandedChange, initialDepth = 1 } = opts;
  const [inner, setInner] = React.useState<Set<string>>(
    () => new Set(defaultExpanded ?? containerIds(data, initialDepth - 1, 200)),
  );
  const controlled = expanded !== undefined;
  const expandedSet = React.useMemo<ReadonlySet<string>>(
    () => (controlled ? new Set(expanded) : inner),
    [controlled, expanded, inner],
  );

  const commit = React.useCallback(
    (next: Set<string>) => {
      if (!controlled) setInner(next);
      onExpandedChange?.([...next]);
    },
    [controlled, onExpandedChange],
  );

  const setOpen = React.useCallback(
    (id: string, open: boolean) => {
      if (expandedSet.has(id) === open) return;
      const next = new Set(expandedSet);
      if (open) next.add(id);
      else next.delete(id);
      commit(next);
    },
    [expandedSet, commit],
  );
  const toggle = React.useCallback(
    (id: string) => setOpen(id, !expandedSet.has(id)),
    [expandedSet, setOpen],
  );
  const expandAll = React.useCallback(
    (depth = 3) => commit(new Set([...expandedSet, ...containerIds(data, depth)])),
    [commit, data, expandedSet],
  );
  const collapseAll = React.useCallback(() => commit(new Set()), [commit]);
  const reveal = React.useCallback(
    (id: string) => {
      const need = ancestorIds(id).filter((a) => !expandedSet.has(a));
      if (need.length) commit(new Set([...expandedSet, ...need]));
    },
    [commit, expandedSet],
  );

  const deferredQuery = React.useDeferredValue(opts.query);
  const search = React.useMemo(
    () => searchJson(data, deferredQuery, opts.searchLimit),
    [data, deferredQuery, opts.searchLimit],
  );
  const matchSet = React.useMemo(() => new Set(search.ids), [search]);
  const rows = React.useMemo(() => flatten(data, expandedSet), [data, expandedSet]);

  return {
    rows,
    expandedSet,
    toggle,
    setOpen,
    expandAll,
    collapseAll,
    reveal,
    search,
    matchSet,
    searching: deferredQuery !== opts.query,
  };
}
