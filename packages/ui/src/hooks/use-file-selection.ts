import * as React from "react";

/**
 * Desktop-style multi-selection over an ordered id list: click selects one, Ctrl/Cmd toggles,
 * Shift extends a range from the anchor, Ctrl+Shift adds a range. Range lookups use an index
 * map so selection stays O(range) on 10k+ items.
 */
export function useFileSelection(order: string[]) {
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(() => new Set());
  const [anchor, setAnchor] = React.useState<string | null>(null);
  const [focused, setFocused] = React.useState<string | null>(null);
  const indexOf = React.useMemo(() => new Map(order.map((id, i) => [id, i])), [order]);

  // Drop ids that are no longer visible (folder change, filter).
  React.useEffect(() => {
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (indexOf.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [indexOf]);

  const range = React.useCallback(
    (from: string | null, to: string) => {
      const a = from != null ? (indexOf.get(from) ?? 0) : 0;
      const b = indexOf.get(to) ?? 0;
      const [lo, hi] = a < b ? [a, b] : [b, a];
      return order.slice(lo, hi + 1);
    },
    [indexOf, order],
  );

  const select = React.useCallback(
    (id: string, mods: { shift?: boolean; toggle?: boolean } = {}) => {
      setFocused(id);
      if (mods.shift) {
        const ids = range(anchor ?? id, id);
        setSelected((prev) => (mods.toggle ? new Set([...prev, ...ids]) : new Set(ids)));
        return;
      }
      setAnchor(id);
      if (mods.toggle) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      } else setSelected(new Set([id]));
    },
    [anchor, range],
  );

  const moveFocus = React.useCallback(
    (delta: number, extend: boolean) => {
      if (!order.length) return null;
      const cur = focused != null ? (indexOf.get(focused) ?? -1) : -1;
      const i = Math.max(0, Math.min(order.length - 1, cur + delta));
      const id = order[i]!;
      select(id, { shift: extend });
      return i;
    },
    [focused, indexOf, order, select],
  );

  const selectAll = React.useCallback(() => setSelected(new Set(order)), [order]);
  const clear = React.useCallback(() => setSelected(new Set()), []);

  return {
    selected,
    focused,
    setFocused,
    select,
    moveFocus,
    selectAll,
    clear,
    setSelected,
    indexOf,
  };
}

/** Observes an element's content box size. */
export function useElementSize<T extends HTMLElement>() {
  const [el, setEl] = React.useState<T | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  React.useLayoutEffect(() => {
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size] as const;
}
