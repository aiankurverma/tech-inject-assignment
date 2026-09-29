import type { ReactNode } from "react";
import type { Edge, Node } from "@xyflow/react";
import { z } from "zod";

export type NodeKind = "trigger" | "condition" | "action" | "delay" | "handler";

/** Values travelling along an edge. Targets list which types they accept. */
export type PortType = "event" | "flow" | "error";

export interface OutputPort {
  id: string;
  label?: string;
  type: PortType;
}
export interface InputPort {
  id: string;
  label?: string;
  accepts: PortType[];
}

export type FieldDef =
  | {
      key: string;
      label: string;
      kind: "text" | "textarea";
      required?: boolean;
      placeholder?: string;
      help?: string;
      maxLength?: number;
    }
  | {
      key: string;
      label: string;
      kind: "number";
      required?: boolean;
      min?: number;
      max?: number;
      help?: string;
      unit?: string;
    }
  | {
      key: string;
      label: string;
      kind: "select";
      required?: boolean;
      options: { value: string; label: string }[];
      help?: string;
    }
  | { key: string; label: string; kind: "switch"; help?: string };

export interface NodeDefinition {
  /** Stable id stored in exported JSON, e.g. "crm.deal_stage_changed". */
  type: string;
  kind: NodeKind;
  label: string;
  description?: string;
  category: string;
  icon?: ReactNode;
  inputs: InputPort[];
  outputs: OutputPort[];
  fields: FieldDef[];
  defaults?: Record<string, unknown>;
  /** One-line summary of the configured node shown on the canvas. */
  summarize?: (config: Record<string, unknown>) => string | undefined;
}

export interface WorkflowNodeData extends Record<string, unknown> {
  defType: string;
  label: string;
  config: Record<string, unknown>;
}
export type WorkflowNode = Node<WorkflowNodeData, "workflow">;
export type WorkflowEdge = Edge;

export type RunStatus = "idle" | "queued" | "running" | "success" | "error" | "skipped";
export interface NodeRunState {
  status: RunStatus;
  message?: string;
  durationMs?: number;
}

/* ---------- portable JSON format ---------- */

export const workflowJsonSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(120),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        type: z.string().min(1).max(120),
        label: z.string().max(120).optional(),
        position: z.object({ x: z.number().finite(), y: z.number().finite() }),
        config: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .max(5000),
  edges: z
    .array(
      z.object({
        id: z.string().min(1).max(160),
        source: z.string(),
        sourceHandle: z.string(),
        target: z.string(),
        targetHandle: z.string(),
      }),
    )
    .max(20000),
});
export type WorkflowJSON = z.infer<typeof workflowJsonSchema>;
