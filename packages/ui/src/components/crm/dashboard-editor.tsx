import * as React from "react";
import { GripVertical, Minus, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/crm/button";
import { cn } from "@/lib/utils";

export type WidgetSpan = 3 | 4 | 6 | 8 | 12;

export interface DashboardWidget {
  id: string;
  /** Key into the widget library. */
  type: string;
  title: string;
  span: WidgetSpan;
  /** Height in rows (1 row ≈ 120px). */
  rows: 1 | 2 | 3;
}

export interface WidgetDefinition {
  type: string;
  label: string;
  description?: string;
  defaultSpan: WidgetSpan;
  defaultRows: 1 | 2 | 3;
}

export interface DashboardEditorProps {
  widgets?: DashboardWidget[];
  defaultWidgets?: DashboardWidget[];
  onWidgetsChange?: (w: DashboardWidget[]) => void;
  library: WidgetDefinition[];
  /** Render a widget's body (chart, KPI, list...). */
  renderWidget: (w: DashboardWidget) => React.ReactNode;
  /** Start in edit mode. */
  defaultEditing?: boolean;
  onSave?: (w: DashboardWidget[]) => void;
  maxWidgets?: number;
  className?: string;
}

const SPANS: WidgetSpan[] = [3, 4, 6, 8, 12];
const SPAN_CLASS: Record<WidgetSpan, string> = {
  3: "md:col-span-3",
  4: "md:col-span-4",
  6: "md:col-span-6",
  8: "md:col-span-8",
  12: "md:col-span-12",
};
const ROW_CLASS = { 1: "min-h-[120px]", 2: "min-h-[252px]", 3: "min-h-[384px]" } as const;

let seq = 0;
const uid = () => `w_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** Editable 12-column dashboard: add from a library, drag or keyboard reorder, resize, rename, undo. */
export function DashboardEditor({
  widgets,
  defaultWidgets = [],
  onWidgetsChange,
  library,
  renderWidget,
  defaultEditing = false,
  onSave,
  maxWidgets = 16,
  className,
}: DashboardEditorProps) {
  const [inner, setInner] = React.useState(defaultWidgets);
  const list = widgets ?? inner;
  const [editing, setEditing] = React.useState(defaultEditing);
  const [history, setHistory] = React.useState<DashboardWidget[][]>([]);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  const [announce, setAnnounce] = React.useState("");
  const snapshot = React.useRef<DashboardWidget[] | null>(null);

  const set = (next: DashboardWidget[], msg?: string) => {
    setHistory((h) => [...h.slice(-19), list]);
    if (widgets === undefined) setInner(next);
    onWidgetsChange?.(next);
    if (msg) setAnnounce(msg);
  };
  const patch = (id: string, p: Partial<DashboardWidget>) =>
    set(list.map((w) => (w.id === id ? { ...w, ...p } : w)));
  const moveTo = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [w] = next.splice(from, 1);
    next.splice(to, 0, w!);
    set(next, `${w!.title} moved to position ${to + 1} of ${list.length}`);
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    if (widgets === undefined) setInner(prev);
    onWidgetsChange?.(prev);
    setAnnounce("Undone");
  };
  const add = (def: WidgetDefinition) => {
    if (list.length >= maxWidgets) return;
    set(
      [
        ...list,
        {
          id: uid(),
          type: def.type,
          title: def.label,
          span: def.defaultSpan,
          rows: def.defaultRows,
        },
      ],
      `${def.label} added`,
    );
  };
  const resize = (w: DashboardWidget, dir: -1 | 1) => {
    const i = SPANS.indexOf(w.span) + dir;
    const s = SPANS[i];
    if (s) patch(w.id, { span: s });
  };

  const startEdit = () => {
    snapshot.current = list;
    setHistory([]);
    setEditing(true);
  };
  const cancel = () => {
    if (snapshot.current) {
      if (widgets === undefined) setInner(snapshot.current);
      onWidgetsChange?.(snapshot.current);
    }
    setEditing(false);
  };

  return (
    <div className={cn("flex flex-col gap-3 font-crm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <span className="text-xs text-crm-soft">
              Editing · drag cards or use <kbd className="rounded bg-crm-muted px-1">Alt</kbd>
              +arrows
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={undo} disabled={!history.length}>
                <Undo2 /> Undo
              </Button>
              <Button variant="ghost" size="sm" onClick={cancel}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onSave?.(list);
                  setEditing(false);
                }}
              >
                Save layout
              </Button>
            </div>
          </>
        ) : (
          <Button size="sm" className="ml-auto" onClick={startEdit}>
            <Pencil /> Edit dashboard
          </Button>
        )}
      </div>

      {editing ? (
        <div
          role="toolbar"
          aria-label="Add widget"
          className="flex flex-wrap gap-1.5 rounded-crm border border-dashed border-crm-border p-2"
        >
          {library.map((d) => (
            <Button
              key={d.type}
              size="sm"
              variant="muted"
              title={d.description}
              disabled={list.length >= maxWidgets}
              onClick={() => add(d)}
            >
              <Plus /> {d.label}
            </Button>
          ))}
          <span className="ml-auto self-center text-xs text-crm-subtle tabular-nums">
            {list.length}/{maxWidgets}
          </span>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {list.length === 0 ? (
        <div className="grid min-h-[200px] place-items-center rounded-crm border border-dashed border-crm-border text-center text-xs text-crm-subtle">
          {editing
            ? "Add a widget from the bar above."
            : "This dashboard is empty. Click Edit dashboard to add widgets."}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-12" aria-label="Dashboard widgets">
          {list.map((w, i) => (
            <li
              key={w.id}
              draggable={editing}
              onDragStart={(e) => {
                setDragId(w.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOverId(w.id);
              }}
              onDragLeave={() => setOverId((o) => (o === w.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const from = list.findIndex((x) => x.id === dragId);
                if (from >= 0) moveTo(from, i);
                setDragId(null);
                setOverId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={cn(
                "flex flex-col rounded-crm border bg-crm-card transition-[border-color,opacity]",
                SPAN_CLASS[w.span],
                ROW_CLASS[w.rows],
                overId === w.id && dragId !== w.id ? "border-crm-primary" : "border-crm-border",
                dragId === w.id && "opacity-50",
              )}
            >
              <div className="flex items-center gap-2 border-b border-crm-border px-3 py-2">
                {editing ? (
                  <button
                    type="button"
                    aria-label={`Reorder ${w.title}. Alt plus arrow keys to move`}
                    className="cursor-grab text-crm-subtle outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                    onKeyDown={(e) => {
                      if (!e.altKey) return;
                      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                        e.preventDefault();
                        moveTo(i, i - 1);
                      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                        e.preventDefault();
                        moveTo(i, i + 1);
                      }
                    }}
                  >
                    <GripVertical className="size-4" aria-hidden />
                  </button>
                ) : null}
                {editing ? (
                  <input
                    aria-label="Widget title"
                    value={w.title}
                    maxLength={48}
                    onChange={(e) => patch(w.id, { title: e.target.value })}
                    className="min-w-0 flex-1 rounded bg-transparent text-sm font-medium text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/40"
                  />
                ) : (
                  <h4 className="min-w-0 flex-1 truncate text-sm font-medium text-crm-fg">
                    {w.title}
                  </h4>
                )}
                {editing ? (
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Narrower"
                      disabled={w.span === 3}
                      onClick={() => resize(w, -1)}
                    >
                      <Minus />
                    </Button>
                    <span
                      className="w-8 text-center text-xs text-crm-subtle tabular-nums"
                      aria-label={`Width ${w.span} of 12`}
                    >
                      {w.span}/12
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Wider"
                      disabled={w.span === 12}
                      onClick={() => resize(w, 1)}
                    >
                      <Plus />
                    </Button>
                    <select
                      aria-label="Height"
                      value={w.rows}
                      onChange={(e) => patch(w.id, { rows: Number(e.target.value) as 1 | 2 | 3 })}
                      className="h-7 cursor-pointer rounded-crm border border-crm-input/60 bg-crm-raised px-1 text-xs text-crm-fg [color-scheme:dark]"
                    >
                      <option value={1}>S</option>
                      <option value={2}>M</option>
                      <option value={3}>L</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${w.title}`}
                      onClick={() =>
                        set(
                          list.filter((x) => x.id !== w.id),
                          `${w.title} removed`,
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ) : null}
              </div>
              <div
                className={cn("min-h-0 flex-1 p-3", editing && "pointer-events-none select-none")}
              >
                {renderWidget(w)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
