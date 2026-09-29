import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type IsValidConnection,
} from "@xyflow/react";
import { ensureFlowStyles } from "@/components/crm/pro-workflow-builder/flow-styles";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useStore } from "zustand";
import {
  Download,
  LayoutGrid,
  Loader2,
  Maximize,
  Play,
  Redo2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { autoLayout } from "@/components/crm/pro-workflow-builder/auto-layout";
import { ConfigPanel } from "@/components/crm/pro-workflow-builder/config-panel";
import {
  BuilderContext,
  useBuilder,
  useWorkflow,
} from "@/components/crm/pro-workflow-builder/context";
import { DND_MIME, Palette } from "@/components/crm/pro-workflow-builder/palette";
import {
  createWorkflowStore,
  toJSON,
  type WorkflowStore,
} from "@/components/crm/pro-workflow-builder/store";
import type {
  NodeDefinition,
  NodeRunState,
  WorkflowJSON,
} from "@/components/crm/pro-workflow-builder/types";
import {
  connectionError,
  lintWorkflow,
  parseWorkflow,
  type Issue,
} from "@/components/crm/pro-workflow-builder/validation";
import {
  NODE_WIDTH,
  PORT_COLOR,
  nodeTypes,
} from "@/components/crm/pro-workflow-builder/workflow-node";

export type {
  NodeDefinition,
  NodeKind,
  NodeRunState,
  RunStatus,
  FieldDef,
  PortType,
  InputPort,
  OutputPort,
  WorkflowJSON,
} from "@/components/crm/pro-workflow-builder/types";
export { workflowJsonSchema } from "@/components/crm/pro-workflow-builder/types";
export type { Issue } from "@/components/crm/pro-workflow-builder/validation";

export interface ProWorkflowBuilderProps {
  /** Step catalogue shown in the palette; `type` must be unique. */
  definitions: NodeDefinition[];
  /** Controlled workflow. Pass the value from `onChange` back in. */
  value?: WorkflowJSON;
  defaultValue?: WorkflowJSON;
  /** Fires after every committed edit (not on selection or mid-drag). */
  onChange?: (workflow: WorkflowJSON) => void;
  /** Per-node run state painted over the canvas. */
  runState?: Record<string, NodeRunState>;
  /** Shows a Run button; receives the current workflow. */
  onRun?: (workflow: WorkflowJSON) => void;
  running?: boolean;
  readOnly?: boolean;
  height?: number | string;
  /** Receives import errors in addition to the inline banner. */
  onImportError?: (errors: string[]) => void;
  className?: string;
}

const EMPTY: WorkflowJSON = { version: 1, name: "Untitled workflow", nodes: [], edges: [] };
const HANDLE_ORDER = ["true", "out", "false", "error"];
const NODE_HEIGHT_ESTIMATE = 96;

/**
 * Zapier-style automation canvas on React Flow: drag steps in from the palette,
 * connect typed ports (validated for type, fan-out and loops), configure each
 * step with schema-validated fields, tidy with auto-layout, undo/redo, run-state
 * overlay and JSON import/export.
 */
export function ProWorkflowBuilder(props: ProWorkflowBuilderProps) {
  React.useInsertionEffect(() => ensureFlowStyles(), []);
  return (
    <ReactFlowProvider>
      <Builder {...props} />
    </ReactFlowProvider>
  );
}

function Builder({
  definitions,
  value,
  defaultValue,
  onChange,
  runState,
  onRun,
  running,
  readOnly = false,
  height = 640,
  onImportError,
  className,
}: ProWorkflowBuilderProps) {
  const defs = React.useMemo(() => new Map(definitions.map((d) => [d.type, d])), [definitions]);
  // Palette lives outside the canvas; the canvas owns the viewport and fills this slot.
  const addAtCenter: AddSlot = React.useRef(null);
  const [store] = React.useState<WorkflowStore>(() =>
    createWorkflowStore(value ?? defaultValue ?? EMPTY, defs),
  );

  // Controlled mode: adopt external values that we did not emit ourselves.
  const lastEmitted = React.useRef<WorkflowJSON | undefined>(value);
  React.useEffect(() => {
    if (value && value !== lastEmitted.current) {
      lastEmitted.current = value;
      store.getState().load(value);
    }
  }, [value, store]);

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  React.useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (s.revision === prev.revision) return;
        const wf = toJSON(s.name, s.nodes, s.edges);
        lastEmitted.current = wf;
        onChangeRef.current?.(wf);
      }),
    [store],
  );

  const nodes = useStore(store, (s) => s.nodes);
  const edges = useStore(store, (s) => s.edges);
  const issues = React.useMemo(() => lintWorkflow(nodes, edges, defs), [nodes, edges, defs]);
  const issuesByNode = React.useMemo(() => {
    const m = new Map<string, Issue[]>();
    for (const i of issues)
      if (i.nodeId) (m.get(i.nodeId) ?? m.set(i.nodeId, []).get(i.nodeId)!).push(i);
    return m;
  }, [issues]);

  const ctx = React.useMemo(
    () => ({ store, defs, runState, issuesByNode, readOnly }),
    [store, defs, runState, issuesByNode, readOnly],
  );

  return (
    <BuilderContext.Provider value={ctx}>
      <section
        aria-label="Workflow builder"
        className={cn(
          "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg font-crm text-crm-fg",
          className,
        )}
        style={{ height }}
      >
        <Toolbar issues={issues} onRun={onRun} running={running} onImportError={onImportError} />
        <Group orientation="horizontal" className="min-h-0 flex-1">
          {!readOnly && (
            <>
              <Panel id="palette" defaultSize="20" minSize="160px" maxSize="35" collapsible>
                <Palette
                  definitions={definitions}
                  disabled={readOnly}
                  onAdd={(d) => addAtCenter.current?.(d)}
                />
              </Panel>
              <ResizeHandle />
            </>
          )}
          <Panel id="canvas" minSize="30">
            <Canvas addAtCenter={addAtCenter} />
          </Panel>
          <ResizeHandle />
          <Panel id="config" defaultSize="26" minSize="220px" maxSize="45" collapsible>
            <ConfigPanel issues={issues} />
          </Panel>
        </Group>
      </section>
    </BuilderContext.Provider>
  );
}

type AddSlot = React.RefObject<((d: NodeDefinition) => void) | null>;

function ResizeHandle() {
  return (
    <Separator className="group relative w-px bg-crm-border outline-none data-[separator=active]:bg-crm-primary data-[separator=hover]:bg-crm-ring focus-visible:bg-crm-primary">
      <span className="absolute inset-y-0 -left-1 -right-1" />
    </Separator>
  );
}

function Canvas({ addAtCenter: slot }: { addAtCenter: AddSlot }) {
  const { store, defs, runState, readOnly } = useBuilder();
  const nodes = useWorkflow((s) => s.nodes);
  const edges = useWorkflow((s) => s.edges);
  const flow = useReactFlow();
  const wrapper = React.useRef<HTMLDivElement>(null);
  const [hint, setHint] = React.useState<string | null>(null);
  const a = store.getState();

  const add = React.useCallback(
    (def: NodeDefinition, screen?: { x: number; y: number }) => {
      const rect = wrapper.current?.getBoundingClientRect();
      const p =
        screen ??
        (rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 });
      const pos = flow.screenToFlowPosition(p);
      store.getState().addNode(def, { x: pos.x - NODE_WIDTH / 2, y: pos.y - 30 });
    },
    [flow, store],
  );
  React.useEffect(() => {
    slot.current = add;
    return () => {
      if (slot.current === add) slot.current = null;
    };
  }, [add, slot]);

  const isValidConnection = React.useCallback<IsValidConnection>(
    (c) => {
      const s = store.getState();
      return connectionError(c as Connection, s.nodes, s.edges, defs) === null;
    },
    [store, defs],
  );

  const onConnectEnd = React.useCallback(
    (
      _: unknown,
      state: {
        isValid: boolean | null;
        fromHandle: { nodeId: string; id?: string | null } | null;
        toHandle: { nodeId: string; id?: string | null } | null;
      },
    ) => {
      if (state.isValid || !state.fromHandle || !state.toHandle) return;
      const s = store.getState();
      const err = connectionError(
        {
          source: state.fromHandle.nodeId,
          sourceHandle: state.fromHandle.id ?? null,
          target: state.toHandle.nodeId,
          targetHandle: state.toHandle.id ?? null,
        },
        s.nodes,
        s.edges,
        defs,
      );
      if (err) setHint(err);
    },
    [store, defs],
  );
  React.useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 3500);
    return () => clearTimeout(t);
  }, [hint]);

  // Colour edges by port type; animate the path a run is currently travelling.
  const styledEdges = React.useMemo<Edge[]>(() => {
    const kind = new Map<string, string>();
    for (const n of nodes) kind.set(n.id, n.data.defType);
    return edges.map((e) => {
      const out = defs.get(kind.get(e.source) ?? "")?.outputs.find((p) => p.id === e.sourceHandle);
      const src = runState?.[e.source]?.status;
      const dst = runState?.[e.target]?.status;
      const live = src === "success" && (dst === "running" || dst === "queued");
      const done = src === "success" && dst === "success";
      return {
        ...e,
        animated: live,
        label: out?.label && out.type !== "event" ? out.label : undefined,
        style: {
          stroke: done ? "var(--color-crm-success)" : out ? PORT_COLOR[out.type] : undefined,
          strokeWidth: live || done ? 2.5 : 1.5,
          opacity: runState && !src ? 0.5 : 1,
        },
      };
    });
  }, [nodes, edges, defs, runState]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, [contenteditable=true]")) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || readOnly) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) a.undo();
    else if ((k === "z" && e.shiftKey) || k === "y") a.redo();
    else if (k === "d" && store.getState().selectedId) a.duplicate(store.getState().selectedId!);
    else if (k === "l" && e.shiftKey) tidy(store, flow);
    else return;
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    const type = e.dataTransfer.getData(DND_MIME);
    const def = type && defs.get(type);
    if (!def || readOnly) return;
    e.preventDefault();
    add(def, { x: e.clientX, y: e.clientY });
  };

  return (
    <div
      ref={wrapper}
      className="relative h-full"
      onKeyDown={onKeyDown}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DND_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={a.onNodesChange}
        onEdgesChange={a.onEdgesChange}
        onConnect={a.connect}
        onConnectEnd={onConnectEnd as never}
        isValidConnection={isValidConnection}
        onNodeDragStart={() => a.checkpoint()}
        onNodeDragStop={() => a.commit()}
        onPaneClick={() => a.select(null)}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        edgesReconnectable={false}
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        onlyRenderVisibleElements={nodes.length > 150}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep" }}
        style={{ background: "var(--color-crm-bg)" }}
        aria-label="Workflow canvas"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--color-crm-faint)"
        />
        <MiniMap
          pannable
          zoomable
          ariaLabel="Workflow minimap"
          nodeColor={(n) => {
            const st = runState?.[n.id]?.status;
            return st === "success"
              ? "#22c55e"
              : st === "error"
                ? "#f97373"
                : st === "running"
                  ? "#fbbf24"
                  : "#3a3a3a";
          }}
          maskColor="rgba(0,0,0,0.55)"
          style={{
            background: "var(--color-crm-card)",
            border: "1px solid var(--color-crm-border)",
          }}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-crm border border-dashed border-crm-input bg-crm-card/80 px-6 py-5 text-center text-sm text-crm-soft">
            <p className="font-medium text-crm-fg">Start with a trigger</p>
            <p className="mt-1 text-xs">Drag a step from the left, or focus it and press Enter.</p>
          </div>
        </div>
      )}
      {hint && (
        <div
          role="status"
          className="absolute left-1/2 top-3 -translate-x-1/2 rounded-crm border border-tag-red-border bg-tag-red-bg px-3 py-1.5 text-xs text-tag-red-text shadow-crm-raised"
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function tidy(store: WorkflowStore, flow: ReturnType<typeof useReactFlow>) {
  const s = store.getState();
  const positions = autoLayout(
    s.nodes.map((n) => ({
      id: n.id,
      width: n.measured?.width ?? NODE_WIDTH,
      height: n.measured?.height ?? NODE_HEIGHT_ESTIMATE,
    })),
    s.edges,
    { handleOrder: HANDLE_ORDER },
  );
  s.setPositions(positions);
  requestAnimationFrame(() => flow.fitView({ padding: 0.2, maxZoom: 1, duration: 300 }));
}

function Toolbar({
  issues,
  onRun,
  running,
  onImportError,
}: {
  issues: Issue[];
  onRun?: (wf: WorkflowJSON) => void;
  running?: boolean;
  onImportError?: (errors: string[]) => void;
}) {
  const { store, defs, readOnly } = useBuilder();
  const flow = useReactFlow();
  const canUndo = useWorkflow((s) => s.past.length > 0);
  const canRedo = useWorkflow((s) => s.future.length > 0);
  const name = useWorkflow((s) => s.name);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importErrors, setImportErrors] = React.useState<string[] | null>(null);
  const errors = issues.filter((i) => i.severity === "error").length;
  const a = store.getState();

  const current = () => {
    const s = store.getState();
    return toJSON(s.name, s.nodes, s.edges);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(current(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "workflow"}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importJson = async (file: File) => {
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      const errs = ["File is not valid JSON"];
      setImportErrors(errs);
      onImportError?.(errs);
      return;
    }
    const res = parseWorkflow(raw, defs);
    if (!res.ok) {
      setImportErrors(res.errors);
      onImportError?.(res.errors);
      return;
    }
    setImportErrors(null);
    a.checkpoint();
    a.load(res.workflow);
    a.commit();
    requestAnimationFrame(() => flow.fitView({ padding: 0.2, maxZoom: 1 }));
  };

  const btn =
    "inline-flex h-8 items-center gap-1.5 rounded-crm px-2.5 text-xs font-medium text-crm-soft hover:bg-crm-muted hover:text-crm-fg disabled:pointer-events-none disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring";

  return (
    <>
      <div
        role="toolbar"
        aria-label="Workflow actions"
        className="flex flex-wrap items-center gap-1 border-b border-crm-border bg-crm-sidebar px-2 py-1.5"
      >
        <span className="mr-2 max-w-[16rem] truncate px-1 text-sm font-semibold text-crm-fg">
          {name}
        </span>
        {!readOnly && (
          <>
            <button
              type="button"
              className={btn}
              onClick={a.undo}
              disabled={!canUndo}
              aria-label="Undo (Ctrl+Z)"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={btn}
              onClick={a.redo}
              disabled={!canRedo}
              aria-label="Redo (Ctrl+Shift+Z)"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <span className="mx-1 h-5 w-px bg-crm-border" />
            <button
              type="button"
              className={btn}
              onClick={() => tidy(store, flow)}
              title="Tidy layout (Ctrl+Shift+L)"
            >
              <LayoutGrid className="h-4 w-4" /> Tidy
            </button>
          </>
        )}
        <button
          type="button"
          className={btn}
          onClick={() => flow.fitView({ padding: 0.2, maxZoom: 1, duration: 300 })}
        >
          <Maximize className="h-4 w-4" /> Fit
        </button>
        <span className="mx-1 h-5 w-px bg-crm-border" />
        {!readOnly && (
          <>
            <button type="button" className={btn} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Import
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
        <button type="button" className={btn} onClick={exportJson}>
          <Download className="h-4 w-4" /> Export
        </button>
        <span
          className={cn(
            "ml-auto px-2 text-xs",
            errors ? "text-crm-danger" : issues.length ? "text-crm-warning" : "text-crm-success",
          )}
          aria-live="polite"
        >
          {errors
            ? `${errors} error${errors > 1 ? "s" : ""}`
            : issues.length
              ? `${issues.length} warning(s)`
              : "Valid"}
        </span>
        {onRun && (
          <button
            type="button"
            onClick={() => onRun(current())}
            disabled={running || errors > 0}
            title={errors ? "Fix errors before running" : "Run a test"}
            className="inline-flex h-8 items-center gap-1.5 rounded-crm bg-crm-primary px-3 text-xs font-medium text-crm-primary-fg hover:opacity-90 disabled:opacity-40"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Running" : "Test run"}
          </button>
        )}
      </div>
      {importErrors && (
        <div
          role="alert"
          className="flex items-start gap-2 border-b border-tag-red-border bg-tag-red-bg px-3 py-2 text-xs text-tag-red-text"
        >
          <div className="flex-1">
            <p className="font-medium">Import failed</p>
            <ul className="list-disc pl-4">
              {importErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => setImportErrors(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
