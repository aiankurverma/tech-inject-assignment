import * as React from "react";
import {
  CalendarClock,
  Flag,
  Link2,
  Mail,
  MoreHorizontal,
  Phone,
  Repeat,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/crm/avatar";
import { Checkbox } from "@/components/crm/checkbox";
import { cn } from "@/lib/utils";

export type TaskPriority = "urgent" | "high" | "normal" | "low";
export type TaskType = "todo" | "call" | "email" | "meeting";

export interface Task {
  id: string;
  title: string;
  done?: boolean;
  /** Due date; a date-only string ("2026-10-02") is treated as end of that day. */
  due?: Date | string | null;
  priority?: TaskPriority;
  type?: TaskType;
  assignee?: { name: string; src?: string };
  /** Linked record, e.g. { label: "Acme Corp", href: "/accounts/acme" }. */
  related?: { label: string; href?: string };
  /** Recurrence summary, e.g. "Weekly". */
  repeat?: string;
  /** When the task was completed; shown instead of the due date for done tasks. */
  completedAt?: Date | string;
}

export interface TaskItemProps {
  task: Task;
  onToggle?: (id: string, done: boolean) => void;
  onOpen?: (task: Task) => void;
  onMenu?: (task: Task, anchor: HTMLElement) => void;
  /** Clock override for tests and stories. */
  now?: Date;
  locale?: string;
  disabled?: boolean;
  /** Tighter rows for dense lists. */
  compact?: boolean;
  className?: string;
}

const typeIcon = { todo: null, call: Phone, email: Mail, meeting: Users } as const;

const priorityStyle: Record<TaskPriority, string> = {
  urgent: "text-crm-danger",
  high: "text-[#fb923c]",
  normal: "text-crm-subtle",
  low: "text-crm-faint",
};

export function parseDue(due: Date | string): Date {
  if (typeof due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(due)) {
    const [y, m, d] = due.split("-").map(Number);
    return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, 23, 59, 59);
  }
  return new Date(due);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole calendar days from today (negative = overdue). */
export function daysUntil(due: Date, now: Date): number {
  return Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);
}

export function dueLabel(
  due: Date,
  now: Date,
  locale?: string,
): { text: string; tone: "overdue" | "today" | "soon" | "later" } {
  const days = daysUntil(due, now);
  const hasTime = due.getHours() !== 23 || due.getMinutes() !== 59;
  const time = hasTime
    ? ` ${new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(due)}`
    : "";
  if (days < 0 || (days === 0 && due.getTime() < now.getTime())) {
    const n = Math.abs(days);
    return { text: n === 0 ? `Overdue${time}` : `${n}d overdue`, tone: "overdue" };
  }
  if (days === 0) return { text: `Today${time}`, tone: "today" };
  if (days === 1) return { text: `Tomorrow${time}`, tone: "soon" };
  if (days < 7)
    return {
      text: new Intl.DateTimeFormat(locale, { weekday: "short" }).format(due) + time,
      tone: "soon",
    };
  return {
    text: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(due),
    tone: "later",
  };
}

const dueTone = {
  overdue: "text-crm-danger",
  today: "text-crm-warning",
  soon: "text-crm-soft",
  later: "text-crm-subtle",
} as const;

/**
 * One CRM task row: checkbox, type icon, title, related record, due date that colours itself
 * overdue / today, priority flag, recurrence and owner. Done tasks strike through.
 */
export function TaskItem({
  task,
  onToggle,
  onOpen,
  onMenu,
  now: nowProp,
  locale,
  disabled,
  compact,
  className,
}: TaskItemProps) {
  const now = nowProp ?? new Date();
  const TypeIcon = typeIcon[task.type ?? "todo"];
  const due = task.due ? parseDue(task.due) : null;
  const label = due && !Number.isNaN(due.getTime()) ? dueLabel(due, now, locale) : null;
  const checkId = React.useId();
  const priority = task.priority ?? "normal";

  return (
    <div
      data-done={task.done || undefined}
      className={cn(
        "group flex items-center gap-3 rounded-crm px-2 font-crm hover:bg-crm-raised",
        compact ? "py-1" : "py-2",
        className,
      )}
    >
      <Checkbox
        id={checkId}
        checked={!!task.done}
        disabled={disabled}
        onCheckedChange={(v) => onToggle?.(task.id, v === true)}
        aria-label={`Mark "${task.title}" ${task.done ? "not done" : "done"}`}
      />
      {TypeIcon ? (
        <TypeIcon className="size-3.5 shrink-0 text-crm-subtle" aria-label={task.type} />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
        {onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(task)}
            className={cn(
              "min-w-0 truncate text-left text-sm outline-none hover:underline focus-visible:underline",
              task.done ? "text-crm-subtle line-through" : "text-crm-fg",
            )}
          >
            {task.title}
          </button>
        ) : (
          <label
            htmlFor={checkId}
            className={cn(
              "min-w-0 truncate text-sm",
              task.done ? "text-crm-subtle line-through" : "text-crm-fg",
            )}
          >
            {task.title}
          </label>
        )}
        {task.related ? (
          task.related.href ? (
            <a
              href={task.related.href}
              className="inline-flex min-w-0 items-center gap-1 crm-caption text-crm-soft hover:text-crm-fg [&_svg]:size-3"
            >
              <Link2 aria-hidden />
              <span className="truncate">{task.related.label}</span>
            </a>
          ) : (
            <span className="inline-flex min-w-0 items-center gap-1 crm-caption text-crm-soft [&_svg]:size-3">
              <Link2 aria-hidden />
              <span className="truncate">{task.related.label}</span>
            </span>
          )
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {task.repeat ? (
          <span title={`Repeats ${task.repeat.toLowerCase()}`} className="text-crm-subtle">
            <Repeat className="size-3" aria-label={`Repeats ${task.repeat}`} />
          </span>
        ) : null}
        {priority !== "normal" && !task.done ? (
          <Flag
            className={cn(
              "size-3",
              priorityStyle[priority],
              priority === "urgent" && "fill-current",
            )}
            aria-label={`${priority} priority`}
          />
        ) : null}
        {task.done && task.completedAt ? (
          <span className="crm-caption text-crm-subtle">
            Done{" "}
            {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(
              new Date(task.completedAt),
            )}
          </span>
        ) : label ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 crm-caption tabular-nums whitespace-nowrap [&_svg]:size-3",
              task.done ? "text-crm-subtle" : dueTone[label.tone],
            )}
          >
            <CalendarClock aria-hidden />
            <time dateTime={due?.toISOString()}>{label.text}</time>
          </span>
        ) : null}
        {task.assignee ? (
          <span title={task.assignee.name}>
            <Avatar name={task.assignee.name} src={task.assignee.src} size="sm" />
          </span>
        ) : null}
        {onMenu ? (
          <button
            type="button"
            aria-label={`More actions for "${task.title}"`}
            onClick={(e) => onMenu(task, e.currentTarget)}
            className="rounded-full p-1 text-crm-subtle opacity-0 outline-none group-hover:opacity-100 hover:bg-crm-muted hover:text-crm-fg focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            <MoreHorizontal className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
