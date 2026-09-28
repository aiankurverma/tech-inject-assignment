import * as React from "react";
import { ArrowLeft, ArrowRight, CalendarClock, Flag, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { SegmentedControl } from "@/components/crm/segmented-control";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "urgent" | "high" | "medium" | "low";

export interface BoardTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** ISO date (yyyy-mm-dd). */
  due?: string;
  assignee?: { id: string; name: string; avatar?: string };
  /** Related CRM record, e.g. "Acme Corp · Renewal". */
  related?: string;
}

export interface TaskBoardColumn {
  id: TaskStatus;
  title: string;
  /** Work-in-progress limit; the header turns red when exceeded. */
  wipLimit?: number;
}

export interface TaskBoardProps {
  tasks?: BoardTask[];
  defaultTasks?: BoardTask[];
  onTasksChange?: (tasks: BoardTask[]) => void;
  columns?: TaskBoardColumn[];
  /** Reference date for overdue calculation (defaults to today). */
  today?: string;
  /** Called when the user submits the inline "add task" form. Return a task to insert it. */
  onCreateTask?: (title: string, status: TaskStatus) => BoardTask | void;
  onOpenTask?: (task: BoardTask) => void;
  loading?: boolean;
  className?: string;
}

const DEFAULT_COLUMNS: TaskBoardColumn[] = [
  { id: "todo", title: "To do" },
  { id: "in_progress", title: "In progress", wipLimit: 4 },
  { id: "blocked", title: "Blocked" },
  { id: "done", title: "Done" },
];

const PRIORITY: Record<TaskPriority, { label: string; cls: string; rank: number }> = {
  urgent: { label: "Urgent", cls: "text-crm-danger", rank: 0 },
  high: { label: "High", cls: "text-tag-orange-text", rank: 1 },
  medium: { label: "Medium", cls: "text-tag-amber-text", rank: 2 },
  low: { label: "Low", cls: "text-crm-subtle", rank: 3 },
};

const isoToday = () => new Date().toISOString().slice(0, 10);

function dueLabel(due: string, today: string) {
  const d = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d < 0) return `${-d}d overdue`;
  if (d < 7) return `In ${d}d`;
  return new Date(due + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Kanban task board with drag & drop, keyboard moves, WIP limits and assignee/priority filters. */
export function TaskBoard({
  tasks: tasksProp,
  defaultTasks = [],
  onTasksChange,
  columns = DEFAULT_COLUMNS,
  today = isoToday(),
  onCreateTask,
  onOpenTask,
  loading,
  className,
}: TaskBoardProps) {
  const [inner, setInner] = React.useState(defaultTasks);
  const tasks = tasksProp ?? inner;
  const [assignee, setAssignee] = React.useState("all");
  const [priority, setPriority] = React.useState<"all" | TaskPriority>("all");
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overCol, setOverCol] = React.useState<TaskStatus | null>(null);
  const [adding, setAdding] = React.useState<TaskStatus | null>(null);
  const [draft, setDraft] = React.useState("");
  const [announce, setAnnounce] = React.useState("");

  const commit = (next: BoardTask[]) => {
    if (tasksProp === undefined) setInner(next);
    onTasksChange?.(next);
  };

  const move = (id: string, status: TaskStatus) => {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    commit(tasks.map((x) => (x.id === id ? { ...x, status } : x)));
    setAnnounce(`Moved "${t.title}" to ${columns.find((c) => c.id === status)?.title ?? status}`);
  };

  const people = React.useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => t.assignee && map.set(t.assignee.id, t.assignee.name));
    return [...map].map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const visible = tasks.filter(
    (t) =>
      (assignee === "all" || (assignee === "none" ? !t.assignee : t.assignee?.id === assignee)) &&
      (priority === "all" || t.priority === priority),
  );

  const submitDraft = (status: TaskStatus) => {
    const title = draft.trim();
    if (!title) return;
    const created = onCreateTask?.(title, status) ?? {
      id: `t-${Date.now()}`,
      title,
      status,
      priority: "medium" as TaskPriority,
    };
    commit([...tasks, created]);
    setDraft("");
    setAdding(null);
  };


  return (
    <section
      aria-label="Task board"
      className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-crm-soft">
          Assignee
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="h-7 rounded-crm border border-crm-border bg-crm-card px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            <option value="all">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="none">Unassigned</option>
          </select>
        </label>
        <SegmentedControl
          label="Priority filter"
          size="sm"
          value={priority}
          onValueChange={(v) => setPriority(v as "all" | TaskPriority)}
          options={[
            { value: "all", label: "All" },
            {
              value: "urgent",
              label: "Urgent",
              count: tasks.filter((t) => t.priority === "urgent").length,
            },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
        />
        <span className="crm-caption ml-auto text-crm-subtle">
          {visible.length} of {tasks.length} tasks
        </span>
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col, ci) => {
          const items = visible
            .filter((t) => t.status === col.id)
            .sort(
              (a, b) =>
                PRIORITY[a.priority].rank - PRIORITY[b.priority].rank ||
                (a.due ?? "9999").localeCompare(b.due ?? "9999"),
            );
          const prevCol = columns[ci - 1];
          const nextCol = columns[ci + 1];
          const total = tasks.filter((t) => t.status === col.id).length;
          const overLimit = col.wipLimit !== undefined && total > col.wipLimit;
          return (
            <div
              key={col.id}
              role="group"
              aria-label={`${col.title}, ${items.length} tasks`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.id);
              }}
              onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                if (id) move(id, col.id);
                setDragId(null);
                setOverCol(null);
              }}
              className={cn(
                "flex w-[260px] min-w-[260px] flex-col gap-2 rounded-crm border border-crm-border bg-crm-bg p-2 transition-colors",
                overCol === col.id && "border-crm-primary bg-crm-primary/5",
              )}
            >
              <header className="flex items-center justify-between px-1 py-0.5">
                <h3 className="text-sm font-medium">{col.title}</h3>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    overLimit ? "font-medium text-crm-danger" : "text-crm-subtle",
                  )}
                  title={col.wipLimit ? `WIP limit ${col.wipLimit}` : undefined}
                >
                  {total}
                  {col.wipLimit !== undefined ? ` / ${col.wipLimit}` : ""}
                  {overLimit ? <span className="sr-only"> (over WIP limit)</span> : null}
                </span>
              </header>

              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-[74px] animate-pulse rounded-crm bg-crm-muted" />
                ))
              ) : items.length === 0 ? (
                <p className="rounded-crm border border-dashed border-crm-border px-3 py-6 text-center text-xs text-crm-subtle">
                  {total ? "No tasks match filters" : "Drop tasks here"}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((t) => {
                    const overdue = t.due !== undefined && t.status !== "done" && t.due < today;
                    return (
                      <li
                        key={t.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", t.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(t.id);
                        }}
                        onDragEnd={() => setDragId(null)}
                        className={cn(
                          "group relative cursor-grab rounded-crm border border-crm-border bg-crm-card p-2.5 shadow-crm-raised active:cursor-grabbing",
                          dragId === t.id && "opacity-50",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onOpenTask?.(t)}
                          onKeyDown={(e) => {
                            if (!e.altKey) return;
                            const target =
                              e.key === "ArrowRight"
                                ? nextCol
                                : e.key === "ArrowLeft"
                                  ? prevCol
                                  : undefined;
                            if (target) {
                              e.preventDefault();
                              move(t.id, target.id);
                            }
                          }}
                          aria-describedby="task-board-kbd-hint"
                          className={cn(
                            "block w-full text-left text-sm outline-none focus-visible:underline",
                            t.status === "done" && "text-crm-subtle line-through",
                          )}
                        >
                          {t.title}
                        </button>
                        {t.related ? (
                          <p className="mt-0.5 truncate text-xs text-crm-subtle">{t.related}</p>
                        ) : null}
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span className={cn("flex items-center gap-1", PRIORITY[t.priority].cls)}>
                            <Flag className="size-3" aria-hidden />
                            {PRIORITY[t.priority].label}
                          </span>
                          {t.due ? (
                            <span
                              className={cn(
                                "flex items-center gap-1",
                                overdue ? "text-crm-danger" : "text-crm-soft",
                              )}
                            >
                              <CalendarClock className="size-3" aria-hidden />
                              {dueLabel(t.due, today)}
                            </span>
                          ) : null}
                          <span className="ml-auto flex items-center gap-1">
                            <span className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                              {prevCol ? (
                                <button
                                  type="button"
                                  aria-label={`Move to ${prevCol.title}`}
                                  onClick={() => move(t.id, prevCol.id)}
                                  className="rounded p-0.5 text-crm-soft hover:bg-crm-muted"
                                >
                                  <ArrowLeft className="size-3" />
                                </button>
                              ) : null}
                              {nextCol ? (
                                <button
                                  type="button"
                                  aria-label={`Move to ${nextCol.title}`}
                                  onClick={() => move(t.id, nextCol.id)}
                                  className="rounded p-0.5 text-crm-soft hover:bg-crm-muted"
                                >
                                  <ArrowRight className="size-3" />
                                </button>
                              ) : null}
                            </span>
                            {t.assignee ? (
                              <Avatar name={t.assignee.name} src={t.assignee.avatar} size="sm" />
                            ) : (
                              <span className="text-crm-faint">Unassigned</span>
                            )}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {adding === col.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitDraft(col.id);
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setAdding(null)}
                    aria-label={`New task in ${col.title}`}
                    placeholder="Task title"
                    maxLength={140}
                    className="h-7 min-w-0 flex-1 rounded-crm border border-crm-border bg-crm-card px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                  />
                  <Button type="submit" size="sm" disabled={!draft.trim()}>
                    Add
                  </Button>
                  <button
                    type="button"
                    aria-label="Cancel"
                    onClick={() => setAdding(null)}
                    className="rounded p-1 text-crm-soft hover:bg-crm-muted"
                  >
                    <X className="size-3.5" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAdding(col.id);
                    setDraft("");
                  }}
                  className="flex items-center gap-1 rounded-crm px-1.5 py-1 text-xs text-crm-soft outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                >
                  <Plus className="size-3" aria-hidden /> Add task
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p id="task-board-kbd-hint" className="sr-only">
        Press Alt plus Left or Right arrow to move the task between columns.
      </p>
    </section>
  );
}
