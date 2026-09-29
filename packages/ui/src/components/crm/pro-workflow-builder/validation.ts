import { z } from "zod";
import type { Connection } from "@xyflow/react";
import type {
  FieldDef,
  NodeDefinition,
  WorkflowEdge,
  WorkflowJSON,
  WorkflowNode,
} from "@/components/crm/pro-workflow-builder/types";
import { workflowJsonSchema } from "@/components/crm/pro-workflow-builder/types";

export type DefMap = ReadonlyMap<string, NodeDefinition>;

/** Why a connection is rejected, or null when it is allowed. */
export function connectionError(
  c: Connection | WorkflowEdge,
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
  defs: DefMap,
): string | null {
  if (!c.source || !c.target) return "Incomplete connection";
  if (c.source === c.target) return "A step cannot connect to itself";
  const s = nodes.find((n) => n.id === c.source);
  const t = nodes.find((n) => n.id === c.target);
  const sd = s && defs.get(s.data.defType);
  const td = t && defs.get(t.data.defType);
  if (!sd || !td) return "Unknown step type";
  const out = sd.outputs.find((p) => p.id === c.sourceHandle);
  const inp = td.inputs.find((p) => p.id === c.targetHandle);
  if (!out || !inp) return "Unknown port";
  if (!inp.accepts.includes(out.type))
    return `“${inp.label ?? inp.id}” accepts ${inp.accepts.join(" / ")}, not ${out.type}`;
  if (edges.some((e) => e.source === c.source && e.sourceHandle === c.sourceHandle))
    return `“${out.label ?? out.id}” is already connected`;
  if (reaches(c.target, c.source, edges)) return "This would create a loop";
  return null;
}

/** Iterative DFS: is `to` reachable from `from`? O(V + E). */
function reaches(from: string, to: string, edges: readonly WorkflowEdge[]) {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.source);
    if (list) list.push(e.target);
    else adj.set(e.source, [e.target]);
  }
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const n of adj.get(id) ?? []) stack.push(n);
  }
  return false;
}

/** Builds a zod schema for a node's config from its field definitions. */
const schemaCache = new WeakMap<NodeDefinition, z.ZodType<Record<string, unknown>>>();
export function configSchema(def: NodeDefinition) {
  let s = schemaCache.get(def);
  if (s) return s;
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of def.fields) shape[f.key] = fieldSchema(f);
  s = z.object(shape).passthrough() as unknown as z.ZodType<Record<string, unknown>>;
  schemaCache.set(def, s);
  return s;
}

function fieldSchema(f: FieldDef): z.ZodTypeAny {
  switch (f.kind) {
    case "switch":
      return z.boolean().optional();
    case "number": {
      let n = z.number({ invalid_type_error: "Enter a number" });
      if (f.min !== undefined) n = n.min(f.min, `Minimum ${f.min}`);
      if (f.max !== undefined) n = n.max(f.max, `Maximum ${f.max}`);
      return f.required ? n : n.optional();
    }
    case "select": {
      const values = f.options.map((o) => o.value);
      const sel = z.string().refine((v) => values.includes(v), "Pick an option");
      return f.required ? sel : sel.optional().or(z.literal(""));
    }
    default: {
      let t = z.string();
      if (f.maxLength) t = t.max(f.maxLength, `At most ${f.maxLength} characters`);
      return f.required ? t.trim().min(1, "Required") : t.optional();
    }
  }
}

export interface Issue {
  nodeId?: string;
  field?: string;
  message: string;
  /** Field-level message without the step name prefix. */
  detail?: string;
  severity: "error" | "warning";
}

/** Whole-graph lint: config errors, missing trigger, unreachable steps. O(V + E). */
export function lintWorkflow(
  nodes: readonly WorkflowNode[],
  edges: readonly WorkflowEdge[],
  defs: DefMap,
) {
  const issues: Issue[] = [];
  const incoming = new Set(edges.map((e) => e.target));
  let triggers = 0;
  for (const n of nodes) {
    const def = defs.get(n.data.defType);
    if (!def) {
      issues.push({
        nodeId: n.id,
        message: `Unknown step type ${n.data.defType}`,
        severity: "error",
      });
      continue;
    }
    if (def.kind === "trigger") triggers++;
    else if (!incoming.has(n.id))
      issues.push({
        nodeId: n.id,
        message: `“${n.data.label}” is not connected`,
        severity: "warning",
      });
    const res = configSchema(def).safeParse(n.data.config);
    if (!res.success)
      for (const i of res.error.issues)
        issues.push({
          nodeId: n.id,
          field: String(i.path[0] ?? ""),
          message: `${n.data.label}: ${i.message}`,
          detail: i.message,
          severity: "error",
        });
  }
  if (nodes.length && !triggers)
    issues.push({ message: "Add a trigger to start the workflow", severity: "error" });
  return issues;
}

/** Parses untrusted JSON into a workflow, checking step types and edges against the catalogue. */
export function parseWorkflow(
  raw: unknown,
  defs: DefMap,
): { ok: true; workflow: WorkflowJSON } | { ok: false; errors: string[] } {
  const parsed = workflowJsonSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      errors: parsed.error.issues
        .slice(0, 6)
        .map((i) => `${i.path.join(".") || "file"}: ${i.message}`),
    };
  const wf = parsed.data;
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const n of wf.nodes) {
    if (ids.has(n.id)) errors.push(`Duplicate step id ${n.id}`);
    ids.add(n.id);
    if (!defs.has(n.type)) errors.push(`Unknown step type ${n.type}`);
  }
  for (const e of wf.edges)
    if (!ids.has(e.source) || !ids.has(e.target))
      errors.push(`Edge ${e.id} points to a missing step`);
  return errors.length ? { ok: false, errors: errors.slice(0, 6) } : { ok: true, workflow: wf };
}
