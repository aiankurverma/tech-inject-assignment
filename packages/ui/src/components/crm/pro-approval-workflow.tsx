import * as React from "react";
import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type NodeMouseHandler,
} from "@xyflow/react";
import * as Tabs from "@radix-ui/react-tabs";
import { useStore } from "zustand";
import { AlertTriangle, Download, FlaskConical, Redo2, Undo2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CanvasContext,
  edgeTypes,
  nodeTypes,
  type CanvasCtx,
} from "@/components/crm/pro-approval-workflow/flow-parts";
import { layoutWorkflow } from "@/components/crm/pro-approval-workflow/layout";
import {
  countSteps,
  createStep,
  describeRef,
  findSequence,
  simulate,
  validateWorkflow,
} from "@/components/crm/pro-approval-workflow/model";
import { createWorkflowStore } from "@/components/crm/pro-approval-workflow/store";
import { Inspector } from "@/components/crm/pro-approval-workflow/inspector";
import { SimulationPanel } from "@/components/crm/pro-approval-workflow/simulation-panel";
import {
  workflowSchema,
  type DirectoryPerson,
  type InsertPoint,
  type SampleRequest,
  type Step,
  type StepKind,
  type Workflow,
  type WorkflowField,
} from "@/components/crm/pro-approval-workflow/types";

export type {
  Workflow,
  Step,
  DirectoryPerson,
  WorkflowField,
  SampleRequest,
} from "@/components/crm/pro-approval-workflow/types";
export { simulate, validateWorkflow } from "@/components/crm/pro-approval-workflow/model";

export interface ProApprovalWorkflowProps {
  /** Controlled workflow. Pair with `onChange`. */
  value?: Workflow;
  /** Initial workflow when uncontrolled. */
  defaultValue?: Workflow;
  onChange?: (wf: Workflow) => void;
  /** Request fields that rules can test (amount, discount %, region…). */
  fields: WorkflowField[];
  /** People used to resolve role and manager-chain approvers in the simulation. */
  directory: DirectoryPerson[];
  /** Roles offered in the approver picker. Defaults to every role in the directory. */
  roles?: string[];
  /** Initial sample request for the simulation panel. */
  defaultSample?: SampleRequest;
  /** Called with the validated JSON when the user publishes. Omit to hide the button. */
  onPublish?: (wf: Workflow) => void | Promise<void>;
  readOnly?: boolean;
  className?: string;
  /** Canvas height (the side panel scrolls inside it). */
  height?: number | string;
}

export function ProApprovalWorkflow(props: ProApprovalWorkflowProps) {
  return (
    <ReactFlowProvider>
      <Builder {...props} />
    </ReactFlowProvider>
  );
}

const EMPTY: Workflow = {
  id: "wf_new",
  name: "Untitled workflow",
  version: 1,
  requestType: "discount",
  steps: [],
};

const tbBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-crm-border bg-crm-raised px-2.5 text-[12.5px] text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring disabled:pointer-events-none disabled:opacity-40";

function Builder({
  value,
  defaultValue,
  onChange,
  fields,
  directory,
  roles: rolesProp,
  defaultSample,
  onPublish,
  readOnly = false,
  className,
  height = 640,
}: ProApprovalWorkflowProps) {
  const [store] = React.useState(() => createWorkflowStore(value ?? defaultValue ?? EMPTY));
  const workflow = useStore(store, (s) => s.workflow);
  const canUndo = useStore(store, (s) => s.past.length > 0);
  const canRedo = useStore(store, (s) => s.future.length > 0);
  const selectedId = useStore(store, (s) => s.selectedId);
  const { undo, redo, edit, select, replace } = store.getState();

  // Controlled sync: adopt external value when it differs from what we last emitted.
  const emitted = React.useRef(workflow);
  React.useEffect(() => {
    if (value && value !== emitted.current) {
      emitted.current = value;
      replace(value);
    }
  }, [value, replace]);
  React.useEffect(() => {
    if (workflow !== emitted.current) {
      emitted.current = workflow;
      onChange?.(workflow);
    }
  }, [workflow, onChange]);

  const roles = React.useMemo(
    () => rolesProp ?? [...new Set(directory.flatMap((p) => p.roles))].sort(),
    [rolesProp, directory],
  );
  const byId = React.useMemo(() => new Map(directory.map((p) => [p.id, p])), [directory]);
  const issues = React.useMemo(() => validateWorkflow(workflow), [workflow]);
  const issueCount = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const i of issues) if (i.stepId) m.set(i.stepId, (m.get(i.stepId) ?? 0) + 1);
    return m;
  }, [issues]);

  const { nodes, edges } = React.useMemo(
    () => layoutWorkflow(workflow, (id) => issueCount.get(id) ?? 0),
    [workflow, issueCount],
  );
  const nodesWithSel = React.useMemo(
    () => nodes.map((n) => (n.id === selectedId ? { ...n, selected: true } : n)),
    [nodes, selectedId],
  );

  const [tab, setTab] = React.useState<"edit" | "simulate" | "issues" | "json">("edit");
  const [sample, setSample] = React.useState<SampleRequest>(
    () =>
      defaultSample ?? {
        requesterId: directory[0]?.id ?? "",
        ...Object.fromEntries(fields.map((f) => [f.name, f.sample ?? ""])),
      },
  );
  const sim = React.useMemo(
    () => simulate(workflow, sample, directory),
    [workflow, sample, directory],
  );

  const onInsert = React.useCallback(
    (at: InsertPoint, kind: StepKind) => {
      const step = createStep(kind);
      edit((d) => {
        const seq = findSequence(d.steps as Step[], at.seqId);
        seq?.splice(at.index, 0, step);
      });
      select(step.id);
      setTab("edit");
    },
    [edit, select],
  );

  const ctx = React.useMemo<CanvasCtx>(
    () => ({
      readOnly,
      active: tab === "simulate" ? sim.visited : null,
      describeApprovers: (s) =>
        s.kind === "approver"
          ? s.approvers.map((r) => describeRef(r, byId)).join(", ") || "nobody"
          : "",
      onInsert,
    }),
    [readOnly, tab, sim.visited, byId, onInsert],
  );

  const onNodeClick = React.useCallback<NodeMouseHandler>(
    (_, n) => {
      if (n.type === "step") {
        select(n.id);
        setTab("edit");
      }
    },
    [select],
  );

  // Keyboard: undo/redo, Delete removes the selected step, Escape clears selection.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("input,select,textarea,[contenteditable=true]")) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
    } else if (e.key === "Escape") select(null);
  };

  const json = React.useMemo(() => JSON.stringify(workflow, null, 2), [workflow]);
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflow.name.replace(/[^\w-]+/g, "-").toLowerCase() || "workflow"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const [importError, setImportError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const importJson = async (file: File) => {
    try {
      const parsed = workflowSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) {
        setImportError(parsed.error.issues[0]?.message ?? "Invalid workflow");
        return;
      }
      setImportError(null);
      select(null);
      replace(parsed.data as Workflow, true);
    } catch {
      setImportError("File is not valid JSON");
    }
  };
  const [publishing, setPublishing] = React.useState(false);
  const blocking = issues.filter((i) => i.stepId === null && /:/.test(i.message));

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card text-crm-fg shadow-crm-raised",
        className,
      )}
      style={{ height }}
      onKeyDown={onKeyDown}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-crm-border px-3 py-2">
        <div className="mr-auto min-w-0">
          <h2 className="truncate text-[14px] font-semibold">{workflow.name}</h2>
          <p className="text-[11.5px] text-crm-muted-fg">
            {workflow.requestType} · v{workflow.version} · {countSteps(workflow.steps)} steps
          </p>
        </div>
        {!readOnly && (
          <>
            <button type="button" className={tbBtn} onClick={undo} disabled={!canUndo}>
              <Undo2 className="size-3.5" />
              <span className="sr-only sm:not-sr-only">Undo</span>
            </button>
            <button type="button" className={tbBtn} onClick={redo} disabled={!canRedo}>
              <Redo2 className="size-3.5" />
              <span className="sr-only sm:not-sr-only">Redo</span>
            </button>
            <button type="button" className={tbBtn} onClick={() => fileRef.current?.click()}>
              <Upload className="size-3.5" /> Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJson(f);
                e.target.value = "";
              }}
            />
          </>
        )}
        <button type="button" className={tbBtn} onClick={exportJson}>
          <Download className="size-3.5" /> Export JSON
        </button>
        {onPublish && !readOnly && (
          <button
            type="button"
            disabled={publishing || blocking.length > 0}
            className="inline-flex h-8 items-center rounded-md bg-crm-primary px-3 text-[12.5px] font-medium text-crm-primary-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring disabled:opacity-50"
            onClick={async () => {
              setPublishing(true);
              try {
                const next = { ...workflow, version: workflow.version + 1 };
                await onPublish(next);
                replace(next);
              } finally {
                setPublishing(false);
              }
            }}
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
        )}
      </header>
      {importError && (
        <p
          role="alert"
          className="border-b border-crm-border bg-tag-red-bg px-3 py-1.5 text-[12px] text-tag-red-text"
        >
          Import failed: {importError}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div
          className="relative min-h-[320px] flex-1 bg-crm-bg"
          role="region"
          aria-label="Workflow canvas"
        >
          <CanvasContext.Provider value={ctx}>
            <ReactFlow
              nodes={nodesWithSel}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodeClick={onNodeClick}
              onPaneClick={() => select(null)}
              nodesDraggable={false}
              nodesConnectable={false}
              fitView
              fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
              minZoom={0.2}
              proOptions={{ hideAttribution: true }}
              colorMode="dark"
              style={{ background: "transparent" }}
            >
              <Background gap={20} size={1} color="var(--color-crm-border)" />
              <Controls showInteractive={false} position="bottom-left" />
            </ReactFlow>
          </CanvasContext.Provider>
        </div>
        <Tabs.Root
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex max-h-[50%] w-full shrink-0 flex-col border-t border-crm-border md:max-h-none md:w-[340px] md:border-l md:border-t-0"
        >
          <Tabs.List
            aria-label="Builder panels"
            className="flex shrink-0 gap-1 border-b border-crm-border px-2 pt-2"
          >
            {(
              [
                ["edit", "Edit"],
                ["simulate", "Simulate"],
                ["issues", `Issues${issues.length ? ` (${issues.length})` : ""}`],
                ["json", "JSON"],
              ] as const
            ).map(([v, l]) => (
              <Tabs.Trigger
                key={v}
                value={v}
                className="flex items-center gap-1 rounded-t-md border-b-2 border-transparent px-2.5 pb-1.5 text-[12.5px] text-crm-muted-fg hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring data-[state=active]:border-crm-primary data-[state=active]:text-crm-fg"
              >
                {v === "simulate" && <FlaskConical className="size-3.5" />}
                {v === "issues" && issues.length > 0 && (
                  <AlertTriangle className="size-3.5 text-crm-warning" />
                )}
                {l}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Tabs.Content value="edit">
              <Inspector
                store={store}
                fields={fields}
                directory={directory}
                roles={roles}
                issues={issues}
                readOnly={readOnly}
              />
            </Tabs.Content>
            <Tabs.Content value="simulate">
              <SimulationPanel
                fields={fields}
                directory={directory}
                sample={sample}
                onSampleChange={setSample}
                result={sim}
              />
            </Tabs.Content>
            <Tabs.Content value="issues" className="p-4">
              {issues.length === 0 ? (
                <p className="text-[12.5px] text-crm-success">No issues. Ready to publish.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {issues.map((i, k) => (
                    <li key={k}>
                      <button
                        type="button"
                        disabled={!i.stepId}
                        onClick={() => {
                          if (i.stepId) {
                            select(i.stepId);
                            setTab("edit");
                          }
                        }}
                        className="flex w-full items-start gap-2 rounded-md p-1.5 text-left text-[12.5px] text-crm-soft hover:bg-crm-muted disabled:hover:bg-transparent"
                      >
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-crm-warning" />
                        {i.message}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Tabs.Content>
            <Tabs.Content value="json" className="p-3">
              <pre className="max-h-full overflow-auto rounded-md border border-crm-border bg-crm-bg p-2 font-mono text-[11px] leading-relaxed text-crm-soft">
                {json}
              </pre>
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </div>
    </div>
  );
}
