import * as React from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  AlertTriangle,
  BarChart3,
  Box,
  ChevronDown,
  ChevronRight,
  Clock,
  Crosshair,
  Database,
  Loader2,
  Plus,
  Sigma,
  Sprout,
  XCircle,
  CheckCircle2,
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLineage, useLineageContext } from "@/components/crm/pro-data-lineage-graph/context";
import { dirKey } from "@/components/crm/pro-data-lineage-graph/store";
import {
  HEADER_HEIGHT,
  COLUMN_ROW_HEIGHT,
  NODE_WIDTH,
} from "@/components/crm/pro-data-lineage-graph/layout";
import {
  colKey,
  type LineageDataset,
  type LineageDirection,
  type LineageKind,
  type LineageStatus,
} from "@/components/crm/pro-data-lineage-graph/types";

export type LineageNodeData = { dataset: LineageDataset; columnsOpen: boolean };
export type LineageFlowNode = Node<LineageNodeData, "dataset">;

const KIND_ICON: Record<LineageKind, React.ComponentType<{ className?: string }>> = {
  source: Database,
  seed: Sprout,
  model: Box,
  snapshot: Camera,
  metric: Sigma,
  exposure: BarChart3,
};

export const STATUS_META: Record<
  LineageStatus,
  { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  healthy: { label: "Healthy", className: "text-crm-success", Icon: CheckCircle2 },
  warning: { label: "Warning", className: "text-crm-warning", Icon: AlertTriangle },
  failed: { label: "Failed", className: "text-crm-danger", Icon: XCircle },
  stale: { label: "Stale", className: "text-crm-muted-fg", Icon: Clock },
  running: { label: "Running", className: "text-crm-primary", Icon: Loader2 },
};

function ExpandButton({ id, dir, show }: { id: string; dir: LineageDirection; show: boolean }) {
  const { expand } = useLineageContext();
  const loading = useLineage((s) => !!s.loading[dirKey(id, dir)]);
  const error = useLineage((s) => s.errors[dirKey(id, dir)]);
  const done = useLineage((s) => !!s.expanded[dirKey(id, dir)]);
  if (!show || (done && !error)) return null;
  const label = `${error ? "Retry loading" : "Expand"} ${dir} of this dataset`;
  return (
    <button
      type="button"
      aria-label={label}
      title={error ?? label}
      disabled={loading}
      onClick={(e) => {
        e.stopPropagation();
        expand(id, dir);
      }}
      className={cn(
        "nodrag nopan absolute top-[22px] z-10 flex size-6 items-center justify-center rounded-full border bg-crm-raised shadow-crm-raised",
        "transition-colors hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none",
        error ? "border-crm-danger text-crm-danger" : "border-crm-border text-crm-soft",
        dir === "upstream" ? "-left-3" : "-right-3",
      )}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
    </button>
  );
}

function LineageNodeImpl({ id, data, selected }: NodeProps<LineageFlowNode>) {
  const { dataset: d, columnsOpen } = data;
  const { store } = useLineageContext();
  const lit = useLineage((s) => !s.litNodes || s.litNodes.has(id));
  const isFocus = useLineage((s) => s.focusId === id);
  const litColumns = useLineage((s) => s.litColumns);
  const selectedColumn = useLineage((s) => s.selectedColumn);
  const Icon = KIND_ICON[d.kind] ?? Box;
  const status = d.status ? STATUS_META[d.status] : null;
  const columns = d.columns ?? [];

  return (
    <div
      style={{ width: NODE_WIDTH }}
      aria-label={`${d.name}, ${d.kind}${status ? `, ${status.label}` : ""}`}
      className={cn(
        "relative rounded-crm border bg-crm-card text-crm-fg shadow-crm-raised transition-opacity",
        selected ? "border-crm-primary" : "border-crm-border",
        isFocus && "ring-2 ring-crm-primary/60",
        !lit && "opacity-25",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !border-crm-border !bg-crm-muted"
        style={{ top: HEADER_HEIGHT / 2 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !border-crm-border !bg-crm-muted"
        style={{ top: HEADER_HEIGHT / 2 }}
      />
      <ExpandButton id={id} dir="upstream" show={!!d.hasUpstream} />
      <ExpandButton id={id} dir="downstream" show={!!d.hasDownstream} />

      <div className="flex items-start gap-2.5 px-3 pt-2.5" style={{ height: HEADER_HEIGHT }}>
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-crm-muted text-crm-icon">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] leading-5 font-medium" title={d.name}>
            {d.name}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-crm-muted-fg">
            <span className="truncate">{d.schema ?? d.kind}</span>
            {status && (
              <span className={cn("inline-flex shrink-0 items-center gap-1", status.className)}>
                <status.Icon
                  className={cn("size-3", d.status === "running" && "animate-spin")}
                  aria-hidden
                />
                {status.label}
              </span>
            )}
          </div>
          {columns.length > 0 && (
            <button
              type="button"
              className="nodrag mt-0.5 inline-flex items-center gap-0.5 text-[11px] text-crm-soft hover:text-crm-fg focus-visible:underline focus-visible:outline-none"
              aria-expanded={columnsOpen}
              onClick={(e) => {
                e.stopPropagation();
                store.getState().toggleColumns(id);
              }}
            >
              {columnsOpen ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              {columns.length} columns
            </button>
          )}
        </div>
      </div>

      {columnsOpen && (
        <ul className="border-t border-crm-border pb-2" aria-label={`${d.name} columns`}>
          {columns.map((c) => {
            const key = colKey(id, c.name);
            const active = selectedColumn?.nodeId === id && selectedColumn.column === c.name;
            const traced = litColumns?.has(key);
            return (
              <li key={c.name} className="relative" style={{ height: COLUMN_ROW_HEIGHT }}>
                <Handle
                  id={`c:${c.name}`}
                  type="target"
                  position={Position.Left}
                  className="!size-1.5 !min-w-0 !border-0 !bg-crm-faint"
                />
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={(e) => {
                    e.stopPropagation();
                    store.getState().selectColumn(active ? null : { nodeId: id, column: c.name });
                  }}
                  className={cn(
                    "nodrag flex h-full w-full items-center gap-2 px-3 text-left text-[12px] focus-visible:bg-crm-muted focus-visible:outline-none",
                    active
                      ? "bg-crm-primary/20 text-crm-fg"
                      : traced
                        ? "bg-crm-primary/10 text-crm-fg"
                        : litColumns
                          ? "text-crm-faint"
                          : "text-crm-soft hover:bg-crm-muted",
                  )}
                  title={c.description ?? c.name}
                >
                  <Crosshair className={cn("size-3 shrink-0", !active && "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate font-mono">{c.name}</span>
                  {c.type && (
                    <span className="shrink-0 text-[10px] text-crm-muted-fg">{c.type}</span>
                  )}
                </button>
                <Handle
                  id={`c:${c.name}`}
                  type="source"
                  position={Position.Right}
                  className="!size-1.5 !min-w-0 !border-0 !bg-crm-faint"
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export const LineageNode = React.memo(LineageNodeImpl);
