import type { RuleGroupType, RuleType } from "react-querybuilder";
import type {
  ApproverRef,
  DirectoryPerson,
  SampleRequest,
  Step,
  StepKind,
  ValidationIssue,
  Workflow,
} from "@/components/crm/pro-approval-workflow/types";
import { workflowSchema } from "@/components/crm/pro-approval-workflow/types";

let seq = 0;
export function uid(prefix: string) {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* Tree helpers. They work on immer drafts as well as plain objects.   */
/* ------------------------------------------------------------------ */

/** Returns the mutable step array for a sequence id. */
export function findSequence(steps: Step[], seqId: string): Step[] | null {
  if (seqId === "root") return steps;
  for (const s of steps) {
    if (s.kind === "condition") {
      if (seqId === `${s.id}:then`) return s.then;
      if (seqId === `${s.id}:else`) return s.else;
      const hit = findSequence(s.then, seqId) ?? findSequence(s.else, seqId);
      if (hit) return hit;
    } else if (s.kind === "parallel") {
      for (const b of s.branches) {
        if (b.id === seqId) return b.steps;
        const hit = findSequence(b.steps, seqId);
        if (hit) return hit;
      }
    }
  }
  return null;
}

export function findStep(steps: Step[], id: string): Step | null {
  for (const s of steps) {
    if (s.id === id) return s;
    const kids =
      s.kind === "condition"
        ? [...s.then, ...s.else]
        : s.kind === "parallel"
          ? s.branches.flatMap((b) => b.steps)
          : [];
    const hit = kids.length ? findStep(kids, id) : null;
    if (hit) return hit;
  }
  return null;
}

/** Removes a step anywhere in the tree (mutates). Returns true if removed. */
export function removeStep(steps: Step[], id: string): boolean {
  const i = steps.findIndex((s) => s.id === id);
  if (i >= 0) {
    steps.splice(i, 1);
    return true;
  }
  for (const s of steps) {
    if (s.kind === "condition" && (removeStep(s.then, id) || removeStep(s.else, id))) return true;
    if (s.kind === "parallel" && s.branches.some((b) => removeStep(b.steps, id))) return true;
  }
  return false;
}

export function createStep(kind: StepKind): Step {
  const id = uid(kind.slice(0, 4));
  switch (kind) {
    case "approver":
      return {
        id,
        kind,
        label: "Approval",
        approvers: [{ type: "manager", levels: 1 }],
        mode: "any",
        slaHours: 24,
      };
    case "condition":
      return {
        id,
        kind,
        label: "Condition",
        rule: { combinator: "and", rules: [] },
        then: [],
        else: [],
      };
    case "parallel":
      return {
        id,
        kind,
        label: "Parallel review",
        join: "all",
        branches: [
          { id: uid("br"), label: "Branch A", steps: [] },
          { id: uid("br"), label: "Branch B", steps: [] },
        ],
      };
    case "outcome":
      return { id, kind, label: "Auto-approve", outcome: "approve" };
  }
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function validateWorkflow(wf: Workflow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parsed = workflowSchema.safeParse(wf);
  if (!parsed.success) {
    for (const i of parsed.error.issues.slice(0, 5))
      issues.push({ stepId: null, message: `${i.path.join(".") || "workflow"}: ${i.message}` });
  }
  const walk = (steps: Step[], where: string) => {
    if (steps.length === 0 && where !== "root")
      issues.push({ stepId: null, message: `${where} has no steps (request passes through)` });
    steps.forEach((s, i) => {
      if (s.kind === "outcome" && i < steps.length - 1)
        issues.push({ stepId: s.id, message: `"${s.label}" ends the flow; later steps never run` });
      if (s.kind === "approver" && s.approvers.length === 0)
        issues.push({ stepId: s.id, message: `"${s.label}" has no approvers` });
      if (s.kind === "condition") {
        if (s.rule.rules.length === 0)
          issues.push({ stepId: s.id, message: `"${s.label}" has no rules (always true)` });
        walk(s.then, `"${s.label}" / Yes`);
        walk(s.else, `"${s.label}" / No`);
      }
      if (s.kind === "parallel") {
        if (s.branches.length < 2)
          issues.push({ stepId: s.id, message: `"${s.label}" needs at least two branches` });
        s.branches.forEach((b) => walk(b.steps, `"${s.label}" / ${b.label}`));
      }
    });
  };
  walk(wf.steps, "root");
  if (wf.steps.length === 0) issues.push({ stepId: null, message: "Workflow has no steps" });
  return issues;
}

/* ------------------------------------------------------------------ */
/* Rule evaluation. react-querybuilder builds and formats queries but  */
/* ships no in-memory evaluator (its JsonLogic export needs an extra   */
/* runtime). This small evaluator covers every default operator.       */
/* ------------------------------------------------------------------ */

const toList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(String)
    : String(v ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

function cmp(a: unknown, b: unknown): number {
  const na = Number(a);
  const nb = Number(b);
  if (a !== "" && b !== "" && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function evalRule(rule: RuleType, rec: Record<string, unknown>): boolean {
  const left = rec[rule.field];
  const right = rule.valueSource === "field" ? rec[String(rule.value)] : rule.value;
  const ls = String(left ?? "").toLowerCase();
  const rs = String(right ?? "").toLowerCase();
  switch (rule.operator) {
    case "=":
      return cmp(left, right) === 0;
    case "!=":
      return cmp(left, right) !== 0;
    case "<":
      return cmp(left, right) < 0;
    case "<=":
      return cmp(left, right) <= 0;
    case ">":
      return cmp(left, right) > 0;
    case ">=":
      return cmp(left, right) >= 0;
    case "contains":
      return ls.includes(rs);
    case "doesNotContain":
      return !ls.includes(rs);
    case "beginsWith":
      return ls.startsWith(rs);
    case "doesNotBeginWith":
      return !ls.startsWith(rs);
    case "endsWith":
      return ls.endsWith(rs);
    case "doesNotEndWith":
      return !ls.endsWith(rs);
    case "null":
      return left == null || left === "";
    case "notNull":
      return !(left == null || left === "");
    case "in":
      return toList(right).some((x) => cmp(x, left) === 0);
    case "notIn":
      return !toList(right).some((x) => cmp(x, left) === 0);
    case "between":
    case "notBetween": {
      const [lo, hi] = toList(right);
      const inside =
        lo !== undefined && hi !== undefined && cmp(left, lo) >= 0 && cmp(left, hi) <= 0;
      return rule.operator === "between" ? inside : !inside;
    }
    default:
      return false;
  }
}

export function evaluateGroup(group: RuleGroupType, rec: Record<string, unknown>): boolean {
  if (group.rules.length === 0) return !group.not;
  const results = group.rules
    .filter((r): r is RuleType | RuleGroupType => typeof r !== "string")
    .map((r) => ("rules" in r ? evaluateGroup(r, rec) : evalRule(r, rec)));
  const out = group.combinator === "or" ? results.some(Boolean) : results.every(Boolean);
  return group.not ? !out : out;
}

/* ------------------------------------------------------------------ */
/* Simulation                                                          */
/* ------------------------------------------------------------------ */

export type SimNode =
  | {
      type: "approval";
      stepId: string;
      label: string;
      mode: "any" | "all";
      slaHours: number;
      people: DirectoryPerson[];
      unresolved: string[];
    }
  | { type: "decision"; stepId: string; label: string; result: boolean }
  | {
      type: "parallel";
      stepId: string;
      label: string;
      join: "all" | "any";
      branches: { id: string; label: string; nodes: SimNode[] }[];
    }
  | { type: "outcome"; stepId: string; label: string; outcome: "approve" | "reject" };

export interface SimResult {
  nodes: SimNode[];
  visited: Set<string>;
  final: "approve" | "reject" | "pending";
  approverCount: number;
  worstCaseHours: number;
}

export function describeRef(ref: ApproverRef, byId: Map<string, DirectoryPerson>): string {
  if (ref.type === "user") return byId.get(ref.userId)?.name ?? `Unknown user (${ref.userId})`;
  if (ref.type === "role") return `Role: ${ref.role}`;
  return ref.levels === 1 ? "Requester's manager" : `Manager chain (${ref.levels} levels)`;
}

export function resolveRef(
  ref: ApproverRef,
  requesterId: string,
  directory: DirectoryPerson[],
  byId: Map<string, DirectoryPerson>,
): { people: DirectoryPerson[]; unresolved?: string } {
  if (ref.type === "user") {
    const p = byId.get(ref.userId);
    return p ? { people: [p] } : { people: [], unresolved: `user ${ref.userId}` };
  }
  if (ref.type === "role") {
    const people = directory.filter((p) => p.roles.includes(ref.role));
    return people.length ? { people } : { people: [], unresolved: `nobody holds role ${ref.role}` };
  }
  const people: DirectoryPerson[] = [];
  let cur = byId.get(requesterId);
  for (let i = 0; i < ref.levels; i++) {
    const mgr = cur?.managerId ? byId.get(cur.managerId) : undefined;
    if (!mgr) break;
    people.push(mgr);
    cur = mgr;
  }
  return people.length
    ? { people }
    : { people: [], unresolved: "requester has no manager on file" };
}

export function simulate(
  wf: Workflow,
  sample: SampleRequest,
  directory: DirectoryPerson[],
): SimResult {
  const byId = new Map(directory.map((p) => [p.id, p]));
  const visited = new Set<string>();
  let approverCount = 0;
  let ended: "approve" | "reject" | null = null;

  const run = (steps: Step[]): { nodes: SimNode[]; hours: number } => {
    const nodes: SimNode[] = [];
    let hours = 0;
    for (const s of steps) {
      if (ended) break;
      visited.add(s.id);
      if (s.kind === "approver") {
        const seen = new Set<string>();
        const people: DirectoryPerson[] = [];
        const unresolved: string[] = [];
        for (const ref of s.approvers) {
          const r = resolveRef(ref, sample.requesterId, directory, byId);
          if (r.unresolved) unresolved.push(r.unresolved);
          for (const p of r.people)
            if (!seen.has(p.id) && p.id !== sample.requesterId) {
              seen.add(p.id);
              people.push(p);
            }
        }
        approverCount += s.mode === "all" ? people.length : Math.min(1, people.length);
        hours += s.slaHours;
        nodes.push({
          type: "approval",
          stepId: s.id,
          label: s.label,
          mode: s.mode,
          slaHours: s.slaHours,
          people,
          unresolved,
        });
      } else if (s.kind === "condition") {
        const result = evaluateGroup(s.rule, sample);
        nodes.push({ type: "decision", stepId: s.id, label: s.label, result });
        visited.add(result ? `${s.id}:then` : `${s.id}:else`);
        const sub = run(result ? s.then : s.else);
        nodes.push(...sub.nodes);
        hours += sub.hours;
      } else if (s.kind === "parallel") {
        const branches = s.branches.map((b) => {
          visited.add(b.id);
          const before = ended;
          const r = run(b.steps);
          // An outcome inside one branch only ends the flow for that branch.
          if (!before) ended = null;
          return { id: b.id, label: b.label, nodes: r.nodes, hours: r.hours };
        });
        const hs = branches.map((b) => b.hours);
        hours += hs.length ? (s.join === "all" ? Math.max(...hs) : Math.min(...hs)) : 0;
        nodes.push({
          type: "parallel",
          stepId: s.id,
          label: s.label,
          join: s.join,
          branches: branches.map(({ id, label, nodes: n }) => ({ id, label, nodes: n })),
        });
      } else {
        nodes.push({ type: "outcome", stepId: s.id, label: s.label, outcome: s.outcome });
        ended = s.outcome;
      }
    }
    return { nodes, hours };
  };

  const { nodes, hours } = run(wf.steps);
  const final: SimResult["final"] =
    ended ??
    (nodes.some((n) => n.type !== "decision") && approverCount > 0 ? "pending" : "approve");
  return { nodes, visited, final, approverCount, worstCaseHours: hours };
}

export function countSteps(steps: Step[]): number {
  let n = 0;
  for (const s of steps) {
    n += 1;
    if (s.kind === "condition") n += countSteps(s.then) + countSteps(s.else);
    if (s.kind === "parallel") n += s.branches.reduce((a, b) => a + countSteps(b.steps), 0);
  }
  return n;
}
