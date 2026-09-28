import * as React from "react";
import { Archive, BellOff, Check, CheckCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { CountBadge } from "@/components/crm/badge";
import { NotificationItem, type Notification } from "@/components/crm/notifications";
import { SegmentedControl } from "@/components/crm/segmented-control";

export type NotificationCategory = "mention" | "assignment" | "deal" | "system";

export interface CenterNotification extends Omit<Notification, "time"> {
  /** ISO date-time the notification was created. */
  createdAt: string;
  category: NotificationCategory;
  /** ISO date-time; hidden until then. */
  snoozedUntil?: string;
  archived?: boolean;
}

export interface NotificationCenterProps {
  items: CenterNotification[];
  /** Called with the full next list after any change (read, archive, snooze). */
  onItemsChange: (items: CenterNotification[]) => void;
  onOpen?: (item: CenterNotification) => void;
  /** Override "now" for grouping and relative times. */
  now?: Date;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

const DAY = 86_400_000;

/** "just now", "5m", "3h", "2d" or a short date. */
export function shortAgo(iso: string, now: Date) {
  const diff = +now - +new Date(iso);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const groupOf = (iso: string, now: Date) => {
  const d = new Date(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= today) return "Today";
  if (+d >= +today - DAY) return "Yesterday";
  if (+d >= +today - 6 * DAY) return "This week";
  return "Earlier";
};

const snoozeOptions = [
  { label: "1 hour", ms: 3_600_000 },
  { label: "3 hours", ms: 3 * 3_600_000 },
  { label: "Tomorrow", ms: DAY },
];

/**
 * Full-page inbox for notifications: filter tabs with counts, date groups, per-item read/snooze/archive,
 * mark all read, and j/k + Enter/e/s keyboard triage.
 */
export function NotificationCenter({
  items,
  onItemsChange,
  onOpen,
  now: nowProp,
  loading,
  error,
  onRetry,
  className,
}: NotificationCenterProps) {
  const now = nowProp ?? new Date();
  const [filter, setFilter] = React.useState("all");
  const [active, setActive] = React.useState(0);
  const [snoozeFor, setSnoozeFor] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const live = items.filter((n) => !n.snoozedUntil || new Date(n.snoozedUntil) <= now);
  const inbox = live.filter((n) => !n.archived);
  const counts = {
    all: inbox.length,
    unread: inbox.filter((n) => n.unread).length,
    mention: inbox.filter((n) => n.category === "mention").length,
    assignment: inbox.filter((n) => n.category === "assignment").length,
    archived: live.filter((n) => n.archived).length,
  };
  const shown = (filter === "archived" ? live.filter((n) => n.archived) : inbox)
    .filter((n) =>
      filter === "unread"
        ? n.unread
        : filter === "mention" || filter === "assignment"
          ? n.category === filter
          : true,
    )
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const snoozedCount = items.filter((n) => n.snoozedUntil && new Date(n.snoozedUntil) > now).length;

  const patch = (ids: string[], p: Partial<CenterNotification>) =>
    onItemsChange(items.map((n) => (ids.includes(n.id) ? { ...n, ...p } : n)));

  const current = shown[Math.min(active, shown.length - 1)];
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!shown.length || (e.target as HTMLElement).closest("[data-snooze]")) return;
    const k = e.key;
    if (k === "j" || k === "ArrowDown") setActive((i) => Math.min(shown.length - 1, i + 1));
    else if (k === "k" || k === "ArrowUp") setActive((i) => Math.max(0, i - 1));
    else if (k === "Enter" && current) {
      patch([current.id], { unread: false });
      onOpen?.(current);
    } else if (k === "e" && current)
      patch([current.id], { archived: !current.archived, unread: false });
    else if (k === "u" && current) patch([current.id], { unread: !current.unread });
    else if (k === "s" && current) setSnoozeFor(current.id);
    else return;
    e.preventDefault();
  };
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (el && listRef.current?.contains(document.activeElement)) el.focus();
  }, [active]);

  const groups: { name: string; rows: { n: CenterNotification; i: number }[] }[] = [];
  shown.forEach((n, i) => {
    const g = groupOf(n.createdAt, now);
    const last = groups[groups.length - 1];
    if (last?.name === g) last.rows.push({ n, i });
    else groups.push({ name: g, rows: [{ n, i }] });
  });

  return (
    <section
      aria-label="Notifications"
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-crm-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-crm-fg">
          Notifications <CountBadge>{counts.unread}</CountBadge>
        </h2>
        <div className="flex items-center gap-2">
          {snoozedCount ? (
            <span className="flex items-center gap-1 text-xs text-crm-subtle">
              <Clock className="size-3.5" aria-hidden /> {snoozedCount} snoozed
            </span>
          ) : null}
          <Button
            size="sm"
            disabled={!counts.unread}
            onClick={() =>
              patch(
                inbox.filter((n) => n.unread).map((n) => n.id),
                { unread: false },
              )
            }
          >
            <CheckCheck /> Mark all read
          </Button>
        </div>
      </header>
      <div className="overflow-x-auto border-b border-crm-border px-4 py-2">
        <SegmentedControl
          label="Filter notifications"
          size="sm"
          value={filter}
          onValueChange={(v) => {
            setFilter(v);
            setActive(0);
          }}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "unread", label: "Unread", count: counts.unread },
            { value: "mention", label: "Mentions", count: counts.mention },
            { value: "assignment", label: "Assigned", count: counts.assignment },
            { value: "archived", label: "Archived", count: counts.archived },
          ]}
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 p-8 text-center text-sm text-crm-danger"
        >
          {error}
          {onRetry ? (
            <Button size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : loading ? (
        <ul aria-busy className="flex flex-col gap-2 p-4">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-14 animate-pulse rounded-crm bg-crm-muted" />
          ))}
        </ul>
      ) : !shown.length ? (
        <div className="flex flex-col items-center gap-2 p-10 text-center">
          <BellOff className="size-6 text-crm-subtle" aria-hidden />
          <p className="text-sm text-crm-fg">
            {filter === "unread" ? "You are all caught up" : "Nothing here yet"}
          </p>
          <p className="text-xs text-crm-subtle">New activity on your records will show up here.</p>
        </div>
      ) : (
        <ul
          ref={listRef}
          aria-label="Notification list"
          aria-keyshortcuts="j k Enter e u s"
          onKeyDown={onKeyDown}
          className="max-h-[560px] overflow-y-auto px-2 py-2"
        >
          {groups.map((g) => (
            <li key={g.name}>
              <p className="crm-eyebrow px-2 pt-2 pb-1 text-crm-subtle">{g.name}</p>
              <ul>
                {g.rows.map(({ n, i }) => (
                  <li
                    key={n.id}
                    data-index={i}
                    tabIndex={i === Math.min(active, shown.length - 1) ? 0 : -1}
                    aria-current={i === active || undefined}
                    onFocus={() => setActive(i)}
                    onClick={() => {
                      patch([n.id], { unread: false });
                      onOpen?.(n);
                    }}
                    className={cn(
                      "group relative cursor-pointer rounded-crm outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                      i === active && "bg-crm-raised",
                    )}
                  >
                    <NotificationItem n={{ ...n, time: shortAgo(n.createdAt, now) }} />
                    <div
                      className="absolute top-2 right-6 hidden items-center gap-0.5 rounded-full bg-crm-raised p-0.5 shadow-crm-raised group-focus-within:flex group-hover:flex"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <RowAction
                        label={n.unread ? "Mark read" : "Mark unread"}
                        onClick={() => patch([n.id], { unread: !n.unread })}
                      >
                        <Check />
                      </RowAction>
                      <RowAction
                        label="Snooze"
                        onClick={() => setSnoozeFor(snoozeFor === n.id ? null : n.id)}
                      >
                        <Clock />
                      </RowAction>
                      <RowAction
                        label={n.archived ? "Move to inbox" : "Archive"}
                        onClick={() => patch([n.id], { archived: !n.archived, unread: false })}
                      >
                        <Archive />
                      </RowAction>
                    </div>
                    {snoozeFor === n.id ? (
                      <div
                        data-snooze
                        role="group"
                        aria-label="Snooze until"
                        onClick={(e) => e.stopPropagation()}
                        className="flex flex-wrap gap-1 px-12 pb-2"
                      >
                        {snoozeOptions.map((o) => (
                          <Button
                            key={o.label}
                            size="sm"
                            variant="muted"
                            autoFocus={o.ms === 3_600_000}
                            onClick={() => {
                              patch([n.id], { snoozedUntil: new Date(+now + o.ms).toISOString() });
                              setSnoozeFor(null);
                            }}
                          >
                            {o.label}
                          </Button>
                        ))}
                        <Button size="sm" variant="ghost" onClick={() => setSnoozeFor(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <footer className="border-t border-crm-border px-4 py-2 text-[11px] text-crm-subtle">
        j/k to move · Enter open · e archive · u unread · s snooze
      </footer>
    </section>
  );
}

function RowAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      tabIndex={-1}
      onClick={onClick}
      className="grid size-6 cursor-pointer place-items-center rounded-full text-crm-soft hover:bg-crm-muted hover:text-crm-fg [&_svg]:size-3.5"
    >
      {children}
    </button>
  );
}
