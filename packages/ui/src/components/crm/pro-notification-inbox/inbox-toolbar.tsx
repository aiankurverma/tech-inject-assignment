import * as React from "react";
import { Archive, ArchiveRestore, CheckCheck, Mail, MailOpen, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SnoozeMenu } from "@/components/crm/pro-notification-inbox/snooze-menu";
import type { InboxTypeMeta, InboxView } from "@/components/crm/pro-notification-inbox/types";

const VIEWS: { id: InboxView; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "unread", label: "Unread" },
  { id: "snoozed", label: "Snoozed" },
  { id: "archived", label: "Archived" },
];

export function ViewTabs({
  view,
  counts,
  onChange,
}: {
  view: InboxView;
  counts: Record<InboxView, number>;
  onChange: (v: InboxView) => void;
}) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + VIEWS.length) % VIEWS.length;
    refs.current[next]?.focus();
    onChange(VIEWS[next]!.id);
  };
  return (
    <div role="tablist" aria-label="Notification views" className="flex gap-1">
      {VIEWS.map((v, i) => (
        <button
          key={v.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          type="button"
          aria-selected={view === v.id}
          tabIndex={view === v.id ? 0 : -1}
          onKeyDown={(e) => onKey(e, i)}
          onClick={() => onChange(v.id)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-crm px-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none",
            view === v.id ? "bg-crm-muted text-crm-fg" : "text-crm-muted-fg hover:text-crm-fg",
          )}
        >
          {v.label}
          <span className="text-xs text-crm-subtle tabular-nums">
            {counts[v.id] > 999 ? "999+" : counts[v.id]}
          </span>
        </button>
      ))}
    </div>
  );
}

export function TypeFilters({
  types,
  meta,
  counts,
  selected,
  onToggle,
  onClear,
}: {
  types: string[];
  meta: Record<string, InboxTypeMeta>;
  counts: Map<string, number>;
  selected: ReadonlySet<string>;
  onToggle: (t: string) => void;
  onClear: () => void;
}) {
  if (!types.length) return null;
  return (
    <div role="group" aria-label="Filter by type" className="flex flex-wrap items-center gap-1.5">
      <Chip pressed={selected.size === 0} onClick={onClear}>
        All
      </Chip>
      {types.map((t) => (
        <Chip key={t} pressed={selected.has(t)} onClick={() => onToggle(t)}>
          {meta[t]?.label ?? t}
          <span className="text-crm-subtle tabular-nums">{counts.get(t) ?? 0}</span>
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none",
        pressed
          ? "border-crm-primary/60 bg-crm-primary/15 text-crm-fg"
          : "border-crm-border text-crm-soft hover:border-crm-faint hover:text-crm-fg",
      )}
    >
      {children}
    </button>
  );
}

export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative flex h-8 min-w-0 flex-1 items-center">
      <Search
        className="pointer-events-none absolute left-2.5 size-3.5 text-crm-muted-fg"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search notifications"
        aria-label="Search notifications"
        className="h-full w-full rounded-crm border border-crm-input bg-transparent pr-2 pl-8 text-sm text-crm-fg placeholder:text-crm-subtle focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
      />
    </label>
  );
}

export function BulkBar({
  count,
  view,
  now,
  onRead,
  onUnread,
  onArchive,
  onRestore,
  onSnooze,
  onClear,
  onMarkAllRead,
  unreadTotal,
}: {
  count: number;
  view: InboxView;
  now: Date;
  onRead: () => void;
  onUnread: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onSnooze: (d: Date) => void;
  onClear: () => void;
  onMarkAllRead: () => void;
  unreadTotal: number;
}) {
  const btn =
    "inline-flex h-8 items-center gap-1.5 rounded-crm px-2.5 text-xs text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none disabled:opacity-40";
  if (!count)
    return (
      <div className="flex h-10 items-center justify-between px-3 text-xs text-crm-muted-fg">
        <span>
          {unreadTotal ? `${unreadTotal.toLocaleString()} unread` : "You're all caught up"}
        </span>
        <button type="button" className={btn} disabled={!unreadTotal} onClick={onMarkAllRead}>
          <CheckCheck className="size-3.5" aria-hidden /> Mark all as read
        </button>
      </div>
    );
  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="flex h-10 items-center gap-1 bg-crm-primary/10 px-2 text-xs text-crm-fg"
    >
      <button type="button" aria-label="Clear selection" className={btn} onClick={onClear}>
        <X className="size-3.5" aria-hidden />
      </button>
      <span className="mr-auto tabular-nums" aria-live="polite">
        {count.toLocaleString()} selected
      </span>
      <button type="button" className={btn} onClick={onRead}>
        <MailOpen className="size-3.5" aria-hidden /> Read
      </button>
      <button type="button" className={btn} onClick={onUnread}>
        <Mail className="size-3.5" aria-hidden /> Unread
      </button>
      {view !== "archived" && <SnoozeMenu now={now} onSnooze={onSnooze} />}
      {view === "archived" || view === "snoozed" ? (
        <button type="button" className={btn} onClick={onRestore}>
          <ArchiveRestore className="size-3.5" aria-hidden /> Restore
        </button>
      ) : (
        <button type="button" className={btn} onClick={onArchive}>
          <Archive className="size-3.5" aria-hidden /> Archive
        </button>
      )}
    </div>
  );
}
