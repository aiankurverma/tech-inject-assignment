import * as React from "react";
import { QueryBuilder, type Field, type RuleGroupType } from "react-querybuilder";
import { Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_META } from "@/components/crm/pro-approval-workflow/flow-parts";
import {
  describeRef,
  findStep,
  removeStep,
  uid,
} from "@/components/crm/pro-approval-workflow/model";
import type { WorkflowStore } from "@/components/crm/pro-approval-workflow/store";
import type {
  ApproverRef,
  DirectoryPerson,
  Step,
  ValidationIssue,
  WorkflowField,
} from "@/components/crm/pro-approval-workflow/types";
import { useStore } from "zustand";

const input =
  "h-8 w-full rounded-md border border-crm-input bg-crm-bg px-2 text-[13px] text-crm-fg outline-none focus-visible:border-crm-primary focus-visible:ring-2 focus-visible:ring-crm-ring disabled:opacity-50";
const label = "text-[11.5px] font-medium text-crm-muted-fg";
const ghostBtn =
  "inline-flex h-7 items-center gap-1 rounded-md border border-crm-border px-2 text-[12px] text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring disabled:opacity-50";

/** Class names handed to react-querybuilder so the rule editor uses CRM tokens. */
const qbClasses = {
  queryBuilder: "text-[12.5px]",
  ruleGroup:
    "flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-bg/60 p-2 [&_.ruleGroup]:ml-2",
  header: "flex flex-wrap items-center gap-1.5",
  body: "flex flex-col gap-1.5",
  rule: "flex flex-wrap items-center gap-1.5",
  combinators: "h-7 rounded-md border border-crm-input bg-crm-raised px-1.5 text-crm-fg",
  fields: "h-7 max-w-[9rem] rounded-md border border-crm-input bg-crm-raised px-1.5 text-crm-fg",
  operators: "h-7 max-w-[8rem] rounded-md border border-crm-input bg-crm-raised px-1.5 text-crm-fg",
  value: "h-7 min-w-0 flex-1 rounded-md border border-crm-input bg-crm-bg px-1.5 text-crm-fg",
  addRule:
    "h-7 rounded-md border border-crm-border px-2 text-crm-soft hover:bg-crm-muted hover:text-crm-fg",
  addGroup:
    "h-7 rounded-md border border-crm-border px-2 text-crm-soft hover:bg-crm-muted hover:text-crm-fg",
  removeRule: "grid size-7 place-items-center rounded-md text-crm-muted-fg hover:text-crm-danger",
  removeGroup: "grid size-7 place-items-center rounded-md text-crm-muted-fg hover:text-crm-danger",
  notToggle: "flex items-center gap-1 text-crm-soft",
};

export interface InspectorProps {
  store: WorkflowStore;
  fields: WorkflowField[];
  directory: DirectoryPerson[];
  roles: string[];
  issues: ValidationIssue[];
  readOnly: boolean;
}

export function Inspector({ store, fields, directory, roles, issues, readOnly }: InspectorProps) {
  const selectedId = useStore(store, (s) => s.selectedId);
  const workflow = useStore(store, (s) => s.workflow);
  const edit = useStore(store, (s) => s.edit);
  const select = useStore(store, (s) => s.select);
  const step = selectedId ? findStep(workflow.steps, selectedId) : null;
  const byId = React.useMemo(() => new Map(directory.map((p) => [p.id, p])), [directory]);

  const update = React.useCallback(
    (fn: (s: Step) => void) => {
      if (!selectedId) return;
      edit((d) => {
        const target = findStep(d.steps as Step[], selectedId);
        if (target) fn(target);
      });
    },
    [edit, selectedId],
  );

  if (!step)
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[13px] font-medium text-crm-fg">Workflow</p>
        <label className="flex flex-col gap-1">
          <span className={label}>Name</span>
          <input
            className={input}
            value={workflow.name}
            disabled={readOnly}
            maxLength={120}
            onChange={(e) =>
              edit((d) => {
                d.name = e.target.value;
              })
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Request type</span>
          <input
            className={input}
            value={workflow.requestType}
            disabled={readOnly}
            onChange={(e) =>
              edit((d) => {
                d.requestType = e.target.value;
              })
            }
          />
        </label>
        <p className="text-[12px] leading-relaxed text-crm-muted-fg">
          Select a step on the canvas to edit it, or use the <Plus className="inline size-3" /> on
          any connector to insert a new approver, condition, parallel block or outcome.
        </p>
      </div>
    );

  const meta = KIND_META[step.kind];
  const stepIssues = issues.filter((i) => i.stepId === step.id);

  return (
    <div className="flex flex-col gap-4 p-4" aria-label={`Edit ${step.label}`}>
      <div className="flex items-center gap-2">
        <span className={cn("grid size-6 place-items-center rounded-md", meta.tone)}>
          <meta.icon className="size-3.5" />
        </span>
        <span className="text-[13px] font-medium text-crm-fg">{meta.label} step</span>
        <button
          type="button"
          className="ml-auto grid size-7 place-items-center rounded-md text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
          aria-label="Close inspector"
          onClick={() => select(null)}
        >
          <X className="size-4" />
        </button>
      </div>
      {stepIssues.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border border-tag-amber-border bg-tag-amber-bg p-2 text-[12px] text-tag-amber-text">
          {stepIssues.map((i) => (
            <li key={i.message}>{i.message}</li>
          ))}
        </ul>
      )}
      <label className="flex flex-col gap-1">
        <span className={label}>Label</span>
        <input
          className={input}
          value={step.label}
          maxLength={80}
          disabled={readOnly}
          onChange={(e) => update((s) => void (s.label = e.target.value))}
        />
      </label>

      {step.kind === "approver" && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Approvers</span>
            {step.approvers.length === 0 && (
              <p className="text-[12px] text-crm-warning">No approvers — add at least one.</p>
            )}
            <ul className="flex flex-col gap-1">
              {step.approvers.map((ref, i) => (
                <li
                  key={`${ref.type}-${i}`}
                  className="flex items-center gap-2 rounded-md border border-crm-border bg-crm-bg px-2 py-1 text-[12.5px]"
                >
                  <span className="min-w-0 flex-1 truncate text-crm-fg">
                    {describeRef(ref, byId)}
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      aria-label={`Remove ${describeRef(ref, byId)}`}
                      className="text-crm-muted-fg hover:text-crm-danger"
                      onClick={() =>
                        update((s) => {
                          if (s.kind === "approver") s.approvers.splice(i, 1);
                        })
                      }
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!readOnly && (
              <AddApprover
                directory={directory}
                roles={roles}
                onAdd={(ref) =>
                  update((s) => {
                    if (s.kind === "approver") s.approvers.push(ref);
                  })
                }
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className={label}>Needs</span>
              <select
                className={input}
                value={step.mode}
                disabled={readOnly}
                onChange={(e) =>
                  update((s) => {
                    if (s.kind === "approver") s.mode = e.target.value as "any" | "all";
                  })
                }
              >
                <option value="any">Any one approver</option>
                <option value="all">All approvers</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>SLA (hours)</span>
              <input
                type="number"
                min={1}
                max={720}
                className={input}
                value={step.slaHours}
                disabled={readOnly}
                onChange={(e) =>
                  update((s) => {
                    if (s.kind === "approver")
                      s.slaHours = Math.min(720, Math.max(1, Math.round(+e.target.value || 1)));
                  })
                }
              />
            </label>
          </div>
        </>
      )}

      {step.kind === "condition" && (
        <div className="flex flex-col gap-1.5">
          <span className={label}>Take the “Yes” path when</span>
          <QueryBuilder
            fields={fields as Field[]}
            query={step.rule}
            disabled={readOnly}
            controlClassnames={qbClasses}
            onQueryChange={(q: RuleGroupType) =>
              update((s) => {
                if (s.kind === "condition") s.rule = q;
              })
            }
          />
        </div>
      )}

      {step.kind === "parallel" && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className={label}>Continue when</span>
            <select
              className={input}
              value={step.join}
              disabled={readOnly}
              onChange={(e) =>
                update((s) => {
                  if (s.kind === "parallel") s.join = e.target.value as "all" | "any";
                })
              }
            >
              <option value="all">All branches finish</option>
              <option value="any">Any branch finishes</option>
            </select>
          </label>
          <span className={label}>Branches</span>
          {step.branches.map((b, i) => (
            <div key={b.id} className="flex items-center gap-1.5">
              <input
                className={input}
                aria-label={`Branch ${i + 1} name`}
                value={b.label}
                disabled={readOnly}
                onChange={(e) =>
                  update((s) => {
                    if (s.kind === "parallel" && s.branches[i])
                      s.branches[i].label = e.target.value;
                  })
                }
              />
              <span className="shrink-0 text-[11px] text-crm-muted-fg">
                {b.steps.length} step{b.steps.length === 1 ? "" : "s"}
              </span>
              {!readOnly && step.branches.length > 2 && (
                <button
                  type="button"
                  aria-label={`Remove branch ${b.label}`}
                  className="text-crm-muted-fg hover:text-crm-danger"
                  onClick={() =>
                    update((s) => {
                      if (s.kind === "parallel") s.branches.splice(i, 1);
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          {!readOnly && step.branches.length < 6 && (
            <button
              type="button"
              className={cn(ghostBtn, "self-start")}
              onClick={() =>
                update((s) => {
                  if (s.kind === "parallel")
                    s.branches.push({
                      id: uid("br"),
                      label: `Branch ${String.fromCharCode(65 + s.branches.length)}`,
                      steps: [],
                    });
                })
              }
            >
              <Plus className="size-3" /> Add branch
            </button>
          )}
        </div>
      )}

      {step.kind === "outcome" && (
        <label className="flex flex-col gap-1">
          <span className={label}>Outcome</span>
          <select
            className={input}
            value={step.outcome}
            disabled={readOnly}
            onChange={(e) =>
              update((s) => {
                if (s.kind === "outcome") s.outcome = e.target.value as "approve" | "reject";
              })
            }
          >
            <option value="approve">Approve automatically</option>
            <option value="reject">Reject automatically</option>
          </select>
        </label>
      )}

      {!readOnly && (
        <button
          type="button"
          className={cn(ghostBtn, "self-start text-crm-danger hover:text-crm-danger")}
          onClick={() => {
            const id = step.id;
            select(null);
            edit((d) => void removeStep(d.steps as Step[], id));
          }}
        >
          <Trash2 className="size-3" /> Delete step
          {step.kind !== "approver" && step.kind !== "outcome" ? " and its branches" : ""}
        </button>
      )}
    </div>
  );
}

function AddApprover({
  directory,
  roles,
  onAdd,
}: {
  directory: DirectoryPerson[];
  roles: string[];
  onAdd: (ref: ApproverRef) => void;
}) {
  const [type, setType] = React.useState<ApproverRef["type"]>("role");
  const [value, setValue] = React.useState("");
  const submit = () => {
    if (type === "manager") onAdd({ type, levels: Math.min(6, Math.max(1, +value || 1)) });
    else if (!value) return;
    else if (type === "role") onAdd({ type, role: value });
    else onAdd({ type, userId: value });
    setValue("");
  };
  return (
    <div className="flex items-center gap-1.5">
      <select
        aria-label="Approver type"
        className={cn(input, "w-24 shrink-0")}
        value={type}
        onChange={(e) => {
          setType(e.target.value as ApproverRef["type"]);
          setValue("");
        }}
      >
        <option value="role">Role</option>
        <option value="user">Person</option>
        <option value="manager">Manager</option>
      </select>
      {type === "manager" ? (
        <select
          aria-label="Manager levels"
          className={input}
          value={value || "1"}
          onChange={(e) => setValue(e.target.value)}
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n === 1 ? "Direct manager" : `${n} levels up`}
            </option>
          ))}
        </select>
      ) : (
        <select
          aria-label={type === "role" ? "Role" : "Person"}
          className={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="">Choose…</option>
          {type === "role"
            ? roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))
            : directory.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.title}
                </option>
              ))}
        </select>
      )}
      <button type="button" className={ghostBtn} onClick={submit} aria-label="Add approver">
        <Plus className="size-3" />
      </button>
    </div>
  );
}
