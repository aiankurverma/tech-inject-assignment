import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { formatDistanceToNowStrict, format } from "date-fns";
import { Archive, ArchiveRestore, Check, Mail, MailOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { SnoozeMenu } from "@/components/crm/pro-notification-inbox/snooze-menu";
import type {
  InboxNotification,
  InboxTypeMeta,
} from "@/components/crm/pro-notification-inbox/types";

export interface NotificationRowProps {
  id: string;
  item: InboxNotification;
  meta?: InboxTypeMeta;
  selected: boolean;
  active: boolean;
  fresh: boolean;
  now: Date;
  posinset: number;
  setsize: number;
  onToggleSelect: (id: string, range: boolean) => void;
  onOpen: (item: InboxNotification) => void;
  onRead: (id: string, read: boolean) => void;
  onArchive: (id: string, archive: boolean) => void;
  onSnooze: (id: string, until: Date) => void;
  onAnimated: (id: string) => void;
  onPointerActivate: () => void;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function RowImpl({
  id,
  item,
  meta,
  selected,
  active,
  fresh,
  now,
  posinset,
  setsize,
  onToggleSelect,
  onOpen,
  onRead,
  onArchive,
  onSnooze,
  onAnimated,
  onPointerActivate,
}: NotificationRowProps) {
  const reduce = useReducedMotion();
  const unread = !item.readAt;
  const archived = !!item.archivedAt;
  const created = new Date(item.createdAt);
  const animate = fresh && !reduce;
  // With reduced motion there is no animation to complete; acknowledge once seen.
  React.useEffect(() => {
    if (!fresh || !reduce) return;
    const t = setTimeout(() => onAnimated(item.id), 1500);
    return () => clearTimeout(t);
  }, [fresh, reduce, item.id, onAnimated]);

  return (
    <motion.div
      id={id}
      role="option"
      aria-selected={selected}
      aria-posinset={posinset}
      aria-setsize={setsize}
      aria-label={`${unread ? "Unread. " : ""}${item.title}`}
      initial={animate ? { opacity: 0, y: -8, backgroundColor: "rgba(65,36,251,0.18)" } : false}
      animate={animate ? { opacity: 1, y: 0, backgroundColor: "rgba(65,36,251,0)" } : undefined}
      transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
      onAnimationComplete={() => fresh && onAnimated(item.id)}
      onMouseDown={onPointerActivate}
      onClick={(e) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) onToggleSelect(item.id, e.shiftKey);
        else onOpen(item);
      }}
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 border-b border-crm-border px-3 py-3 text-sm",
        selected ? "bg-crm-primary/10" : "hover:bg-crm-raised",
        active && "outline-2 -outline-offset-2 outline-crm-ring",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-4 left-1 size-1.5 rounded-full",
          unread ? "bg-crm-primary" : "bg-transparent",
        )}
      />
      <span
        role="checkbox"
        aria-checked={selected}
        aria-label={`Select ${item.title}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(item.id, e.shiftKey);
        }}
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
          selected
            ? "border-crm-primary bg-crm-primary text-crm-primary-fg"
            : "border-crm-input group-hover:border-crm-subtle",
        )}
      >
        {selected && <Check className="size-3" aria-hidden />}
      </span>
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-crm-muted text-[11px] font-medium text-crm-chip">
        {item.actor?.avatar ? (
          <img src={item.actor.avatar} alt="" className="size-full object-cover" />
        ) : (
          initials(item.actor?.name ?? meta?.label ?? item.type)
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("truncate", unread ? "font-medium text-crm-fg" : "text-crm-soft")}>
            {item.title}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full border border-crm-border px-1.5 text-[10px] leading-4 text-crm-muted-fg",
              meta?.tone,
            )}
          >
            {meta?.label ?? item.type}
          </span>
        </div>
        {item.body && <p className="mt-0.5 line-clamp-2 text-xs text-crm-muted-fg">{item.body}</p>}
      </div>
      <time
        dateTime={created.toISOString()}
        title={format(created, "PPpp")}
        className="shrink-0 pt-0.5 text-xs text-crm-muted-fg tabular-nums group-hover:invisible group-focus-within:invisible"
      >
        {formatDistanceToNowStrict(created, { addSuffix: false }).replace(/ (\w)\w*$/, "$1")}
      </time>
      <div
        className="absolute top-2 right-2 hidden items-center gap-0.5 rounded-crm border border-crm-border bg-crm-card p-0.5 shadow-crm-raised group-focus-within:flex group-hover:flex"
        onClick={(e) => e.stopPropagation()}
      >
        <IconBtn
          label={unread ? "Mark as read" : "Mark as unread"}
          onClick={() => onRead(item.id, unread)}
        >
          {unread ? <MailOpen className="size-3.5" /> : <Mail className="size-3.5" />}
        </IconBtn>
        {!archived && <SnoozeMenu compact now={now} onSnooze={(d) => onSnooze(item.id, d)} />}
        <IconBtn
          label={archived ? "Restore" : "Archive"}
          onClick={() => onArchive(item.id, !archived)}
        >
          {archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
        </IconBtn>
      </div>
    </motion.div>
  );
}

function IconBtn({
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
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-crm text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

export const NotificationRow = React.memo(RowImpl);
