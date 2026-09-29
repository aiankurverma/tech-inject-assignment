import { useMemo } from "react";
import type { SpanNode, TraceSpan } from "@/components/crm/pro-trace-waterfall/types";

export interface SpanTree {
  roots: SpanNode[];
  byId: Map<string, SpanNode>;
  traceStart: number;
  traceEnd: number;
  services: string[];
  errorCount: number;
  maxDepth: number;
}

/** O(n log n) tree build: parent links, depth, subtree size and error roll-up, all iterative. */
export function buildSpanTree(spans: TraceSpan[]): SpanTree {
  const byId = new Map<string, SpanNode>();
  spans.forEach((span, index) =>
    byId.set(span.spanId, {
      span,
      index,
      depth: 0,
      end: span.startTime + Math.max(0, span.duration),
      children: [],
      parent: null,
      descendants: 0,
      subtreeError: span.status === "error",
    }),
  );
  const roots: SpanNode[] = [];
  let traceStart = Infinity;
  let traceEnd = -Infinity;
  const services = new Set<string>();
  let errorCount = 0;
  for (const node of byId.values()) {
    const p = node.span.parentSpanId ? byId.get(node.span.parentSpanId) : undefined;
    if (p && p !== node) {
      node.parent = p;
      p.children.push(node);
    } else roots.push(node);
    traceStart = Math.min(traceStart, node.span.startTime);
    traceEnd = Math.max(traceEnd, node.end);
    services.add(node.span.service);
    if (node.span.status === "error") errorCount++;
  }
  const byStart = (a: SpanNode, b: SpanNode) =>
    a.span.startTime - b.span.startTime || a.index - b.index;
  roots.sort(byStart);
  // Pre-order walk sets depth; the reversed order gives a post-order for roll-ups.
  const order: SpanNode[] = [];
  const stack = [...roots].reverse();
  let maxDepth = 0;
  while (stack.length) {
    const n = stack.pop()!;
    order.push(n);
    n.children.sort(byStart);
    for (let i = n.children.length - 1; i >= 0; i--) {
      const c = n.children[i]!;
      c.depth = n.depth + 1;
      if (c.depth > maxDepth) maxDepth = c.depth;
      stack.push(c);
    }
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const n = order[i]!;
    if (n.parent) {
      n.parent.descendants += n.descendants + 1;
      if (n.subtreeError) n.parent.subtreeError = true;
    }
  }
  if (!Number.isFinite(traceStart)) {
    traceStart = 0;
    traceEnd = 1;
  }
  return {
    roots,
    byId,
    traceStart,
    traceEnd: Math.max(traceEnd, traceStart + 1e-3),
    services: [...services].sort(),
    errorCount,
    maxDepth,
  };
}

/** Visible rows for the current collapse state; O(visible) per change. */
export function flattenVisible(roots: SpanNode[], collapsed: ReadonlySet<string>): SpanNode[] {
  const out: SpanNode[] = [];
  const stack = [...roots].reverse();
  while (stack.length) {
    const n = stack.pop()!;
    out.push(n);
    if (collapsed.has(n.span.spanId)) continue;
    for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]!);
  }
  return out;
}

/**
 * Critical path (Jaeger's algorithm): walk back from each span's end, repeatedly taking the child
 * that finished last before the cursor, then moving the cursor to that child's start.
 * Returns the span ids plus the exact [start, end] segments each contributes.
 */
export function computeCriticalPath(tree: SpanTree): Map<string, [number, number][]> {
  const segs = new Map<string, [number, number][]>();
  const add = (id: string, s: number, e: number) => {
    if (e <= s) return;
    const l = segs.get(id);
    if (l) l.push([s, e]);
    else segs.set(id, [[s, e]]);
  };
  const root = tree.roots.reduce<SpanNode | null>(
    (best, r) => (!best || r.end > best.end ? r : best),
    null,
  );
  if (!root) return segs;
  const work: { node: SpanNode; until: number }[] = [{ node: root, until: root.end }];
  while (work.length) {
    const { node, until } = work.pop()!;
    let cursor = Math.min(until, node.end);
    const kids = [...node.children].sort((a, b) => b.end - a.end);
    for (const c of kids) {
      if (c.span.startTime >= cursor) continue;
      const cEnd = Math.min(c.end, cursor);
      add(node.span.spanId, cEnd, cursor); // self time after the child
      work.push({ node: c, until: cEnd });
      cursor = c.span.startTime;
      if (cursor <= node.span.startTime) break;
    }
    add(node.span.spanId, node.span.startTime, cursor);
  }
  return segs;
}

/** Self time = duration minus the union of child intervals clipped to the span. */
export function selfTime(node: SpanNode): number {
  const s = node.span.startTime;
  const iv = node.children
    .map((c) => [Math.max(s, c.span.startTime), Math.min(node.end, c.end)] as const)
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let curS = -Infinity;
  let curE = -Infinity;
  for (const [a, b] of iv) {
    if (a > curE) {
      if (curE > curS) covered += curE - curS;
      curS = a;
      curE = b;
    } else curE = Math.max(curE, b);
  }
  if (curE > curS) covered += curE - curS;
  return Math.max(0, node.span.duration - covered);
}

export function useSpanTree(spans: TraceSpan[]) {
  const tree = useMemo(() => buildSpanTree(spans), [spans]);
  const critical = useMemo(() => computeCriticalPath(tree), [tree]);
  return { tree, critical };
}
