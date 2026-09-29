/**
 * In-house layered ("Sugiyama-lite") auto-layout for top-to-bottom workflows.
 * Written from scratch on purpose: the graph is a DAG by construction (loops are
 * rejected at connect time), so longest-path layering + barycenter crossing
 * reduction covers the need without pulling in a general graph-layout engine.
 *
 * Complexity: O((V + E) * SWEEPS + V log V).
 */
export interface LayoutInput {
  id: string;
  width: number;
  height: number;
}
export interface LayoutEdge {
  source: string;
  target: string;
  /** Used to keep branch order stable (e.g. "true" left of "false"). */
  sourceHandle?: string | null;
}

const SWEEPS = 4;

export function autoLayout(
  nodes: LayoutInput[],
  edges: LayoutEdge[],
  { gapX = 56, gapY = 72, handleOrder = [] as string[] } = {},
): Map<string, { x: number; y: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, LayoutEdge[]>();
  const inc = new Map<string, LayoutEdge[]>();
  const indeg = new Map<string, number>();
  for (const n of nodes) {
    out.set(n.id, []);
    inc.set(n.id, []);
    indeg.set(n.id, 0);
  }
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    out.get(e.source)!.push(e);
    inc.get(e.target)!.push(e);
    indeg.set(e.target, indeg.get(e.target)! + 1);
  }
  const rank = (h?: string | null) => {
    const i = h ? handleOrder.indexOf(h) : -1;
    return i < 0 ? handleOrder.length : i;
  };
  for (const list of out.values()) list.sort((a, b) => rank(a.sourceHandle) - rank(b.sourceHandle));

  // 1. Longest-path layering over a Kahn topological order.
  const layer = new Map<string, number>();
  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const remaining = new Map(indeg);
  for (let qi = 0; qi < queue.length; qi++) {
    const id = queue[qi]!;
    const l = layer.get(id) ?? 0;
    layer.set(id, l);
    for (const e of out.get(id)!) {
      layer.set(e.target, Math.max(layer.get(e.target) ?? 0, l + 1));
      const r = remaining.get(e.target)! - 1;
      remaining.set(e.target, r);
      if (r === 0) queue.push(e.target);
    }
  }
  for (const n of nodes) if (!layer.has(n.id)) layer.set(n.id, 0); // defensive: cycles

  const layers: string[][] = [];
  // Initial order: DFS from roots so siblings start next to each other.
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    (layers[layer.get(id)!] ??= []).push(id);
    for (const e of out.get(id)!) visit(e.target);
  };
  for (const n of nodes) if (indeg.get(n.id) === 0) visit(n.id);
  for (const n of nodes) visit(n.id);
  for (let i = 0; i < layers.length; i++) layers[i] ??= [];

  // 2. Barycenter sweeps to reduce crossings.
  const pos = new Map<string, number>();
  const index = () => layers.forEach((ids) => ids.forEach((id, i) => pos.set(id, i)));
  index();
  const sweep = (down: boolean) => {
    const order = down
      ? layers.map((_, i) => i).slice(1)
      : layers
          .map((_, i) => i)
          .reverse()
          .slice(1);
    for (const li of order) {
      const ids = layers[li]!;
      const bary = new Map<string, number>();
      for (const id of ids) {
        const ns = (
          down ? inc.get(id)!.map((e) => e.source) : out.get(id)!.map((e) => e.target)
        ).filter((n) => layer.get(n) === li + (down ? -1 : 1));
        bary.set(
          id,
          ns.length ? ns.reduce((s, n) => s + pos.get(n)!, 0) / ns.length : pos.get(id)!,
        );
      }
      ids.sort((a, b) => bary.get(a)! - bary.get(b)! || pos.get(a)! - pos.get(b)!);
      ids.forEach((id, i) => pos.set(id, i));
    }
  };
  for (let s = 0; s < SWEEPS; s++) sweep(s % 2 === 0);

  // 3. Coordinates: each layer centred on x = 0; y from cumulative layer heights.
  const result = new Map<string, { x: number; y: number }>();
  let y = 0;
  for (const ids of layers) {
    if (!ids.length) continue;
    const width = ids.reduce((s, id) => s + byId.get(id)!.width, 0) + gapX * (ids.length - 1);
    let x = -width / 2;
    let tallest = 0;
    for (const id of ids) {
      const n = byId.get(id)!;
      result.set(id, { x, y });
      x += n.width + gapX;
      tallest = Math.max(tallest, n.height);
    }
    y += tallest + gapY;
  }
  return result;
}
