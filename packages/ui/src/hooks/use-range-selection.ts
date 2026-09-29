import * as React from "react";

export interface RangeSelectionOptions {
  /** Ids in display order. */
  ids: readonly string[];
  selected?: ReadonlySet<string>;
  defaultSelected?: Iterable<string>;
  onSelectedChange?: (next: Set<string>) => void;
}

/**
 * Gmail-style multi-select: click, ctrl/cmd toggle, shift range from the anchor. Controlled or
 * uncontrolled. Range lookups use an id->index map so shift-selecting 20k rows stays O(n) once.
 */
export function useRangeSelection({
  ids,
  selected: controlled,
  defaultSelected,
  onSelectedChange,
}: RangeSelectionOptions) {
  const [inner, setInner] = React.useState<Set<string>>(() => new Set(defaultSelected));
  const selected = (controlled as Set<string> | undefined) ?? inner;
  const anchor = React.useRef<string | null>(null);
  const index = React.useMemo(() => {
    const m = new Map<string, number>();
    ids.forEach((id, i) => m.set(id, i));
    return m;
  }, [ids]);

  const commit = React.useCallback(
    (next: Set<string>) => {
      if (controlled === undefined) setInner(next);
      onSelectedChange?.(next);
    },
    [controlled, onSelectedChange],
  );

  const toggle = React.useCallback(
    (id: string, mode: { shift?: boolean; additive?: boolean } = {}) => {
      if (mode.shift && anchor.current !== null && index.has(anchor.current)) {
        const a = index.get(anchor.current)!;
        const b = index.get(id);
        if (b === undefined) return;
        const next = new Set(mode.additive === false ? [] : selected);
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(ids[i]!);
        commit(next);
        return;
      }
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      anchor.current = id;
      commit(next);
    },
    [commit, ids, index, selected],
  );

  const setAll = React.useCallback(
    (on: boolean) => commit(on ? new Set(ids) : new Set()),
    [commit, ids],
  );
  const clear = React.useCallback(() => commit(new Set()), [commit]);
  const setAnchor = React.useCallback((id: string | null) => {
    anchor.current = id;
  }, []);

  // Drop ids that disappeared from the list (filtered out or deleted).
  const visibleSelected = React.useMemo(() => {
    let n = 0;
    for (const id of selected) if (index.has(id)) n++;
    return n;
  }, [index, selected]);

  return { selected, toggle, setAll, clear, setAnchor, visibleSelected, commit };
}
