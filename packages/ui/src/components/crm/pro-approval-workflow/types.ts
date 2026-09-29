import { z } from "zod";
import type { Field, RuleGroupType } from "react-querybuilder";

/* ------------------------------------------------------------------ */
/* Runtime schemas (zod) — the single source of truth for JSON import  */
/* and export. Types are inferred from them.                           */
/* ------------------------------------------------------------------ */

const ruleSchema: z.ZodType<RuleLike> = z.lazy(() =>
  z.union([
    z.object({
      id: z.string().optional(),
      field: z.string(),
      operator: z.string(),
      value: z.any(),
      valueSource: z.enum(["value", "field"]).optional(),
    }),
    ruleGroupSchema,
  ]),
);

type RuleLike =
  | {
      id?: string;
      field: string;
      operator: string;
      value?: unknown;
      valueSource?: "value" | "field";
    }
  | { id?: string; combinator: string; not?: boolean; rules: RuleLike[] };

export const ruleGroupSchema: z.ZodType<{
  id?: string;
  combinator: string;
  not?: boolean;
  rules: RuleLike[];
}> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    combinator: z.string(),
    not: z.boolean().optional(),
    rules: z.array(ruleSchema),
  }),
);

export const approverRefSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("user"), userId: z.string().min(1) }),
  z.object({ type: z.literal("role"), role: z.string().min(1) }),
  z.object({ type: z.literal("manager"), levels: z.number().int().min(1).max(6) }),
]);

const baseStep = { id: z.string().min(1), label: z.string().min(1).max(80) };

export const stepSchema: z.ZodType<Step> = z.lazy(
  () =>
    z.discriminatedUnion("kind", [
      z.object({
        ...baseStep,
        kind: z.literal("approver"),
        approvers: z.array(approverRefSchema),
        mode: z.enum(["any", "all"]),
        slaHours: z.number().int().min(1).max(720),
      }),
      z.object({
        ...baseStep,
        kind: z.literal("condition"),
        rule: ruleGroupSchema,
        then: z.array(stepSchema),
        else: z.array(stepSchema),
      }),
      z.object({
        ...baseStep,
        kind: z.literal("parallel"),
        join: z.enum(["all", "any"]),
        branches: z.array(
          z.object({ id: z.string().min(1), label: z.string().min(1), steps: z.array(stepSchema) }),
        ),
      }),
      z.object({
        ...baseStep,
        kind: z.literal("outcome"),
        outcome: z.enum(["approve", "reject"]),
      }),
    ]) as z.ZodType<Step>,
);

export const workflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  version: z.number().int().min(1),
  requestType: z.string().min(1),
  steps: z.array(stepSchema),
});

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ApproverRef = z.infer<typeof approverRefSchema>;

export interface ApproverStep {
  id: string;
  label: string;
  kind: "approver";
  approvers: ApproverRef[];
  mode: "any" | "all";
  slaHours: number;
}
export interface ConditionStep {
  id: string;
  label: string;
  kind: "condition";
  rule: RuleGroupType;
  then: Step[];
  else: Step[];
}
export interface ParallelBranch {
  id: string;
  label: string;
  steps: Step[];
}
export interface ParallelStep {
  id: string;
  label: string;
  kind: "parallel";
  join: "all" | "any";
  branches: ParallelBranch[];
}
export interface OutcomeStep {
  id: string;
  label: string;
  kind: "outcome";
  outcome: "approve" | "reject";
}
export type Step = ApproverStep | ConditionStep | ParallelStep | OutcomeStep;
export type StepKind = Step["kind"];

export interface Workflow {
  id: string;
  name: string;
  version: number;
  /** e.g. "discount", "spend", "refund" — informational, exported with the JSON. */
  requestType: string;
  steps: Step[];
}

/** A person in the approver directory, used to resolve roles and manager chains. */
export interface DirectoryPerson {
  id: string;
  name: string;
  title: string;
  roles: string[];
  managerId?: string | null;
}

/** Field definitions for the rule editor and the simulation form. */
export type WorkflowField = Field & {
  inputType?: "text" | "number";
  /** Default value used by the simulation panel. */
  sample?: string | number;
};

export type SampleRequest = Record<string, string | number> & { requesterId: string };

export interface ValidationIssue {
  stepId: string | null;
  message: string;
}

/** Where a new step is inserted: a sequence id ("root", "<cond>:then", "<cond>:else", branch id) and index. */
export interface InsertPoint {
  seqId: string;
  index: number;
}
