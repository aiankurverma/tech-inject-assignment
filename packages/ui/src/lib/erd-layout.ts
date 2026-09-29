/**
 * Layered (Sugiyama-style) layout for directed graphs, built in-house because elkjs/dagre
 * are not on the approved list. Steps: DFS cycle breaking -> longest-path layering ->
 * barycenter crossing reduction (alternating sweeps) -> y placement by neighbour median with
 * overlap resolution. Tall layers wrap into extra columns so 200+ tables stay readable.
 * Complexity is O((V + E) * sweeps).
 */

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface LayoutOptions {
  /** Horizontal gap between layers. */
  gapX?: number;
  /** Vertical gap between nodes in a layer. */
  gapY?: number;
  /** Wrap a layer into extra columns once it exceeds this height. */
  maxColumnHeight?: number;
  sweeps?: number;
}

export type LayoutResult = Map<string, { x: number; y: number; layer: number }>;

export function layeredLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  { gapX = 120, gapY = 36, maxColumnHeight = 2400, sweeps = 6 }: LayoutOptions = {},
): LayoutResult {
  const ids = new Set(nodes.map((n) => n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, string[]>();
  const inn = new Map<string, string[]>();
  for (const n of nodes) {
    out.set(n.id, []);
    inn.set(n.id, []);
  }
  const seen = new Set<string>();
  for (const e of edges) {
    if (e.source === e.target || !ids.has(e.source) || !ids.has(e.target)) continue;
    const k = `${e.source}\u0000${e.target}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.get(e.source)!.push(e.target);
  }

  // 1. Break cycles: reverse DFS back edges (iterative to survive deep graphs).
  const state = new Map<string, 0 | 1 | 2>();
  const dag = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const root of nodes) {
    if (state.get(root.id)) continue;
    const stack: [string, number][] = [[root.id, 0]];
    state.set(root.id, 1);
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const succ = out.get(top[0])!;
      if (top[1] < succ.length) {
        const v = succ[top[1]++]!;
        const s = state.get(v) ?? 0;
        if (s === 1) dag.get(v)!.push(top[0]);
        else {
          dag.get(top[0])!.push(v);
          if (s === 0) {
            state.set(v, 1);
            stack.push([v, 0]);
          }
        }
      } else {
        state.set(top[0], 2);
        stack.pop();
      }
    }
  }
  for (const [u, vs] of dag) for (const v of vs) inn.get(v)!.push(u);

  // 2. Longest-path layering via Kahn's order.
  const layer = new Map<string, number>();
  const indeg = new Map(nodes.map((n) => [n.id, inn.get(n.id)!.length]));
  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  for (const id of queue) layer.set(id, 0);
  for (let qi = 0; qi < queue.length; qi++) {
    const u = queue[qi]!;
    for (const v of dag.get(u)!) {
      layer.set(v, Math.max(layer.get(v) ?? 0, layer.get(u)! + 1));
      indeg.set(v, indeg.get(v)! - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }
  // Pull sources right next to their earliest successor to shorten edges.
  for (const id of queue) {
    if (inn.get(id)!.length || !dag.get(id)!.length) continue;
    const minSucc = Math.min(...dag.get(id)!.map((v) => layer.get(v)!));
    layer.set(id, Math.max(0, minSucc - 1));
  }
  // Isolated tables go to a trailing column so they don't crowd connected ones.
  const maxLayer = Math.max(0, ...layer.values());
  for (const n of nodes) {
    if (!inn.get(n.id)!.length && !dag.get(n.id)!.length) layer.set(n.id, maxLayer + 1);
  }

  const layers: string[][] = [];
  for (const n of nodes) (layers[layer.get(n.id)!] ??= []).push(n.id);
  const compact = layers.filter((l) => l && l.length);

  // 3. Barycenter crossing reduction.
  const pos = new Map<string, number>();
  const index = () => compact.forEach((l) => l.forEach((id, i) => pos.set(id, i)));
  index();
  const bary = (id: string, neighbours: string[]) => {
    let s = 0;
    let c = 0;
    for (const v of neighbours) {
      const p = pos.get(v);
      if (p !== undefined) {
        s += p;
        c++;
      }
    }
    return c ? s / c : pos.get(id)!;
  };
  for (let it = 0; it < sweeps; it++) {
    const down = it % 2 === 0;
    const order = down ? compact.slice(1) : compact.slice(0, -1).reverse();
    for (const l of order) {
      const keyed = l.map((id) => ({ id, b: bary(id, down ? inn.get(id)! : dag.get(id)!) }));
      keyed.sort((a, b) => a.b - b.b);
      l.splice(0, l.length, ...keyed.map((k) => k.id));
      l.forEach((id, i) => pos.set(id, i));
    }
  }

  // 4. Coordinates. Each layer may wrap into several columns.
  const result: LayoutResult = new Map();
  let x = 0;
  compact.forEach((l, li) => {
    const columns: string[][] = [[]];
    let h = 0;
    for (const id of l) {
      const nh = byId.get(id)!.height;
      if (h + nh > maxColumnHeight && columns[columns.length - 1]!.length) {
        columns.push([]);
        h = 0;
      }
      columns[columns.length - 1]!.push(id);
      h += nh + gapY;
    }
    for (const col of columns) {
      const colW = Math.max(...col.map((id) => byId.get(id)!.width));
      // Desired y = mean centre of already-placed neighbours, then push down to avoid overlap.
      const desired = col.map((id) => {
        const ys = [...inn.get(id)!, ...dag.get(id)!]
          .map((v) => result.get(v))
          .filter((p): p is { x: number; y: number; layer: number } => !!p)
          .map((p) => p.y);
        return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : -Infinity;
      });
      let cursor = 0;
      col.forEach((id, i) => {
        const y = Math.max(cursor, Number.isFinite(desired[i]!) ? desired[i]! : cursor);
        result.set(id, { x, y, layer: li });
        cursor = y + byId.get(id)!.height + gapY;
      });
      x += colW + gapX;
    }
  });
  return result;
}
