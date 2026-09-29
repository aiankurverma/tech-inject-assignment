import * as React from "react";
import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "zustand";
import { AlertTriangle, Loader2, Network, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineageContext } from "@/components/crm/pro-data-lineage-graph/context";
import {
  buildIndex,
  createLineageStore,
  walk,
  type LineageStore,
} from "@/components/crm/pro-data-lineage-graph/store";
import { layoutLineage } from "@/components/crm/pro-data-lineage-graph/layout";
import {
  LineageNode,
  STATUS_META,
  type LineageFlowNode,
  type LineageNodeData,
} from "@/components/crm/pro-data-lineage-graph/lineage-node";
import { LineageToolbar } from "@/components/crm/pro-data-lineage-graph/toolbar";
import { LineageDetailsPanel } from "@/components/crm/pro-data-lineage-graph/details-panel";
import {
  colKey,
  type LineageDataset,
  type LineageDirection,
  type LineageFetcher,
  type LineagePage,
  type LineageStatus,
} from "@/components/crm/pro-data-lineage-graph/types";

export type {
  LineageColumn,
  LineageColumnLink,
  LineageDataset,
  LineageDirection,
  LineageEdge,
  LineageFetcher,
  LineageKind,
  LineagePage,
  LineageStatus,
} from "@/components/crm/pro-data-lineage-graph/types";

export interface ProDataLineageGraphProps {
  /** Dataset the graph is centred on. Changing it resets the graph. */
  rootId: string;
  /** Loads `depth` levels of lineage around a dataset. Results are cached by react-query. */
  fetchLineage: LineageFetcher;
  /** Levels loaded in both directions on mount. */
  initialDepth?: number;
  /** Levels loaded per expand click (the toolbar can change it). */
  defaultExpandDepth?: number;
  /** Value passed for "All levels". */
  maxDepth?: number;
  /** Controlled selection. */
  selectedId?: string | null;
  onSelectedChange?: (dataset: LineageDataset | null) => void;
  /** Controlled focus mode (dims everything outside the node's upstream + downstream). */
  focusId?: string | null;
  onFocusChange?: (id: string | null) => void;
  /** Reuse the app's QueryClient; a private one is created otherwise. */
  queryClient?: QueryClient;
  /** Cache lifetime for expand results. */
  staleTime?: number;
  showMiniMap?: boolean;
  showDetails?: boolean;
  className?: string;
  /** Canvas height (any CSS length). */
  height?: number | string;
}

const nodeTypes = { dataset: LineageNode };

const STATUS_COLOR: Record<LineageStatus, string> = {
  healthy: "var(--color-crm-success)",
  warning: "var(--color-crm-warning)",
  failed: "var(--color-crm-danger)",
  stale: "var(--color-crm-muted-fg)",
  running: "var(--color-crm-primary)",
};

export function ProDataLineageGraph({ queryClient, ...props }: ProDataLineageGraphProps) {
  const [fallback] = React.useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient ?? fallback}>
      <ReactFlowProvider>
        <LineageCanvas {...props} />
      </ReactFlowProvider>
    </QueryClientProvider>
  );
}

function useSyncedControl<T>(
  store: LineageStore,
  value: T | undefined,
  pick: (s: ReturnType<LineageStore["getState"]>) => T,
  write: (v: T) => void,
  onChange?: (v: T) => void,
) {
  const current = useStore(store, pick);
  // Controlled -> store.
  React.useEffect(() => {
    if (value !== undefined && value !== pick(store.getState())) write(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  // Store -> consumer.
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (value === undefined || value !== current) onChange?.(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
}

function LineageCanvas({
  rootId,
  fetchLineage,
  initialDepth = 1,
  defaultExpandDepth = 1,
  maxDepth = 50,
  selectedId,
  onSelectedChange,
  focusId,
  onFocusChange,
  staleTime = 5 * 60_000,
  showMiniMap = true,
  showDetails = true,
  className,
  height = 640,
}: Omit<ProDataLineageGraphProps, "queryClient">) {
  const [store] = React.useState(createLineageStore);
  const qc = useQueryClient();
  const [depth, setDepth] = React.useState(defaultExpandDepth);
  const fetchRef = React.useRef(fetchLineage);
  fetchRef.current = fetchLineage;

  useSyncedControl(
    store,
    selectedId,
    (s) => s.selectedId,
    (v) => store.getState().select(v),
    onSelectedChange
      ? (id) => onSelectedChange(id ? (store.getState().datasets[id] ?? null) : null)
      : undefined,
  );
  useSyncedControl(
    store,
    focusId,
    (s) => s.focusId,
    (v) => store.getState().focus(v),
    onFocusChange,
  );

  // ---- initial neighbourhood ----
  const root = useQuery({
    queryKey: ["kitbase-lineage", "root", rootId, initialDepth],
    staleTime,
    queryFn: async ({ signal }): Promise<LineagePage> => {
      const [up, down] = await Promise.all([
        fetchRef.current(rootId, "upstream", initialDepth, signal),
        fetchRef.current(rootId, "downstream", initialDepth, signal),
      ]);
      return { nodes: [...up.nodes, ...down.nodes], edges: [...up.edges, ...down.edges] };
    },
  });
  React.useEffect(() => {
    store.getState().reset();
  }, [rootId, store]);
  React.useEffect(() => {
    if (!root.data) return;
    const s = store.getState();
    s.merge(root.data);
    s.markExpanded(rootId, "upstream");
    s.markExpanded(rootId, "downstream");
  }, [root.data, rootId, store]);

  // ---- lazy expansion ----
  const expand = React.useCallback(
    (id: string, direction: LineageDirection) => {
      const s = store.getState();
      s.setLoading(id, direction, true);
      s.setError(id, direction, null);
      qc.fetchQuery({
        queryKey: ["kitbase-lineage", id, direction, depth],
        staleTime,
        queryFn: ({ signal }) => fetchRef.current(id, direction, depth, signal),
      })
        .then((page) => {
          const st = store.getState();
          st.merge(page);
          st.markExpanded(id, direction);
        })
        .catch((err: unknown) =>
          store
            .getState()
            .setError(id, direction, err instanceof Error ? err.message : "Failed to load lineage"),
        )
        .finally(() => store.getState().setLoading(id, direction, false));
    },
    [qc, store, depth, staleTime],
  );
  const ctx = React.useMemo(() => ({ store, expand }), [store, expand]);

  // ---- derived graph ----
  const datasets = useStore(store, (s) => s.datasets);
  const edgesById = useStore(store, (s) => s.edges);
  const openColumns = useStore(store, (s) => s.openColumns);
  const sel = useStore(store, (s) => s.selectedId);
  const focus = useStore(store, (s) => s.focusId);
  const column = useStore(store, (s) => s.selectedColumn);
  const litColumns = useStore(store, (s) => s.litColumns);
  const litNodes = useStore(store, (s) => s.litNodes);

  const list = React.useMemo(() => Object.values(datasets), [datasets]);
  const edgeList = React.useMemo(() => Object.values(edgesById), [edgesById]);
  const index = React.useMemo(() => buildIndex(edgesById), [edgesById]);
  const positions = React.useMemo(
    () => layoutLineage(list, edgeList, openColumns),
    [list, edgeList, openColumns],
  );

  // Focus mode and column tracing light up a subgraph; everything else dims.
  React.useEffect(() => {
    const s = store.getState();
    if (column) {
      const start = colKey(column.nodeId, column.column);
      const cols = walk(start, index.colDown, walk(start, index.colUp));
      const nodes = new Set<string>();
      for (const k of cols) nodes.add(k.slice(0, k.indexOf("\u0000")));
      const closed = [...nodes].filter((n) => !s.openColumns[n]);
      if (closed.length) {
        const openColumns = { ...s.openColumns };
        for (const n of closed) openColumns[n] = true;
        store.setState({ openColumns, graphVersion: s.graphVersion + 1 });
      }
      s.setLit(nodes, cols);
    } else if (focus && datasets[focus]) {
      s.setLit(walk(focus, index.children, walk(focus, index.parents)), null);
    } else s.setLit(null, null);
  }, [column, focus, index, datasets, store]);

  // Stable node data objects so memoised nodes only re-render when their own dataset changes.
  const dataCache = React.useRef(new Map<string, LineageNodeData>());
  const nodes = React.useMemo<LineageFlowNode[]>(() => {
    const cache = dataCache.current;
    const out: LineageFlowNode[] = [];
    for (const d of list) {
      const p = positions.get(d.id);
      if (!p) continue;
      const columnsOpen = !!openColumns[d.id];
      let data = cache.get(d.id);
      if (!data || data.dataset !== d || data.columnsOpen !== columnsOpen) {
        data = { dataset: d, columnsOpen };
        cache.set(d.id, data);
      }
      out.push({
        id: d.id,
        type: "dataset",
        position: { x: p.x, y: p.y },
        data,
        selected: d.id === sel,
        draggable: false,
        connectable: false,
      });
    }
    return out;
  }, [list, positions, openColumns, sel]);

  const edges = React.useMemo<Edge[]>(() => {
    const out: Edge[] = [];
    const tracing = !!litColumns;
    for (const e of edgeList) {
      const on = !litNodes || (litNodes.has(e.source) && litNodes.has(e.target));
      out.push({
        id: `d:${e.source}->${e.target}`,
        source: e.source,
        target: e.target,
        selectable: false,
        focusable: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
        style: {
          stroke: on && !tracing ? "var(--color-crm-ring)" : "var(--color-crm-faint)",
          strokeWidth: 1.25,
          opacity: on ? (tracing ? 0.35 : 1) : 0.12,
        },
      });
      if (!litColumns) continue;
      for (const c of e.columns ?? []) {
        if (!litColumns.has(colKey(e.source, c.from)) || !litColumns.has(colKey(e.target, c.to)))
          continue;
        if (!openColumns[e.source] || !openColumns[e.target]) continue;
        out.push({
          id: `c:${e.source}.${c.from}->${e.target}.${c.to}`,
          source: e.source,
          target: e.target,
          sourceHandle: `c:${c.from}`,
          targetHandle: `c:${c.to}`,
          animated: true,
          selectable: false,
          focusable: false,
          style: { stroke: "var(--color-crm-primary)", strokeWidth: 1.75 },
        });
      }
    }
    return out;
  }, [edgeList, litNodes, litColumns, openColumns]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const s = store.getState();
    if (e.key === "Escape") {
      if (s.selectedColumn) s.selectColumn(null);
      else if (s.focusId) s.focus(null);
      else s.select(null);
      return;
    }
    const el = (e.target as HTMLElement).closest(".react-flow__node");
    const id = el?.getAttribute("data-id");
    if (!id || (e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "Enter" && el === e.target) s.select(id);
    else if (e.key === "f" || e.key === "F") s.focus(s.focusId === id ? null : id);
    else if (e.key === "c" || e.key === "C") s.toggleColumns(id);
    else if (e.key === "[" || e.key === "]") {
      const dir: LineageDirection = e.key === "[" ? "upstream" : "downstream";
      const d = s.datasets[id];
      if (d && (dir === "upstream" ? d.hasUpstream : d.hasDownstream)) expand(id, dir);
    } else return;
    e.preventDefault();
  };

  return (
    <LineageContext.Provider value={ctx}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-crm border border-crm-border bg-crm-bg text-crm-fg",
          className,
        )}
        style={{ height }}
        onKeyDown={onKeyDown}
        role="application"
        aria-roledescription="data lineage graph"
        aria-label="Data lineage graph. Tab to a dataset; F focus, [ expand upstream, ] expand downstream, C columns, Escape clear."
        aria-busy={root.isPending}
      >
        {root.isPending ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-crm-muted-fg">
            <Loader2 className="size-4 animate-spin" /> Loading lineage…
          </div>
        ) : root.isError ? (
          <div
            role="alert"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm"
          >
            <AlertTriangle className="size-6 text-crm-danger" />
            <p className="text-crm-soft">
              {root.error instanceof Error ? root.error.message : "Could not load lineage."}
            </p>
            <button
              type="button"
              onClick={() => void root.refetch()}
              className="inline-flex items-center gap-1.5 rounded-md border border-crm-border bg-crm-raised px-3 py-1.5 text-xs hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
            >
              <RotateCw className="size-3.5" /> Retry
            </button>
          </div>
        ) : list.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-crm-muted-fg">
            <Network className="size-6" />
            No lineage recorded for this dataset yet.
          </div>
        ) : (
          <ReactFlow<LineageFlowNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            colorMode="dark"
            onlyRenderVisibleElements
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            minZoom={0.05}
            maxZoom={2}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            onNodeClick={(_, n) => store.getState().select(n.id)}
            onPaneClick={() => store.getState().select(null)}
            style={{ background: "transparent" }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="var(--color-crm-faint)"
            />
            <Panel position="top-left">
              <LineageToolbar
                positions={positions}
                depth={depth}
                onDepthChange={setDepth}
                maxDepth={maxDepth}
              />
            </Panel>
            {showDetails && (
              <Panel position="top-right">
                <LineageDetailsPanel index={index} />
              </Panel>
            )}
            <Panel position="bottom-left">
              <ul
                aria-label="Status legend"
                className="flex flex-wrap gap-3 rounded-md border border-crm-border bg-crm-popover/90 px-2.5 py-1.5 text-[11px] text-crm-muted-fg"
              >
                {(Object.keys(STATUS_META) as LineageStatus[]).map((s) => (
                  <li key={s} className="inline-flex items-center gap-1">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: STATUS_COLOR[s] }}
                      aria-hidden
                    />
                    {STATUS_META[s].label}
                  </li>
                ))}
              </ul>
            </Panel>
            {showMiniMap && (
              <MiniMap<LineageFlowNode>
                pannable
                zoomable
                ariaLabel="Lineage minimap"
                maskColor="rgba(0,0,0,0.55)"
                bgColor="var(--color-crm-card)"
                nodeColor={(n) =>
                  STATUS_COLOR[n.data.dataset.status ?? "stale"] ?? "var(--color-crm-faint)"
                }
                nodeStrokeWidth={0}
                className="!rounded-crm !border !border-crm-border"
              />
            )}
          </ReactFlow>
        )}
      </div>
    </LineageContext.Provider>
  );
}
