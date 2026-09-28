import * as React from "react";
import { ChevronRight, ListTodo, Plus } from "lucide-react";
import {
  TaskItem,
  daysUntil,
  parseDue,
  type Task,
  type TaskPriority,
} from "@/components/crm/task-item";
import { cn } from "@/lib/utils";

export type TaskGroupBy = "due" | "assignee" | "priority" | "none";
export type TaskFilter = "open" | "all" | "done";

export interface TaskListProps {
  /** Controlled tasks. */
  tasks?: Task[];
  defaultTasks?: Task[];
  onTasksChange?: (tasks: Task[]) => void;
  groupBy?: TaskGroupBy;
  filter?: TaskFilter;
  defaultFilter?: TaskFilter;
  onFilterChange?: (f: TaskFilter) => void;
  /** Creates a task from the quick-add box; return the new task, or omit to skip quick add. */
  onCreate?: (title: string) => Task;
  onOpen?: (task: Task) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  /** Clock override for tests and stories. */
  now?: Date;
  locale?: string;
  title?: string;
  className?: string;
}

const priorityOrder: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const dueBuckets = [
  "Overdue",
  "Today",
  "Tomorrow",
  "This week",
  "Later",
  "No due date",
  "Completed",
];

function dueBucket(t: Task, now: Date): string {
  if (t.done) return "Completed";
  if (!t.due) return "No due date";
  const d = parseDue(t.due);
  const days = daysUntil(d, now);
  if (days < 0 || (days === 0 && d.getTime() < now.getTime())) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return "This week";
  return "Later";
}

function compare(a: Task, b: Task): number {
  if (!!a.done !== !!b.done) return a.done ? 1 : -1;
  const ad = a.due ? parseDue(a.due).getTime() : Infinity;
  const bd = b.due ? parseDue(b.due).getTime() : Infinity;
  if (ad !== bd) return ad - bd;
  return priorityOrder[a.priority ?? "normal"] - priorityOrder[b.priority ?? "normal"];
}

/**
 * Grouped task list (by due bucket, assignee or priority) with open/done filter tabs, counts,
 * collapsible groups, quick add, optimistic toggle, and loading / empty / error states.
 */
export function TaskList({
  tasks: controlled,
  defaultTasks = [],
  onTasksChange,
  groupBy = "due",
  filter: filterProp,
  defaultFilter = "open",
  onFilterChange,
  onCreate,
  onOpen,
  loading,
  error,
  onRetry,
  now: nowProp,
  locale,
  title = "Tasks",
  className,
}: TaskListProps) {
  const [inner, setInner] = React.useState(defaultTasks);
  const tasks = controlled ?? inner;
  const [innerFilter, setInnerFilter] = React.useState(defaultFilter);
  const filter = filterProp ?? innerFilter;
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set(["Completed"]));
  const [draft, setDraft] = React.useState("");
  const now = nowProp ?? new Date();

  const update = (next: Task[]) => {
    if (controlled === undefined) setInner(next);
    onTasksChange?.(next);
  };
  const setFilter = (f: TaskFilter) => {
    if (filterProp === undefined) setInnerFilter(f);
    onFilterChange?.(f);
  };

  const openCount = tasks.filter((t) => !t.done).length;
  const overdue = tasks.filter((t) => dueBucket(t, now) === "Overdue").length;
  const visible = tasks
    .filter((t) => (filter === "open" ? !t.done : filter === "done" ? t.done : true))
    .sort(compare);

  const keyOf = (t: Task): string => {
    if (groupBy === "due") return dueBucket(t, now);
    if (groupBy === "assignee") return t.assignee?.name ?? "Unassigned";
    if (groupBy === "priority")
      return (t.priority ?? "normal").replace(/^./, (c) => c.toUpperCase());
    return "All";
  };
  const groups = new Map<string, Task[]>();
  for (const t of visible) groups.set(keyOf(t), [...(groups.get(keyOf(t)) ?? []), t]);
  const order = [...groups.keys()].sort((a, b) => {
    if (groupBy === "due") return dueBuckets.indexOf(a) - dueBuckets.indexOf(b);
    if (groupBy === "priority")
      return (
        priorityOrder[a.toLowerCase() as TaskPriority] -
        priorityOrder[b.toLowerCase() as TaskPriority]
      );
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return a.localeCompare(b);
  });

  const toggleGroup = (g: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t || !onCreate) return;
    update([...tasks, onCreate(t)]);
    setDraft("");
  };

  const tabs: { id: TaskFilter; label: string; count?: number }[] = [
    { id: "open", label: "Open", count: openCount },
    { id: "done", label: "Done", count: tasks.length - openCount },
    { id: "all", label: "All" },
  ];

  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col rounded-xl border border-crm-border bg-crm-card font-crm",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-crm-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-crm-fg">{title}</h2>
          {overdue > 0 ? (
            <span className="rounded-full bg-crm-danger/15 px-1.5 text-[11px] text-crm-danger">
              {overdue} overdue
            </span>
          ) : null}
        </div>
        <div
          role="tablist"
          aria-label="Filter tasks"
          className="flex rounded-full bg-crm-raised p-0.5"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={filter === t.id}
              onClick={() => setFilter(t.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                filter === t.id ? "bg-crm-muted text-crm-fg" : "text-crm-soft hover:text-crm-fg",
              )}
            >
              {t.label}
              {t.count !== undefined ? (
                <span className="ml-1 tabular-nums text-crm-subtle">{t.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      </header>

      {onCreate ? (
        <form
          onSubmit={add}
          className="flex items-center gap-2 border-b border-crm-border px-4 py-2"
        >
          <Plus className="size-3.5 text-crm-subtle" aria-hidden />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a task and press Enter"
            aria-label="New task title"
            maxLength={200}
            className="h-7 flex-1 bg-transparent text-sm text-crm-fg outline-none placeholder:text-crm-subtle"
          />
        </form>
      ) : null}

      <div className="flex flex-col p-2" aria-busy={loading || undefined}>
        {error ? (
          <div role="alert" className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <p className="text-sm text-crm-danger">{error}</p>
            {onRetry ? (
              <button type="button" onClick={onRetry} className="text-xs text-crm-fg underline">
                Try again
              </button>
            ) : null}
          </div>
        ) : loading ? (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2.5" aria-hidden>
              <span className="size-4 rounded-[4px] bg-crm-muted" />
              <span
                className="h-3 flex-1 animate-pulse rounded bg-crm-muted"
                style={{ maxWidth: `${70 - i * 10}%` }}
              />
              <span className="h-3 w-14 animate-pulse rounded bg-crm-muted" />
            </div>
          ))
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <ListTodo className="size-5 text-crm-subtle" aria-hidden />
            <p className="text-sm text-crm-fg">
              {filter === "done" ? "Nothing completed yet" : "You're all caught up"}
            </p>
            <p className="crm-caption text-crm-soft">
              {filter === "open"
                ? "No open tasks. Add one above to plan your next step."
                : "No tasks to show."}
            </p>
          </div>
        ) : (
          order.map((g) => {
            const list = groups.get(g) ?? [];
            const isCollapsed = collapsed.has(g) && filter !== "done";
            const gid = `tasks-${g.replace(/\W+/g, "-")}`;
            return (
              <div key={g} className="flex flex-col">
                {groupBy !== "none" ? (
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-controls={gid}
                    onClick={() => toggleGroup(g)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2 pt-2 pb-1 text-left crm-eyebrow outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                      g === "Overdue" ? "text-crm-danger" : "text-crm-subtle",
                    )}
                  >
                    <ChevronRight
                      className={cn("size-3 transition-transform", !isCollapsed && "rotate-90")}
                      aria-hidden
                    />
                    {g}
                    <span className="tabular-nums">{list.length}</span>
                  </button>
                ) : null}
                {!isCollapsed ? (
                  <div id={gid} role="list">
                    {list.map((t) => (
                      <div role="listitem" key={t.id}>
                        <TaskItem
                          task={t}
                          now={now}
                          locale={locale}
                          onOpen={onOpen}
                          onToggle={(id, done) =>
                            update(
                              tasks.map((x) =>
                                x.id === id
                                  ? {
                                      ...x,
                                      done,
                                      completedAt: done ? now.toISOString() : undefined,
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
