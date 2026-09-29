import * as React from "react";
import { useStore } from "zustand";
import { Group, Panel, Separator, type Layout } from "react-resizable-panels";
import {
  BarChart3,
  Braces,
  ChevronLeft,
  ChevronRight,
  Copy,
  Gauge,
  LineChart as LineIcon,
  Redo2,
  Save,
  Settings2,
  Table2,
  Trash2,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createDashboardStore } from "@/components/crm/pro-dashboard-builder/store";
import {
  parseDashboard,
  type DashboardConfig,
  type DashboardField,
  type WidgetConfig,
  type WidgetType,
} from "@/components/crm/pro-dashboard-builder/schema";
import { WidgetBody } from "@/components/crm/pro-dashboard-builder/widgets";
import { WidgetEditor } from "@/components/crm/pro-dashboard-builder/widget-editor";
import type { DataRecord } from "@/components/crm/pro-dashboard-builder/query";

export type {
  DashboardConfig,
  DashboardField,
  WidgetConfig,
} from "@/components/crm/pro-dashboard-builder/schema";
export { parseDashboard } from "@/components/crm/pro-dashboard-builder/schema";

export interface ProDashboardBuilderProps<T extends DataRecord = DataRecord> {
  /** Records every widget queries. Filtering and aggregation run client-side, memoized per widget. */
  data: T[];
  /** Schema of the records: drives the query builder, metrics and dimensions. */
  fields: DashboardField[];
  /** Controlled layout. Pair with `onChange`. */
  value?: DashboardConfig;
  /** Initial layout when uncontrolled. */
  defaultValue?: DashboardConfig;
  /** Fires with every committed change (resize end, widget edit, undo/redo). */
  onChange?: (config: DashboardConfig) => void;
  /** Explicit save; receives the zod-validated JSON layout. */
  onSave?: (config: DashboardConfig) => void | Promise<void>;
  /** Start in view mode (no chrome, no resize). Users can toggle unless `readOnly`. */
  defaultEditing?: boolean;
  readOnly?: boolean;
  loading?: boolean;
  error?: React.ReactNode;
  /** Minimum pixel height of each row. */
  rowHeight?: number;
  className?: string;
}

const LIBRARY: { type: WidgetType; label: string; icon: React.ReactNode }[] = [
  { type: "kpi", label: "KPI", icon: <Gauge className="size-3.5" aria-hidden /> },
  { type: "line", label: "Line", icon: <LineIcon className="size-3.5" aria-hidden /> },
  { type: "bar", label: "Bar", icon: <BarChart3 className="size-3.5" aria-hidden /> },
  { type: "table", label: "Table", icon: <Table2 className="size-3.5" aria-hidden /> },
];

const EMPTY: DashboardConfig = { version: 1, name: "Untitled dashboard", rows: [], widgets: {} };
const btn =
  "inline-flex h-8 items-center gap-1.5 rounded-crm border border-crm-border bg-crm-card px-2.5 text-xs font-medium text-crm-fg hover:bg-crm-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-crm-ring";
const iconBtn =
  "inline-flex size-6 items-center justify-center rounded text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg focus-visible:outline-2 focus-visible:outline-crm-ring";

function defaultsFor(type: WidgetType, fields: DashboardField[]): Partial<WidgetConfig> {
  const metric = fields.find((f) => f.type === "number")?.name;
  const date = fields.find((f) => f.type === "date")?.name;
  const dim = fields.find((f) => f.type === "string")?.name;
  const titles = { kpi: "New KPI", line: "Trend", bar: "Breakdown", table: "Records" };
  return {
    title: titles[type],
    metric,
    groupBy: type === "line" ? date : type === "bar" ? dim : undefined,
  };
}

/**
 * User-configurable analytics dashboard: resizable widget grid (react-resizable-panels), KPI /
 * line / bar (recharts) / virtualized table (@tanstack/react-table + react-virtual) widgets, a
 * per-widget query builder (react-querybuilder), zod-validated JSON layouts and undo/redo
 * (zustand + immer).
 */
export function ProDashboardBuilder<T extends DataRecord = DataRecord>({
  data,
  fields,
  value,
  defaultValue,
  onChange,
  onSave,
  defaultEditing = true,
  readOnly = false,
  loading = false,
  error,
  rowHeight = 260,
  className,
}: ProDashboardBuilderProps<T>) {
  const [store] = React.useState(() => createDashboardStore(value ?? defaultValue ?? EMPTY));
  const present = useStore(store, (s) => s.present);
  const canUndo = useStore(store, (s) => s.past.length > 0);
  const canRedo = useStore(store, (s) => s.future.length > 0);
  const layoutRev = useStore(store, (s) => s.layoutRev);
  const selectedId = useStore(store, (s) => s.selectedId);
  const [editingState, setEditing] = React.useState(defaultEditing);
  const editing = editingState && !readOnly;
  const [json, setJson] = React.useState<{ text: string; errors: string[] } | null>(null);
  const [saving, setSaving] = React.useState<"idle" | "saving" | "saved">("idle");
  const [announce, setAnnounce] = React.useState("");

  // Controlled mode: adopt outside values without touching history.
  const lastEmitted = React.useRef(present);
  React.useEffect(() => {
    if (value && value !== lastEmitted.current && value !== store.getState().present) {
      lastEmitted.current = value;
      store.setState((s) => ({ present: value, layoutRev: s.layoutRev + 1 }));
    }
  }, [value, store]);
  React.useEffect(() => {
    if (present !== lastEmitted.current) {
      lastEmitted.current = present;
      onChange?.(present);
    }
  }, [present, onChange]);

  const s = store.getState();
  const rows = data as DataRecord[];
  const selected = selectedId ? present.widgets[selectedId] : undefined;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!editing) return;
    const target = e.target as HTMLElement;
    if (target.closest("input,textarea,select,[contenteditable=true]")) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) s.redo();
      else s.undo();
      setAnnounce(e.shiftKey ? "Redone" : "Undone");
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      s.redo();
      setAnnounce("Redone");
    }
  };

  const save = async () => {
    const parsed = parseDashboard(present);
    if (!parsed.ok) {
      setJson({ text: JSON.stringify(present, null, 2), errors: parsed.errors });
      return;
    }
    setSaving("saving");
    try {
      await onSave?.(parsed.value);
      setSaving("saved");
      setAnnounce("Layout saved");
      setTimeout(() => setSaving("idle"), 1500);
    } catch {
      setSaving("idle");
      setAnnounce("Save failed");
    }
  };

  const importJson = () => {
    if (!json) return;
    let raw: unknown;
    try {
      raw = JSON.parse(json.text);
    } catch (err) {
      setJson({ ...json, errors: [`Invalid JSON: ${(err as Error).message}`] });
      return;
    }
    const parsed = parseDashboard(raw);
    if (!parsed.ok) return setJson({ ...json, errors: parsed.errors });
    s.replace(parsed.value);
    setJson(null);
    setAnnounce("Layout imported");
  };

  if (error)
    return (
      <div
        role="alert"
        className={cn(
          "rounded-crm border border-crm-border bg-crm-card p-6 text-sm text-crm-danger",
          className,
        )}
      >
        {error}
      </div>
    );

  return (
    <div
      onKeyDown={onKeyDown}
      className={cn(
        "flex min-h-[480px] flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <div
        role="toolbar"
        aria-label="Dashboard"
        className="flex flex-wrap items-center gap-2 border-b border-crm-border bg-crm-card px-3 py-2"
      >
        {editing ? (
          <input
            aria-label="Dashboard name"
            value={present.name}
            maxLength={80}
            onChange={(e) => s.apply((d) => void (d.name = e.target.value || "Untitled"), "name")}
            className="h-8 min-w-0 flex-1 rounded-crm border border-transparent bg-transparent px-2 text-sm font-semibold hover:border-crm-border focus-visible:border-crm-border focus-visible:outline-none"
          />
        ) : (
          <h2 className="flex-1 px-2 text-sm font-semibold">{present.name}</h2>
        )}
        {editing && (
          <>
            <div className="flex items-center gap-1" role="group" aria-label="Add widget">
              {LIBRARY.map((w) => (
                <button
                  key={w.type}
                  type="button"
                  className={btn}
                  onClick={() => s.addWidget(w.type, defaultsFor(w.type, fields))}
                >
                  {w.icon}
                  {w.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={btn}
                onClick={s.undo}
                disabled={!canUndo}
                aria-label="Undo (Ctrl+Z)"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                className={btn}
                onClick={s.redo}
                disabled={!canRedo}
                aria-label="Redo (Ctrl+Shift+Z)"
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                className={btn}
                onClick={() => setJson({ text: JSON.stringify(present, null, 2), errors: [] })}
              >
                <Braces className="size-3.5" aria-hidden />
                JSON
              </button>
              {onSave && (
                <button
                  type="button"
                  className={cn(
                    btn,
                    "border-crm-primary bg-crm-primary text-crm-primary-fg hover:bg-crm-primary/90",
                  )}
                  onClick={save}
                  disabled={saving === "saving"}
                >
                  <Save className="size-3.5" aria-hidden />
                  {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : "Save"}
                </button>
              )}
            </div>
          </>
        )}
        {!readOnly && (
          <button
            type="button"
            className={btn}
            aria-pressed={editing}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {json && (
        <div
          role="dialog"
          aria-label="Layout JSON"
          className="border-b border-crm-border bg-crm-card p-3"
        >
          <textarea
            aria-label="Layout JSON"
            value={json.text}
            spellCheck={false}
            onChange={(e) => setJson({ text: e.target.value, errors: [] })}
            className="h-48 w-full rounded-crm border border-crm-border bg-crm-input p-2 font-mono text-[11px] text-crm-fg focus-visible:outline-2 focus-visible:outline-crm-ring"
          />
          {json.errors.length > 0 && (
            <ul role="alert" className="mt-2 list-disc pl-5 text-xs text-crm-danger">
              {json.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className={btn}
              onClick={() => navigator.clipboard?.writeText(json.text)}
            >
              Copy
            </button>
            <button type="button" className={btn} onClick={() => setJson(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={cn(btn, "border-crm-primary text-crm-primary")}
              onClick={importJson}
            >
              Apply layout
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="min-w-0 flex-1 overflow-auto p-3">
          {loading ? (
            <div
              className="grid grid-cols-1 gap-3 md:grid-cols-3"
              aria-busy="true"
              aria-label="Loading dashboard"
            >
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-crm bg-crm-muted" />
              ))}
            </div>
          ) : present.rows.length === 0 ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 rounded-crm border border-dashed border-crm-border text-center">
              <p className="text-sm font-medium">This dashboard is empty</p>
              <p className="max-w-xs text-xs text-crm-muted-fg">
                Add a KPI, chart or table from the widget library. Each widget has its own query.
              </p>
              {!readOnly && (
                <div className="flex gap-1">
                  {LIBRARY.map((w) => (
                    <button
                      key={w.type}
                      type="button"
                      className={btn}
                      onClick={() => {
                        setEditing(true);
                        s.addWidget(w.type, defaultsFor(w.type, fields));
                      }}
                    >
                      {w.icon}
                      {w.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Group
              key={`v${layoutRev}`}
              orientation="vertical"
              disabled={!editing}
              style={{ height: Math.max(present.rows.length * rowHeight, 320) }}
              defaultLayout={Object.fromEntries(present.rows.map((r) => [r.id, r.size]))}
              onLayoutChanged={(layout: Layout) =>
                s.apply((d) =>
                  d.rows.forEach((r) => {
                    const v = layout[r.id];
                    if (v != null) r.size = Math.round(v * 100) / 100;
                  }),
                )
              }
            >
              {present.rows.map((row, ri) => (
                <React.Fragment key={row.id}>
                  {ri > 0 && (
                    <Separator
                      className={cn(
                        "h-3 outline-none",
                        editing && "group data-[separator]:cursor-row-resize",
                      )}
                    >
                      <div className="mx-auto mt-1 h-1 w-10 rounded-full bg-crm-border opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" />
                    </Separator>
                  )}
                  <Panel id={row.id} minSize={10}>
                    <Group
                      key={`h${layoutRev}`}
                      orientation="horizontal"
                      disabled={!editing}
                      defaultLayout={Object.fromEntries(row.widgets.map((c) => [c.id, c.size]))}
                      onLayoutChanged={(layout: Layout) =>
                        s.apply((d) => {
                          const r = d.rows.find((x) => x.id === row.id);
                          r?.widgets.forEach((c) => {
                            const v = layout[c.id];
                            if (v != null) c.size = Math.round(v * 100) / 100;
                          });
                        })
                      }
                    >
                      {row.widgets.map((cell, ci) => {
                        const w = present.widgets[cell.id];
                        if (!w) return null;
                        return (
                          <React.Fragment key={cell.id}>
                            {ci > 0 && (
                              <Separator className="group w-3 outline-none">
                                <div className="mx-auto mt-[40%] h-10 w-1 rounded-full bg-crm-border opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" />
                              </Separator>
                            )}
                            <Panel id={cell.id} minSize={12}>
                              <section
                                aria-label={w.title}
                                tabIndex={editing ? 0 : -1}
                                onKeyDown={(e) => {
                                  if (!editing || e.target !== e.currentTarget) return;
                                  if (e.key === "Enter") s.select(w.id);
                                  if (e.key === "Delete" || e.key === "Backspace")
                                    s.removeWidget(w.id);
                                  if (e.altKey && e.key === "ArrowLeft") s.moveWidget(w.id, -1);
                                  if (e.altKey && e.key === "ArrowRight") s.moveWidget(w.id, 1);
                                }}
                                className={cn(
                                  "group/w flex h-full flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card focus-visible:outline-2 focus-visible:outline-crm-ring",
                                  selectedId === w.id && editing && "border-crm-primary",
                                )}
                              >
                                <header className="flex items-center gap-1 px-3 pt-2.5 pb-1">
                                  <h3 className="flex-1 truncate text-xs font-medium text-crm-muted-fg">
                                    {w.title}
                                  </h3>
                                  {editing && (
                                    <div className="flex opacity-60 transition group-hover/w:opacity-100 group-focus-within/w:opacity-100">
                                      <button
                                        type="button"
                                        className={iconBtn}
                                        aria-label={`Move ${w.title} left`}
                                        onClick={() => s.moveWidget(w.id, -1)}
                                      >
                                        <ChevronLeft className="size-3.5" aria-hidden />
                                      </button>
                                      <button
                                        type="button"
                                        className={iconBtn}
                                        aria-label={`Move ${w.title} right`}
                                        onClick={() => s.moveWidget(w.id, 1)}
                                      >
                                        <ChevronRight className="size-3.5" aria-hidden />
                                      </button>
                                      <button
                                        type="button"
                                        className={iconBtn}
                                        aria-label={`Configure ${w.title}`}
                                        onClick={() => s.select(w.id)}
                                      >
                                        <Settings2 className="size-3.5" aria-hidden />
                                      </button>
                                      <button
                                        type="button"
                                        className={iconBtn}
                                        aria-label={`Duplicate ${w.title}`}
                                        onClick={() => s.duplicateWidget(w.id)}
                                      >
                                        <Copy className="size-3.5" aria-hidden />
                                      </button>
                                      <button
                                        type="button"
                                        className={cn(iconBtn, "hover:text-crm-danger")}
                                        aria-label={`Remove ${w.title}`}
                                        onClick={() => s.removeWidget(w.id)}
                                      >
                                        <Trash2 className="size-3.5" aria-hidden />
                                      </button>
                                    </div>
                                  )}
                                </header>
                                <div className="min-h-0 flex-1">
                                  <WidgetBody widget={w} rows={rows} fields={fields} />
                                </div>
                              </section>
                            </Panel>
                          </React.Fragment>
                        );
                      })}
                    </Group>
                  </Panel>
                </React.Fragment>
              ))}
            </Group>
          )}
        </div>
        {editing && selected && (
          <WidgetEditor
            widget={selected}
            fields={fields}
            onClose={() => s.select(null)}
            onChange={(patch, key) =>
              s.apply((d) => {
                const w = d.widgets[selected.id];
                if (w) Object.assign(w, patch);
              }, key)
            }
          />
        )}
      </div>
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
