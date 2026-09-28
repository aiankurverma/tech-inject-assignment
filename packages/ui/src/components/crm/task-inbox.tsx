import * as React from "react";
import { AlarmClock, Inbox, Phone, Mail, Users, CheckSquare, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Checkbox } from "@/components/crm/checkbox";
import { SegmentedControl } from "@/components/crm/segmented-control";

export type InboxTaskKind = "call" | "email" | "meeting" | "todo";

export interface InboxTask {
  id: string;
  title: string;
  kind: InboxTaskKind;
  /** ISO date (yyyy-mm-dd); omit for "No date". */
  due?: string;
  done?: boolean;
  owner: { id: string; name: string; avatar?: string };
  related?: string;
}

export interface TaskInboxProps {
  tasks?: InboxTask[];
  defaultTasks?: InboxTask[];
  onTasksChange?: (tasks: InboxTask[]) => void;
  /** The signed-in user; drives the "Mine" filter. */
  currentUserId: string;
  /** Reference date for grouping (defaults to today). */
  today?: string;
  onOpenTask?: (task: InboxTask) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

const KIND_ICON: Record<InboxTaskKind, React.ReactNode> = {
  call: <Phone className="size-3.5" aria-hidden />,
  email: <Mail className="size-3.5" aria-hidden />,
  meeting: <Users className="size-3.5" aria-hidden />,
  todo: <CheckSquare className="size-3.5" aria-hidden />,
};

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Group = "Overdue" | "Today" | "Tomorrow" | "This week" | "Later" | "No date" | "Completed";
const ORDER: Group[] = [
  "Overdue",
  "Today",
  "Tomorrow",
  "This week",
  "Later",
  "No date",
  "Completed",
];

function groupOf(t: InboxTask, today: string): Group {
  if (t.done) return "Completed";
  if (!t.due) return "No date";
  if (t.due < today) return "Overdue";
  if (t.due === today) return "Today";
  if (t.due === addDays(today, 1)) return "Tomorrow";
  if (t.due <= addDays(today, 7)) return "This week";
  return "Later";
}

/** Personal task inbox grouped by due bucket, with complete/undo, snooze, bulk actions and j/k keys. */
export function TaskInbox({
  tasks: tasksProp,
  defaultTasks = [],
  onTasksChange,
  currentUserId,
  today = new Date().toISOString().slice(0, 10),
  onOpenTask,
  loading,
  error,
  onRetry,
  className,
}: TaskInboxProps) {
  const [inner, setInner] = React.useState(defaultTasks);
  const tasks = tasksProp ?? inner;
  const [view, setView] = React.useState("mine");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [undo, setUndo] = React.useState<{ ids: string[]; label: string } | null>(null);
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);

  const commit = (next: InboxTask[]) => {
    if (tasksProp === undefined) setInner(next);
    onTasksChange?.(next);
  };

  const filtered = tasks.filter((t) =>
    view === "done" ? t.done : !t.done && (view === "all" || t.owner.id === currentUserId),
  );
  const groups = ORDER.map((g) => ({
    g,
    items: filtered
      .filter((t) => groupOf(t, today) === g)
      .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? "")),
  })).filter((x) => x.items.length);
  const flat = groups.flatMap((x) => x.items);

  const setDone = (ids: string[], done: boolean) => {
    commit(tasks.map((t) => (ids.includes(t.id) ? { ...t, done } : t)));
    setSelected(new Set());
    if (done)
      setUndo({
        ids,
        label: ids.length === 1 ? "Task completed" : `${ids.length} tasks completed`,
      });
  };
  const snooze = (ids: string[], days: number) => {
    commit(tasks.map((t) => (ids.includes(t.id) ? { ...t, due: addDays(today, days) } : t)));
    setSelected(new Set());
  };

  React.useEffect(() => {
    if (!undo) return;
    const id = window.setTimeout(() => setUndo(null), 6000);
    return () => window.clearTimeout(id);
  }, [undo]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT" && e.key !== "j" && e.key !== "k") return;
    const cur = flat[active];
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "e" && cur) {
      setDone([cur.id], !cur.done);
    } else if (e.key === "x" && cur) {
      toggleSel(cur.id);
    } else if (e.key === "Enter" && cur) {
      onOpenTask?.(cur);
    }
  };
  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const overdueCount = tasks.filter(
    (t) => !t.done && t.owner.id === currentUserId && t.due && t.due < today,
  ).length;
  const sel = [...selected];

  return (
    <section
      aria-label="Task inbox"
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3">
        <h2 className="text-sm font-medium">My tasks</h2>
        {overdueCount ? (
          <span className="rounded-full bg-crm-danger/15 px-1.5 text-xs text-crm-danger tabular-nums">
            {overdueCount} overdue
          </span>
        ) : null}
        <SegmentedControl
          className="ml-auto"
          size="sm"
          label="Task view"
          value={view}
          onValueChange={(v) => {
            setView(v);
            setActive(0);
            setSelected(new Set());
          }}
          options={[
            { value: "mine", label: "Mine" },
            { value: "all", label: "Team" },
            { value: "done", label: "Completed" },
          ]}
        />
      </header>

      {sel.length ? (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex items-center gap-2 border-b border-crm-border bg-crm-primary/10 px-3 py-1.5 text-xs"
        >
          <span className="tabular-nums">{sel.length} selected</span>
          <button
            type="button"
            className="ml-auto hover:underline"
            onClick={() => setDone(sel, true)}
          >
            Complete
          </button>
          <button type="button" className="hover:underline" onClick={() => snooze(sel, 1)}>
            Snooze 1d
          </button>
          <button type="button" className="hover:underline" onClick={() => snooze(sel, 7)}>
            Snooze 1w
          </button>
          <button
            type="button"
            className="text-crm-soft hover:underline"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="flex flex-col items-center gap-2 p-8 text-center text-sm">
          <p className="text-crm-danger">{error}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="text-xs text-crm-soft underline">
              Try again
            </button>
          ) : null}
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-2 p-3" aria-busy>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-crm bg-crm-muted" />
          ))}
        </div>
      ) : flat.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-10 text-center">
          <Inbox className="size-6 text-crm-faint" aria-hidden />
          <p className="text-sm">{view === "done" ? "Nothing completed yet" : "Inbox zero"}</p>
          <p className="text-xs text-crm-subtle">
            {view === "done" ? "Completed tasks show up here." : "You're all caught up."}
          </p>
        </div>
      ) : (
        <ul
          ref={listRef}
          tabIndex={0}
          role="listbox"
          aria-multiselectable
          aria-label="Tasks. j/k to move, x to select, e to complete, Enter to open"
          aria-activedescendant={flat[active] ? `inbox-task-${flat[active].id}` : undefined}
          onKeyDown={onKeyDown}
          className="max-h-[480px] overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-crm-ring/60"
        >
          {groups.map(({ g, items }) => (
            <li key={g} role="presentation">
              <p
                className={cn(
                  "crm-eyebrow sticky top-0 z-10 bg-crm-card px-3 pt-3 pb-1",
                  g === "Overdue" ? "text-crm-danger" : "text-crm-subtle",
                )}
              >
                {g} · {items.length}
              </p>
              <ul role="presentation">
                {items.map((t) => {
                  const idx = flat.indexOf(t);
                  return (
                    <li
                      key={t.id}
                      id={`inbox-task-${t.id}`}
                      role="option"
                      aria-selected={selected.has(t.id)}
                      data-index={idx}
                      onClick={() => setActive(idx)}
                      className={cn(
                        "group flex items-center gap-2.5 px-3 py-2 text-sm",
                        idx === active && "bg-crm-muted/60",
                        selected.has(t.id) && "bg-crm-primary/10",
                      )}
                    >
                      <Checkbox
                        checked={selected.has(t.id)}
                        onCheckedChange={() => toggleSel(t.id)}
                        aria-label={`Select ${t.title}`}
                      />
                      <button
                        type="button"
                        aria-label={t.done ? `Mark "${t.title}" not done` : `Complete "${t.title}"`}
                        onClick={() => setDone([t.id], !t.done)}
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                          t.done
                            ? "border-crm-success bg-crm-success"
                            : "border-crm-input hover:border-crm-success",
                        )}
                      />
                      <span className="text-crm-soft">{KIND_ICON[t.kind]}</span>
                      <button
                        type="button"
                        onClick={() => onOpenTask?.(t)}
                        className={cn(
                          "min-w-0 flex-1 truncate text-left outline-none focus-visible:underline",
                          t.done && "text-crm-subtle line-through",
                        )}
                      >
                        {t.title}
                        {t.related ? (
                          <span className="ml-2 text-xs text-crm-subtle">{t.related}</span>
                        ) : null}
                      </button>
                      {!t.done ? (
                        <button
                          type="button"
                          aria-label={`Snooze "${t.title}" one day`}
                          onClick={() => snooze([t.id], 1)}
                          className="rounded p-1 text-crm-soft opacity-0 group-hover:opacity-100 hover:bg-crm-muted focus-visible:opacity-100"
                        >
                          <AlarmClock className="size-3.5" />
                        </button>
                      ) : null}
                      {t.due ? (
                        <span
                          className={cn(
                            "w-14 shrink-0 text-right text-xs tabular-nums",
                            g === "Overdue" ? "text-crm-danger" : "text-crm-subtle",
                          )}
                        >
                          {new Date(t.due + "T00:00:00").toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      ) : null}
                      {view === "all" ? (
                        <Avatar name={t.owner.name} src={t.owner.avatar} size="sm" />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div aria-live="polite" className="empty:hidden">
        {undo ? (
          <div className="flex items-center gap-3 border-t border-crm-border px-3 py-2 text-xs">
            {undo.label}
            <button
              type="button"
              onClick={() => {
                setDone(undo.ids, false);
                setUndo(null);
              }}
              className="ml-auto flex items-center gap-1 text-crm-primary hover:underline"
            >
              <Undo2 className="size-3" aria-hidden /> Undo
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
