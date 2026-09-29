import dagre from "@dagrejs/dagre";
import type { LineageDataset, LineageEdge } from "@/components/crm/pro-data-lineage-graph/types";

export const NODE_WIDTH = 264;
export const HEADER_HEIGHT = 68;
export const COLUMN_ROW_HEIGHT = 24;

export function nodeHeight(d: LineageDataset, columnsOpen: boolean) {
  return HEADER_HEIGHT + (columnsOpen ? (d.columns?.length ?? 0) * COLUMN_ROW_HEIGHT + 8 : 0);
}

export interface Positioned {
  x: number;
  y: number;
  height: number;
}

/**
 * Left-to-right layered layout (dagre / Sugiyama). Runs in roughly O((V + E) log V) which keeps
 * 2k nodes well under a frame budget of a few hundred ms; callers memoise on graph version.
 */
export function layoutLineage(
  datasets: LineageDataset[],
  edges: LineageEdge[],
  openColumns: Record<string, true>,
): Map<string, Positioned> {
  const g = new dagre.graphlib.Graph({ multigraph: false, compound: false });
  g.setGraph({ rankdir: "LR", ranksep: 110, nodesep: 22, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const d of datasets) {
    g.setNode(d.id, { width: NODE_WIDTH, height: nodeHeight(d, !!openColumns[d.id]) });
  }
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  }
  dagre.layout(g);
  const out = new Map<string, Positioned>();
  for (const d of datasets) {
    const n = g.node(d.id);
    if (!n) continue;
    out.set(d.id, { x: n.x - n.width / 2, y: n.y - n.height / 2, height: n.height });
  }
  return out;
}
