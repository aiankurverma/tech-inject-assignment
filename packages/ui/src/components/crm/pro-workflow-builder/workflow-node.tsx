import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertCircle, CheckCircle2, Clock, Loader2, MinusCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBuilder } from "@/components/crm/pro-workflow-builder/context";
import type {
  NodeKind,
  PortType,
  RunStatus,
  WorkflowNode,
} from "@/components/crm/pro-workflow-builder/types";

export const NODE_WIDTH = 248;

const KIND_STYLE: Record<NodeKind, { chip: string; label: string }> = {
  trigger: {
    chip: "bg-tag-purple-bg text-tag-purple-text border-tag-purple-border",
    label: "Trigger",
  },
  condition: {
    chip: "bg-tag-amber-bg text-tag-amber-text border-tag-amber-border",
    label: "Condition",
  },
  action: { chip: "bg-tag-blue-bg text-tag-blue-text border-tag-blue-border", label: "Action" },
  delay: { chip: "bg-tag-teal-bg text-tag-teal-text border-tag-teal-border", label: "Delay" },
  handler: { chip: "bg-tag-red-bg text-tag-red-text border-tag-red-border", label: "On error" },
};

export const PORT_COLOR: Record<PortType, string> = {
  event: "#8b7cf6",
  flow: "#60a5fa",
  error: "#f97373",
};

const RUN_RING: Record<RunStatus, string> = {
  idle: "",
  queued: "ring-2 ring-crm-faint",
  running: "ring-2 ring-crm-warning",
  success: "ring-2 ring-crm-success",
  error: "ring-2 ring-crm-danger",
  skipped: "opacity-50",
};

function RunBadge({ status, durationMs }: { status: RunStatus; durationMs?: number }) {
  const label = {
    idle: "",
    queued: "Queued",
    running: "Running",
    success: durationMs !== undefined ? `${durationMs} ms` : "Done",
    error: "Failed",
    skipped: "Skipped",
  }[status];
  const Icon = {
    idle: null,
    queued: Clock,
    running: Loader2,
    success: CheckCircle2,
    error: XCircle,
    skipped: MinusCircle,
  }[status];
  if (!Icon) return null;
  return (
    <span
      className={cn(
        "absolute -top-2.5 right-2 inline-flex items-center gap-1 rounded-full border border-crm-border bg-crm-popover px-1.5 py-0.5 text-[10px] font-medium",
        status === "error"
          ? "text-crm-danger"
          : status === "success"
            ? "text-crm-success"
            : "text-crm-soft",
      )}
    >
      <Icon className={cn("h-3 w-3", status === "running" && "animate-spin")} />
      {label}
    </span>
  );
}

function spread(i: number, n: number) {
  return `${((i + 1) / (n + 1)) * 100}%`;
}

function WorkflowNodeImpl({ id, data, selected }: NodeProps<WorkflowNode>) {
  const { defs, runState, issuesByNode, readOnly } = useBuilder();
  const def = defs.get(data.defType);
  const run = runState?.[id];
  const issues = issuesByNode.get(id);
  const hasError = issues?.some((i) => i.severity === "error");
  const kind = def?.kind ?? "action";
  const summary = def?.summarize?.(data.config);

  return (
    <div
      role="group"
      aria-label={`${KIND_STYLE[kind].label}: ${data.label}${run ? `, ${run.status}` : ""}${issues?.length ? `, ${issues.length} issue(s)` : ""}`}
      title={run?.message}
      className={cn(
        "relative rounded-crm border bg-crm-card text-left text-crm-fg shadow-crm-raised transition-shadow",
        selected ? "border-crm-primary" : "border-crm-border",
        run && RUN_RING[run.status],
      )}
      style={{ width: NODE_WIDTH }}
    >
      {run && <RunBadge status={run.status} durationMs={run.durationMs} />}
      {def?.inputs.map((p, i, all) => (
        <Handle
          key={p.id}
          id={p.id}
          type="target"
          position={Position.Top}
          isConnectable={!readOnly}
          title={`${p.label ?? "Input"} — accepts ${p.accepts.join(", ")}`}
          style={{ left: spread(i, all.length), background: PORT_COLOR[p.accepts[0] ?? "flow"] }}
          className="!h-3 !w-3 !border-2 !border-crm-card"
        />
      ))}

      <div className="flex items-start gap-2.5 p-3">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-crm bg-crm-muted text-crm-icon [&_svg]:h-4 [&_svg]:w-4">
          {def?.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "rounded border px-1 text-[10px] font-medium uppercase tracking-wide",
                KIND_STYLE[kind].chip,
              )}
            >
              {KIND_STYLE[kind].label}
            </span>
            {issues?.length ? (
              <AlertCircle
                aria-hidden
                className={cn(
                  "ml-auto h-3.5 w-3.5",
                  hasError ? "text-crm-danger" : "text-crm-warning",
                )}
              />
            ) : null}
          </div>
          <p className="mt-1 truncate text-sm font-medium">{data.label}</p>
          <p className="truncate text-xs text-crm-subtle">
            {summary ?? def?.description ?? data.defType}
          </p>
        </div>
      </div>

      {def && def.outputs.length > 1 && (
        <div className="flex border-t border-crm-border text-[10px] text-crm-subtle">
          {def.outputs.map((p) => (
            <span key={p.id} className="flex-1 py-1 text-center">
              {p.label ?? p.id}
            </span>
          ))}
        </div>
      )}
      {def?.outputs.map((p, i, all) => (
        <Handle
          key={p.id}
          id={p.id}
          type="source"
          position={Position.Bottom}
          isConnectable={!readOnly}
          title={`${p.label ?? "Output"} — ${p.type}`}
          style={{ left: spread(i, all.length), background: PORT_COLOR[p.type] }}
          className="!h-3 !w-3 !border-2 !border-crm-card"
        />
      ))}
    </div>
  );
}

export const WorkflowNodeView = React.memo(WorkflowNodeImpl);
export const nodeTypes = { workflow: WorkflowNodeView };
