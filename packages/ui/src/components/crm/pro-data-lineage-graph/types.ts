export type LineageStatus = "healthy" | "warning" | "failed" | "stale" | "running";
export type LineageKind = "source" | "seed" | "model" | "snapshot" | "metric" | "exposure";
export type LineageDirection = "upstream" | "downstream";

export interface LineageColumn {
  name: string;
  type?: string;
  description?: string;
}

/** One dataset (table, view, model, dashboard ...) in the lineage graph. */
export interface LineageDataset {
  id: string;
  name: string;
  kind: LineageKind;
  status?: LineageStatus;
  schema?: string;
  owner?: string;
  columns?: LineageColumn[];
  /** Whether more parents exist on the server (shows the lazy "expand upstream" control). */
  hasUpstream?: boolean;
  /** Whether more children exist on the server (shows the lazy "expand downstream" control). */
  hasDownstream?: boolean;
  /** Free-form facts shown in the side panel (last run, rows, test count ...). */
  meta?: Record<string, string>;
}

/** Column-to-column mapping carried by a dataset edge. */
export interface LineageColumnLink {
  from: string;
  to: string;
}

export interface LineageEdge {
  source: string;
  target: string;
  columns?: LineageColumnLink[];
}

export interface LineagePage {
  nodes: LineageDataset[];
  edges: LineageEdge[];
}

/**
 * Loads the neighbourhood of `id`: up to `depth` levels in `direction`. Must include `id` itself
 * is optional; returned nodes are merged by id, edges by source/target.
 */
export type LineageFetcher = (
  id: string,
  direction: LineageDirection,
  depth: number,
  signal?: AbortSignal,
) => Promise<LineagePage>;

export interface ColumnRef {
  nodeId: string;
  column: string;
}

export const edgeKey = (source: string, target: string) => `${source}\u0000${target}`;
export const colKey = (nodeId: string, column: string) => `${nodeId}\u0000${column}`;
