import { Graph, layout as dagreLayout } from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { InsertPoint, Step, Workflow } from "@/components/crm/pro-approval-workflow/types";

export const STEP_W = 252;
export const STEP_H = 78;
const TERM_W = 132;
const TERM_H = 36;
const JOIN = 18;

export type FlowNodeData =
  | { role: "step"; step: Step; issues: number }
  | { role: "start"; label: string }
  | { role: "end"; label: string }
  | { role: "join"; join: "all" | "any" | "merge" };

export interface FlowEdgeData extends Record<string, unknown> {
  insert: InsertPoint;
  label?: string;
}

export type FlowNode = Node<FlowNodeData & Record<string, unknown>>;
export type FlowEdge = Edge<FlowEdgeData>;

interface Exit {
  source: string;
  label?: string;
}

/**
 * Converts the step tree into a directed graph and lays it out top-to-bottom with dagre.
 * Every edge carries the insertion point it represents, so the "+" on an edge inserts there.
 */
export function layoutWorkflow(
  wf: Workflow,
  issueCount: (id: string) => number,
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const sizes = new Map<string, [number, number]>();

  const addNode = (id: string, data: FlowNodeData, w: number, h: number) => {
    sizes.set(id, [w, h]);
    nodes.push({
      id,
      type: data.role,
      data: data as FlowNode["data"],
      position: { x: 0, y: 0 },
      draggable: false,
      connectable: false,
      selectable: data.role === "step",
      focusable: data.role === "step",
      ariaLabel: data.role === "step" ? `${data.step.kind} step: ${data.step.label}` : undefined,
    });
  };
  const connect = (from: Exit[], target: string, insert: InsertPoint) => {
    for (const f of from)
      edges.push({
        id: `${f.source}->${target}`,
        source: f.source,
        target,
        type: "insert",
        data: { insert, label: f.label },
      });
  };

  const buildSeq = (steps: Step[], seqId: string, entry: Exit[]): Exit[] => {
    let prev = entry;
    steps.forEach((s, index) => {
      addNode(s.id, { role: "step", step: s, issues: issueCount(s.id) }, STEP_W, STEP_H);
      connect(prev, s.id, { seqId, index });
      if (s.kind === "approver") prev = [{ source: s.id }];
      else if (s.kind === "outcome") prev = [];
      else {
        const branches =
          s.kind === "condition"
            ? [
                { seq: `${s.id}:then`, label: "Yes", steps: s.then },
                { seq: `${s.id}:else`, label: "No", steps: s.else },
              ]
            : s.branches.map((b) => ({ seq: b.id, label: b.label, steps: b.steps }));
        const joinId = `${s.id}__join`;
        const exitsPerBranch = branches.map((b) => ({
          b,
          exits: buildSeq(b.steps, b.seq, [{ source: s.id, label: b.label }]),
        }));
        const live = exitsPerBranch.filter((x) => x.exits.length > 0);
        if (live.length === 0) prev = [];
        else {
          addNode(
            joinId,
            { role: "join", join: s.kind === "parallel" ? s.join : "merge" },
            JOIN,
            JOIN,
          );
          for (const { b, exits } of live)
            connect(exits, joinId, { seqId: b.seq, index: b.steps.length });
          prev = [{ source: joinId }];
        }
      }
    });
    return prev;
  };

  addNode("__start", { role: "start", label: "Request submitted" }, TERM_W, TERM_H);
  const exits = buildSeq(wf.steps, "root", [{ source: "__start" }]);
  addNode("__end", { role: "end", label: "Approved" }, TERM_W, TERM_H);
  connect(exits, "__end", { seqId: "root", index: wf.steps.length });

  const g = new Graph();
  g.setGraph({ rankdir: "TB", nodesep: 48, ranksep: 56, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) {
    const [width, height] = sizes.get(n.id) ?? [STEP_W, STEP_H];
    g.setNode(n.id, { width, height });
  }
  for (const e of edges) g.setEdge(e.source, e.target);
  dagreLayout(g);
  for (const n of nodes) {
    const p = g.node(n.id);
    const [w, h] = sizes.get(n.id) ?? [STEP_W, STEP_H];
    n.position = { x: (p?.x ?? 0) - w / 2, y: (p?.y ?? 0) - h / 2 };
  }
  return { nodes, edges };
}
