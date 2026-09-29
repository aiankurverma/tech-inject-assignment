import * as React from "react";
import { AlertCircle, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBuilder, useWorkflow } from "@/components/crm/pro-workflow-builder/context";
import type { FieldDef } from "@/components/crm/pro-workflow-builder/types";
import type { Issue } from "@/components/crm/pro-workflow-builder/validation";

const inputCls =
  "w-full rounded-crm border border-crm-input bg-crm-bg px-2.5 py-1.5 text-sm text-crm-fg placeholder:text-crm-subtle focus:border-crm-ring focus:outline-none disabled:opacity-50";

function Field({
  field,
  value,
  error,
  disabled,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  error?: string;
  disabled?: boolean;
  onChange: (v: unknown) => void;
}) {
  const id = React.useId();
  const describedBy =
    [error && `${id}-err`, field.help && `${id}-help`].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    disabled,
    "aria-invalid": !!error || undefined,
    "aria-describedby": describedBy,
  };
  let control: React.ReactNode;
  switch (field.kind) {
    case "switch":
      control = (
        <button
          {...common}
          type="button"
          role="switch"
          aria-checked={!!value}
          onClick={() => onChange(!value)}
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            value ? "bg-crm-primary" : "bg-crm-track",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left]",
              value ? "left-[18px]" : "left-0.5",
            )}
          />
        </button>
      );
      break;
    case "select":
      control = (
        <select
          {...common}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        >
          <option value="">Select…</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case "number":
      control = (
        <div className="flex items-center gap-2">
          <input
            {...common}
            type="number"
            inputMode="decimal"
            min={field.min}
            max={field.max}
            value={typeof value === "number" && Number.isFinite(value) ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)}
            className={inputCls}
          />
          {field.unit && <span className="text-xs text-crm-subtle">{field.unit}</span>}
        </div>
      );
      break;
    case "textarea":
      control = (
        <textarea
          {...common}
          rows={4}
          placeholder={field.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputCls, "resize-y")}
        />
      );
      break;
    default:
      control = (
        <input
          {...common}
          placeholder={field.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
  }
  return (
    <div className={cn(field.kind === "switch" && "flex items-center justify-between gap-3")}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-crm-soft">
        {field.label}
        {"required" in field && field.required && <span className="text-crm-danger"> *</span>}
      </label>
      {control}
      {field.help && (
        <p id={`${id}-help`} className="mt-1 text-[11px] text-crm-subtle">
          {field.help}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-1 text-[11px] text-crm-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function ConfigPanel({ issues }: { issues: Issue[] }) {
  const { store, defs, readOnly, runState } = useBuilder();
  const selectedId = useWorkflow((s) => s.selectedId);
  const node = useWorkflow((s) =>
    s.selectedId ? s.nodes.find((n) => n.id === s.selectedId) : undefined,
  );
  const name = useWorkflow((s) => s.name);
  const counts = useWorkflow((s) => `${s.nodes.length} steps · ${s.edges.length} connections`);
  const actions = store.getState();

  if (!node || !selectedId) {
    return (
      <div className="flex h-full flex-col gap-4 overflow-auto bg-crm-sidebar p-4 text-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-crm-soft" htmlFor="kb-wf-name">
            Workflow name
          </label>
          <input
            id="kb-wf-name"
            className={inputCls}
            value={name}
            disabled={readOnly}
            onChange={(e) => actions.setName(e.target.value)}
          />
          <p className="mt-1 text-xs text-crm-subtle">{counts}</p>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-crm-subtle">
            Checks {issues.length ? `(${issues.length})` : ""}
          </p>
          {issues.length === 0 ? (
            <p className="text-xs text-crm-success">Ready to publish — no problems found.</p>
          ) : (
            <ul className="space-y-1">
              {issues.slice(0, 50).map((i, k) => (
                <li key={k}>
                  <button
                    type="button"
                    disabled={!i.nodeId}
                    onClick={() => i.nodeId && actions.select(i.nodeId)}
                    className="flex w-full items-start gap-2 rounded-crm px-2 py-1 text-left text-xs text-crm-chip hover:bg-crm-raised disabled:hover:bg-transparent"
                  >
                    <AlertCircle
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        i.severity === "error" ? "text-crm-danger" : "text-crm-warning",
                      )}
                    />
                    {i.message}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-auto rounded-crm border border-crm-border p-3 text-[11px] leading-5 text-crm-subtle">
          <p className="mb-1 font-medium text-crm-soft">Shortcuts</p>
          <p>Ctrl+Z undo · Ctrl+Shift+Z / Ctrl+Y redo</p>
          <p>Delete removes selection · Ctrl+D duplicates</p>
          <p>Ctrl+Shift+L tidies the layout</p>
        </div>
      </div>
    );
  }

  const def = defs.get(node.data.defType);
  const fieldErrors = new Map(
    issues
      .filter((i) => i.nodeId === node.id && i.field)
      .map((i) => [i.field!, i.detail ?? i.message]),
  );
  const run = runState?.[node.id];

  return (
    <div className="flex h-full flex-col overflow-auto bg-crm-sidebar" aria-label="Step settings">
      <div className="flex items-center gap-2 border-b border-crm-border p-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-crm bg-crm-muted text-crm-icon [&_svg]:h-4 [&_svg]:w-4">
          {def?.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{def?.label ?? node.data.defType}</p>
          <p className="truncate text-[11px] text-crm-subtle">{node.data.defType}</p>
        </div>
        {!readOnly && (
          <>
            <button
              type="button"
              aria-label="Duplicate step"
              onClick={() => actions.duplicate(node.id)}
              className="rounded-crm p-1.5 text-crm-soft hover:bg-crm-muted"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Delete step"
              onClick={() => actions.remove([node.id])}
              className="rounded-crm p-1.5 text-crm-soft hover:bg-crm-muted hover:text-crm-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      <div className="flex flex-col gap-4 p-4">
        {run && run.status !== "idle" && (
          <div
            className={cn(
              "rounded-crm border p-2 text-xs",
              run.status === "error"
                ? "border-tag-red-border bg-tag-red-bg text-tag-red-text"
                : "border-crm-border bg-crm-raised text-crm-soft",
            )}
          >
            Last run: <strong>{run.status}</strong>
            {run.durationMs !== undefined && ` in ${run.durationMs} ms`}
            {run.message && <p className="mt-1">{run.message}</p>}
          </div>
        )}
        <div>
          <label
            className="mb-1 block text-xs font-medium text-crm-soft"
            htmlFor="kb-wf-step-label"
          >
            Step name
          </label>
          <input
            id="kb-wf-step-label"
            className={inputCls}
            value={node.data.label}
            disabled={readOnly}
            onChange={(e) => actions.rename(node.id, e.target.value)}
          />
        </div>
        {def?.fields.map((f) => (
          <Field
            key={f.key}
            field={f}
            value={node.data.config[f.key]}
            error={fieldErrors.get(f.key)}
            disabled={readOnly}
            onChange={(v) => actions.updateConfig(node.id, f.key, v)}
          />
        ))}
        {def && !def.fields.length && (
          <p className="text-xs text-crm-subtle">This step has no settings.</p>
        )}
      </div>
    </div>
  );
}
