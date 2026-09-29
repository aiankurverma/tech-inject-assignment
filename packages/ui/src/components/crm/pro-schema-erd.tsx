import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import { layeredLayout } from "@/lib/erd-layout";
import { createErdStore, ErdStoreContext } from "@/hooks/use-erd-store";
import { TableNode, type TableNodeType } from "@/components/crm/pro-schema-erd/table-node";
import { RelationEdge, type RelationEdgeType } from "@/components/crm/pro-schema-erd/relation-edge";
import { ErdToolbar } from "@/components/crm/pro-schema-erd/toolbar";
import { downloadText, erdToSvg } from "@/components/crm/pro-schema-erd/svg-export";
import {
  NODE_WIDTH,
  nodeHeight,
  type ErdRelation,
  type ErdTable,
  type LineageMode,
  type ResolvedRelation,
} from "@/components/crm/pro-schema-erd/types";

export type {
  Cardinality,
  ErdColumn,
  ErdRelation,
  ErdTable,
  LineageMode,
} from "@/components/crm/pro-schema-erd/types";

export interface ProSchemaErdProps {
  tables: ErdTable[];
  /** Extra or overriding relations. FK columns produce relations automatically. */
  relations?: ErdRelation[];
  /** Controlled focused table id (null clears). */
  focusedTable?: string | null;
  defaultFocusedTable?: string | null;
  onFocusedTableChange?: (id: string | null) => void;
  defaultLineageMode?: LineageMode;
  /** Relation hops to highlight from the focused table. Default 2. */
  defaultLineageDepth?: number;
  /** Canvas height in px. Default 640. */
  height?: number;
  showMinimap?: boolean;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  exportFileName?: string;
  /** Receives the SVG string; the file is downloaded unless you return false. */
  onExportSvg?: (svg: string) => boolean | void;
  title?: string;
  className?: string;
}

const nodeTypes = { table: TableNode };
const edgeTypes = { relation: RelationEdge };

/** FK columns + explicit relations, de-duplicated, with inferred cardinality. */
export function resolveRelations(
  tables: ErdTable[],
  extra: ErdRelation[] = [],
): ResolvedRelation[] {
  const ids = new Set(tables.map((t) => t.id));
  const map = new Map<string, ResolvedRelation>();
  for (const t of tables) {
    for (const c of t.columns) {
      if (!c.fk || !ids.has(c.fk.table)) continue;
      const id = `${t.id}.${c.name}->${c.fk.table}.${c.fk.column}`;
      map.set(id, {
        id,
        from: { table: t.id, column: c.name },
        to: { table: c.fk.table, column: c.fk.column },
        cardinality:
          c.unique || (c.pk && t.columns.filter((x) => x.pk).length === 1)
            ? "one-to-one"
            : "many-to-one",
        optional: !!c.nullable,
      });
    }
  }
  for (const r of extra) {
    if (!ids.has(r.from.table) || !ids.has(r.to.table)) continue;
    const id = r.id ?? `${r.from.table}.${r.from.column}->${r.to.table}.${r.to.column}`;
    const prev = map.get(id);
    map.set(id, {
      id,
      from: r.from,
      to: r.to,
      cardinality: r.cardinality ?? prev?.cardinality ?? "many-to-one",
      optional: r.optional ?? prev?.optional ?? false,
      label: r.label,
    });
  }
  return [...map.values()];
}

function layoutNodes(tables: ErdTable[], relations: ResolvedRelation[]): TableNodeType[] {
  const pos = layeredLayout(
    tables.map((t) => ({ id: t.id, width: NODE_WIDTH, height: nodeHeight(t) })),
    relations.map((r) => ({ source: r.from.table, target: r.to.table })),
  );
  return tables.map((t) => ({
    id: t.id,
    type: "table",
    position: pos.get(t.id) ?? { x: 0, y: 0 },
    width: NODE_WIDTH,
    height: nodeHeight(t),
    data: { table: t },
  }));
}

function ErdCanvas({
  tables,
  relations: extra,
  focusedTable,
  onFocusedTableChange,
  height = 640,
  showMinimap = true,
  exportFileName = "schema.svg",
  onExportSvg,
  store,
}: ProSchemaErdProps & { store: ReturnType<typeof createErdStore> }) {
  const flow = useReactFlow();
  const relations = React.useMemo(() => resolveRelations(tables, extra), [tables, extra]);
  const [initial] = React.useState(() => layoutNodes(tables, relations));
  const [nodes, setNodes, onNodesChange] = useNodesState<TableNodeType>(initial);

  React.useEffect(() => {
    store.getState().setRelations(relations);
  }, [store, relations]);

  React.useEffect(() => {
    setNodes(layoutNodes(tables, relations));
  }, [tables, relations, setNodes]);

  const edges = React.useMemo<RelationEdgeType[]>(
    () =>
      relations.map((r) => ({
        id: r.id,
        type: "relation",
        source: r.from.table,
        target: r.to.table,
        sourceHandle: `${r.from.column}:s`,
        targetHandle: `${r.to.column}:t`,
        focusable: false,
        data: {
          cardinality: r.cardinality,
          optional: r.optional,
          label: r.label ?? `${r.from.column} → ${r.to.table}.${r.to.column}`,
        },
      })),
    [relations],
  );

  const focus = React.useCallback(
    (id: string | null) => {
      if (focusedTable === undefined) store.getState().focus(id);
      onFocusedTableChange?.(id);
      if (id) {
        const n = flow.getNode(id);
        if (n)
          flow.setCenter(n.position.x + NODE_WIDTH / 2, n.position.y + (n.height ?? 200) / 2, {
            zoom: Math.max(flow.getZoom(), 0.9),
            duration: 450,
          });
      }
    },
    [flow, store, focusedTable, onFocusedTableChange],
  );

  // Controlled mode: mirror the prop into the store.
  React.useEffect(() => {
    if (focusedTable !== undefined) store.getState().focus(focusedTable);
  }, [focusedTable, store]);

  const onNodeClick: NodeMouseHandler<TableNodeType> = (_, n) => focus(n.id);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") focus(null);
    if (e.key === "Enter") {
      const id = (e.target as HTMLElement).closest?.(".react-flow__node")?.getAttribute("data-id");
      if (id) {
        e.preventDefault();
        focus(id);
      }
    }
  };

  const exportSvg = () => {
    const pos = new Map(nodes.map((n) => [n.id, n.position]));
    const svg = erdToSvg(tables, pos, relations);
    if (onExportSvg?.(svg) === false) return;
    downloadText(svg, exportFileName);
  };

  return (
    <>
      <ErdToolbar
        tables={tables}
        onFocus={focus}
        onRelayout={() => {
          setNodes(layoutNodes(tables, relations));
          requestAnimationFrame(() => flow.fitView({ duration: 400 }));
        }}
        onFit={() => flow.fitView({ duration: 400 })}
        onExport={exportSvg}
      />
      <div style={{ height }} onKeyDown={onKeyDown} className="relative">
        <ReactFlow<TableNodeType, RelationEdgeType>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={() => focus(null)}
          nodesConnectable={false}
          onlyRenderVisibleElements
          fitView
          fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
          minZoom={0.05}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          aria-label="Entity relationship diagram"
          className="bg-crm-bg"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--color-crm-border)"
          />
          <Controls showInteractive={false} className="!shadow-crm-raised" />
          {showMinimap && (
            <MiniMap
              pannable
              zoomable
              ariaLabel="Diagram overview"
              nodeColor={(n) =>
                (n.data as { table?: ErdTable }).table?.color ?? "var(--color-crm-muted-fg)"
              }
              maskColor="rgb(0 0 0 / 0.08)"
              className="!rounded-crm !border !border-crm-border !bg-crm-card"
            />
          )}
        </ReactFlow>
      </div>
    </>
  );
}

export function ProSchemaErd(props: ProSchemaErdProps) {
  const {
    tables,
    loading,
    error,
    emptyMessage = "No tables to display.",
    title,
    className,
    defaultFocusedTable = null,
    focusedTable,
    defaultLineageMode = "both",
    defaultLineageDepth = 2,
    height = 640,
  } = props;
  const [store] = React.useState(() => {
    const s = createErdStore({ mode: defaultLineageMode, depth: defaultLineageDepth });
    s.getState().focus(focusedTable ?? defaultFocusedTable);
    return s;
  });
  const relCount = React.useMemo(
    () => tables.reduce((n, t) => n + t.columns.filter((c) => c.fk).length, 0),
    [tables],
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-crm border border-crm-border bg-crm-card text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      {title && (
        <div className="flex items-baseline justify-between gap-3 px-3 pt-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="text-[11px] tabular-nums text-crm-muted-fg">
            {tables.length} tables · {relCount} foreign keys
          </span>
        </div>
      )}
      {loading ? (
        <div className="p-4" aria-busy="true" aria-label="Loading schema">
          <div className="grid grid-cols-3 gap-4" style={{ height: height - 32 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse rounded-crm bg-crm-soft" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex items-center justify-center p-6 text-sm text-crm-danger"
          style={{ height }}
        >
          {error}
        </div>
      ) : tables.length === 0 ? (
        <div
          className="flex items-center justify-center p-6 text-sm text-crm-muted-fg"
          style={{ height }}
        >
          {emptyMessage}
        </div>
      ) : (
        <ErdStoreContext.Provider value={store}>
          <ReactFlowProvider>
            <ErdCanvas {...props} store={store} />
          </ReactFlowProvider>
        </ErdStoreContext.Provider>
      )}
    </div>
  );
}
