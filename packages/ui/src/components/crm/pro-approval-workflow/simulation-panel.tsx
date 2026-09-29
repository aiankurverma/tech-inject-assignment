import * as React from "react";
import { CheckCircle2, Clock, GitBranch, Hourglass, Split, UserCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SimNode, SimResult } from "@/components/crm/pro-approval-workflow/model";
import type {
  DirectoryPerson,
  SampleRequest,
  WorkflowField,
} from "@/components/crm/pro-approval-workflow/types";

const input =
  "h-8 w-full rounded-md border border-crm-input bg-crm-bg px-2 text-[13px] text-crm-fg outline-none focus-visible:border-crm-primary focus-visible:ring-2 focus-visible:ring-crm-ring";

export interface SimulationPanelProps {
  fields: WorkflowField[];
  directory: DirectoryPerson[];
  sample: SampleRequest;
  onSampleChange: (s: SampleRequest) => void;
  result: SimResult;
}

export function SimulationPanel({
  fields,
  directory,
  sample,
  onSampleChange,
  result,
}: SimulationPanelProps) {
  const set = (k: string, v: string | number) => onSampleChange({ ...sample, [k]: v });
  return (
    <div className="flex flex-col gap-4 p-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-medium text-crm-fg">Sample request</legend>
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-crm-muted-fg">Requester</span>
          <select
            className={input}
            value={sample.requesterId}
            onChange={(e) => set("requesterId", e.target.value)}
          >
            {directory.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.title}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) => {
            const opts = "values" in f && Array.isArray(f.values) ? f.values : null;
            return (
              <label key={f.name} className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[11.5px] font-medium text-crm-muted-fg">
                  {f.label}
                </span>
                {opts ? (
                  <select
                    className={input}
                    value={String(sample[f.name] ?? "")}
                    onChange={(e) => set(f.name, e.target.value)}
                  >
                    {(opts as { name: string; label: string }[]).map((o) => (
                      <option key={o.name} value={o.name}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={input}
                    type={f.inputType === "number" ? "number" : "text"}
                    value={String(sample[f.name] ?? "")}
                    onChange={(e) =>
                      set(
                        f.name,
                        f.inputType === "number" ? Number(e.target.value) : e.target.value,
                      )
                    }
                  />
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center gap-2 rounded-crm border p-3 text-[13px]",
          result.final === "reject"
            ? "border-tag-red-border bg-tag-red-bg text-tag-red-text"
            : result.final === "approve"
              ? "border-tag-green-border bg-tag-green-bg text-tag-green-text"
              : "border-tag-blue-border bg-tag-blue-bg text-tag-blue-text",
        )}
      >
        {result.final === "reject" ? (
          <XCircle className="size-4" />
        ) : result.final === "approve" ? (
          <CheckCircle2 className="size-4" />
        ) : (
          <Hourglass className="size-4" />
        )}
        <span className="font-medium">
          {result.final === "reject"
            ? "Auto-rejected"
            : result.final === "approve"
              ? "Auto-approved"
              : `Needs ${result.approverCount} sign-off${result.approverCount === 1 ? "" : "s"}`}
        </span>
        {result.worstCaseHours > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[12px]">
            <Clock className="size-3.5" /> ≤ {result.worstCaseHours}h by SLA
          </span>
        )}
      </div>

      <div>
        <p className="mb-2 text-[12px] font-medium text-crm-muted-fg">Route taken</p>
        {result.nodes.length === 0 ? (
          <p className="text-[12.5px] text-crm-muted-fg">No steps ran for this request.</p>
        ) : (
          <SimList nodes={result.nodes} />
        )}
      </div>
    </div>
  );
}

function SimList({ nodes }: { nodes: SimNode[] }) {
  return (
    <ol className="flex flex-col gap-1.5 border-l border-crm-border pl-3">
      {nodes.map((n) => (
        <li key={n.stepId} className="text-[12.5px]">
          {n.type === "approval" && (
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 font-medium text-crm-fg">
                <UserCheck className="size-3.5 text-tag-blue-text" />
                {n.label}
                <span className="font-normal text-crm-muted-fg">
                  · {n.mode === "all" ? "all must approve" : "any one"} · {n.slaHours}h
                </span>
              </span>
              <div className="flex flex-wrap gap-1">
                {n.people.map((p) => (
                  <span
                    key={p.id}
                    className="rounded-full border border-crm-border bg-crm-raised px-2 py-px text-[11.5px] text-crm-soft"
                    title={p.title}
                  >
                    {p.name}
                  </span>
                ))}
                {n.unresolved.map((u) => (
                  <span
                    key={u}
                    className="rounded-full border border-tag-amber-border bg-tag-amber-bg px-2 py-px text-[11.5px] text-tag-amber-text"
                  >
                    {u}
                  </span>
                ))}
              </div>
            </div>
          )}
          {n.type === "decision" && (
            <span className="flex items-center gap-1.5 text-crm-soft">
              <GitBranch className="size-3.5 text-tag-amber-text" />
              {n.label} →{" "}
              <b className={n.result ? "text-crm-success" : "text-crm-warning"}>
                {n.result ? "Yes" : "No"}
              </b>
            </span>
          )}
          {n.type === "outcome" && (
            <span
              className={cn(
                "flex items-center gap-1.5 font-medium",
                n.outcome === "approve" ? "text-crm-success" : "text-crm-danger",
              )}
            >
              {n.outcome === "approve" ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <XCircle className="size-3.5" />
              )}
              {n.label}
            </span>
          )}
          {n.type === "parallel" && (
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 font-medium text-crm-fg">
                <Split className="size-3.5 text-tag-purple-text" />
                {n.label}
                <span className="font-normal text-crm-muted-fg">· wait for {n.join}</span>
              </span>
              {n.branches.map((b) => (
                <div key={b.id} className="ml-1">
                  <p className="text-[11.5px] text-crm-muted-fg">{b.label}</p>
                  {b.nodes.length ? (
                    <SimList nodes={b.nodes} />
                  ) : (
                    <p className="pl-3 text-[11.5px] text-crm-faint">passes through</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
