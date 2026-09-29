import * as React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  getSmoothStepPath,
  type EdgeProps,
  type NodeProps,
} from "@xyflow/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  GitFork,
  Plus,
  Split,
  UserCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowEdge, FlowNode } from "@/components/crm/pro-approval-workflow/layout";
import type { InsertPoint, Step, StepKind } from "@/components/crm/pro-approval-workflow/types";

export interface CanvasCtx {
  readOnly: boolean;
  /** Ids touched by the current simulation; empty when no simulation is shown. */
  active: Set<string> | null;
  describeApprovers: (step: Step) => string;
  onInsert: (at: InsertPoint, kind: StepKind) => void;
}
export const CanvasContext = React.createContext<CanvasCtx | null>(null);
const useCanvas = () => {
  const c = React.useContext(CanvasContext);
  if (!c) throw new Error("Canvas parts must be rendered inside <CanvasContext>");
  return c;
};

const hidden = "!h-1 !w-1 !min-h-0 !min-w-0 !border-0 !bg-transparent";

export const KIND_META: Record<
  StepKind,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  approver: { label: "Approver", icon: UserCheck, tone: "text-tag-blue-text bg-tag-blue-bg" },
  condition: { label: "Condition", icon: GitBranch, tone: "text-tag-amber-text bg-tag-amber-bg" },
  parallel: { label: "Parallel", icon: Split, tone: "text-tag-purple-text bg-tag-purple-bg" },
  outcome: { label: "Outcome", icon: CheckCircle2, tone: "text-tag-green-text bg-tag-green-bg" },
};

function summary(step: Step, describe: (s: Step) => string): string {
  switch (step.kind) {
    case "approver":
      return `${step.mode === "all" ? "All of" : "Any of"}: ${describe(step)} · ${step.slaHours}h SLA`;
    case "condition":
      return step.rule.rules.length
        ? `${step.rule.rules.length} rule${step.rule.rules.length > 1 ? "s" : ""} (${step.rule.combinator.toUpperCase()})`
        : "No rules yet";
    case "parallel":
      return `${step.branches.length} branches · wait for ${step.join}`;
    case "outcome":
      return step.outcome === "approve" ? "Ends as approved" : "Ends as rejected";
  }
}

function StepNodeView({ data, selected }: NodeProps<FlowNode>) {
  const ctx = useCanvas();
  if (data.role !== "step") return null;
  const { step, issues } = data;
  const meta = KIND_META[step.kind];
  const Icon = step.kind === "outcome" && step.outcome === "reject" ? XCircle : meta.icon;
  const dim = ctx.active && !ctx.active.has(step.id);
  const lit = ctx.active?.has(step.id);
  return (
    <div
      className={cn(
        "flex h-[78px] w-[252px] flex-col justify-center gap-1 rounded-crm border bg-crm-card px-3 text-left shadow-crm-raised transition-opacity",
        selected ? "border-crm-primary ring-2 ring-crm-primary/40" : "border-crm-border",
        lit && "border-crm-status",
        dim && "opacity-40",
      )}
    >
      <Handle type="target" position={Position.Top} className={hidden} isConnectable={false} />
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md",
            step.kind === "outcome" && step.outcome === "reject"
              ? "bg-tag-red-bg text-tag-red-text"
              : meta.tone,
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="truncate text-[13px] font-medium text-crm-fg">{step.label}</span>
        {issues > 0 && (
          <span
            className="ml-auto flex items-center gap-1 text-[11px] text-crm-warning"
            title={`${issues} issue${issues > 1 ? "s" : ""}`}
          >
            <AlertTriangle className="size-3.5" aria-hidden />
            <span className="sr-only">{issues} issues</span>
            {issues}
          </span>
        )}
      </div>
      <p className="truncate text-[11.5px] text-crm-muted-fg">
        {summary(step, ctx.describeApprovers)}
      </p>
      <Handle type="source" position={Position.Bottom} className={hidden} isConnectable={false} />
    </div>
  );
}

function TerminalNodeView({ data }: NodeProps<FlowNode>) {
  if (data.role !== "start" && data.role !== "end") return null;
  return (
    <div className="flex h-9 w-[132px] items-center justify-center gap-1.5 rounded-full border border-crm-border bg-crm-raised text-[12px] font-medium text-crm-soft">
      {data.role === "end" && (
        <Handle type="target" position={Position.Top} className={hidden} isConnectable={false} />
      )}
      {data.role === "start" ? (
        <GitFork className="size-3.5" aria-hidden />
      ) : (
        <CheckCircle2 className="size-3.5 text-crm-success" aria-hidden />
      )}
      {data.label}
      {data.role === "start" && (
        <Handle type="source" position={Position.Bottom} className={hidden} isConnectable={false} />
      )}
    </div>
  );
}

function JoinNodeView({ data }: NodeProps<FlowNode>) {
  if (data.role !== "join") return null;
  return (
    <div
      className="grid size-[18px] place-items-center rounded-full border border-crm-input bg-crm-muted text-[8px] font-semibold uppercase text-crm-soft"
      title={data.join === "merge" ? "Branches merge" : `Waits for ${data.join} branches`}
    >
      <Handle type="target" position={Position.Top} className={hidden} isConnectable={false} />
      {data.join === "merge" ? "" : data.join === "all" ? "&" : "|"}
      <Handle type="source" position={Position.Bottom} className={hidden} isConnectable={false} />
    </div>
  );
}

export const nodeTypes = {
  step: StepNodeView,
  start: TerminalNodeView,
  end: TerminalNodeView,
  join: JoinNodeView,
};

const INSERTABLE: StepKind[] = ["approver", "condition", "parallel", "outcome"];

function InsertEdge(props: EdgeProps<FlowEdge>) {
  const ctx = useCanvas();
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, id } = props;
  const [path, lx, ly] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
  });
  const seqOk = data && (data.insert.seqId === "root" || ctx.active?.has(data.insert.seqId));
  const lit =
    ctx.active &&
    seqOk &&
    (props.source.startsWith("__") || ctx.active.has(props.source.replace(/__join$/, ""))) &&
    (props.target.startsWith("__") || ctx.active.has(props.target.replace(/__join$/, "")));
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: lit ? "var(--color-crm-status)" : "var(--color-crm-input)",
          strokeWidth: lit ? 2 : 1.25,
          opacity: ctx.active && !lit ? 0.4 : 1,
        }}
      />
      <EdgeLabelRenderer>
        {data?.label && (
          <span
            className="nodrag nopan pointer-events-none absolute rounded-full border border-crm-border bg-crm-bg px-1.5 py-px text-[10.5px] text-crm-soft"
            style={{
              transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`,
            }}
          >
            {data.label}
          </span>
        )}
        {data && !ctx.readOnly && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Insert step here"
                className="nodrag nopan pointer-events-auto absolute grid size-5 place-items-center rounded-full border border-crm-input bg-crm-raised text-crm-soft opacity-70 transition hover:border-crm-primary hover:text-crm-fg hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring data-[state=open]:opacity-100"
                style={{
                  transform: `translate(-50%, -50%) translate(${targetX}px, ${targetY - 13}px)`,
                }}
              >
                <Plus className="size-3" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                sideOffset={6}
                className="z-50 min-w-40 rounded-crm border border-crm-border bg-crm-popover p-1 text-[13px] text-crm-fg shadow-crm-overlay"
              >
                <DropdownMenu.Label className="px-2 py-1 text-[11px] text-crm-muted-fg">
                  Insert step
                </DropdownMenu.Label>
                {INSERTABLE.map((k) => {
                  const M = KIND_META[k];
                  return (
                    <DropdownMenu.Item
                      key={k}
                      onSelect={() => ctx.onInsert(data.insert, k)}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none data-[highlighted]:bg-crm-muted"
                    >
                      <M.icon className="size-3.5 text-crm-soft" />
                      {M.label}
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export const edgeTypes = { insert: InsertEdge };
