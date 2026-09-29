import * as React from "react";

export interface AnchoredItem {
  id: string;
  /** Desired top offset (px) inside the scroll content; the anchor's position. */
  anchorTop: number;
}

/**
 * Google-Docs style sidebar layout: each card wants to sit next to its anchor,
 * cards never overlap, and the active card is pinned exactly to its anchor with
 * neighbours pushed up / down around it. O(n) after the caller's sort.
 */
export function layoutAnchored(
  items: AnchoredItem[],
  heights: ReadonlyMap<string, number>,
  activeId: string | null,
  gap = 8,
  estimate = 120,
): Map<string, number> {
  const tops = new Map<string, number>();
  const h = (id: string) => heights.get(id) ?? estimate;
  const pivot = activeId ? items.findIndex((i) => i.id === activeId) : -1;
  if (pivot < 0) {
    let cursor = -Infinity;
    for (const it of items) {
      const top = Math.max(it.anchorTop, cursor);
      tops.set(it.id, top);
      cursor = top + h(it.id) + gap;
    }
    return tops;
  }
  const active = items[pivot]!;
  tops.set(active.id, active.anchorTop);
  let cursor = active.anchorTop + h(active.id) + gap;
  for (let i = pivot + 1; i < items.length; i++) {
    const it = items[i]!;
    const top = Math.max(it.anchorTop, cursor);
    tops.set(it.id, top);
    cursor = top + h(it.id) + gap;
  }
  let ceiling = active.anchorTop - gap;
  for (let i = pivot - 1; i >= 0; i--) {
    const it = items[i]!;
    const top = Math.min(it.anchorTop, ceiling - h(it.id));
    tops.set(it.id, top);
    ceiling = top - gap;
  }
  return tops;
}

/**
 * Measures rendered cards with one shared ResizeObserver and re-renders when a
 * height actually changes. Returns a ref-callback factory to attach per card.
 */
export function useMeasuredHeights() {
  const heights = React.useRef(new Map<string, number>());
  const [version, bump] = React.useReducer((x: number) => x + 1, 0);
  const observer = React.useRef<ResizeObserver | null>(null);
  const nodes = React.useRef(new Map<string, HTMLElement>());

  React.useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      let changed = false;
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.measureId;
        if (!id) continue;
        const next = Math.round((e.target as HTMLElement).offsetHeight);
        if (heights.current.get(id) !== next) {
          heights.current.set(id, next);
          changed = true;
        }
      }
      if (changed) bump();
    });
    observer.current = ro;
    nodes.current.forEach((n) => ro.observe(n));
    return () => ro.disconnect();
  }, []);

  // Stable per-id ref callbacks so memoised cards are not re-rendered by ref churn.
  const callbacks = React.useRef(new Map<string, (node: HTMLElement | null) => void>());
  const measure = React.useCallback((id: string) => {
    let cb = callbacks.current.get(id);
    if (!cb) {
      cb = makeRef(id);
      callbacks.current.set(id, cb);
    }
    return cb;
  }, []);
  const makeRef = (id: string) => (node: HTMLElement | null) => {
    const prev = nodes.current.get(id);
    if (prev && prev !== node) observer.current?.unobserve(prev);
    if (node) {
      node.dataset.measureId = id;
      nodes.current.set(id, node);
      observer.current?.observe(node);
    } else nodes.current.delete(id);
  };

  return { heights: heights.current, version, measure };
}
