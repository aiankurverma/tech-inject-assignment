import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNowStrict } from "date-fns";
import { Eye, Inbox, PenLine } from "lucide-react";
import type { ResolvedBusinessHours } from "@/components/crm/pro-ticket-console/business-hours";
import { SlaTimer } from "@/components/crm/pro-ticket-console/sla-timer";
import type { Ticket, TicketPriority } from "@/components/crm/pro-ticket-console/types";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 76;

export const PRIORITY_DOT: Record<TicketPriority, string> = {
  urgent: "bg-crm-danger",
  high: "bg-crm-warning",
  normal: "bg-crm-primary",
  low: "bg-crm-subtle",
};

export interface TicketQueueProps {
  tickets: Ticket[];
  selected: ReadonlySet<string>;
  activeId: string | null;
  currentUser: string;
  hours: ResolvedBusinessHours;
  getSla: (t: Ticket) => { dueAt: number | null; target: number; paused: boolean };
  onActivate: (id: string) => void;
  onToggle: (id: string, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => void;
  loading?: boolean;
  now?: Date;
  listId: string;
  emptyLabel?: string;
}

export function TicketQueue({
  tickets,
  selected,
  activeId,
  currentUser,
  hours,
  getSla,
  onActivate,
  onToggle,
  loading,
  now,
  listId,
  emptyLabel = "Inbox zero. Nothing matches this view.",
}: TicketQueueProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: loading ? 12 : tickets.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (i) => (loading ? `sk-${i}` : tickets[i]!.id),
  });

  const activeIndex = React.useMemo(
    () => (activeId ? tickets.findIndex((t) => t.id === activeId) : -1),
    [activeId, tickets],
  );
  React.useEffect(() => {
    if (activeIndex >= 0) virtualizer.scrollToIndex(activeIndex, { align: "auto" });
  }, [activeIndex, virtualizer]);

  if (!loading && tickets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-crm-muted-fg">
        <Inbox className="size-6" aria-hidden />
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      id={listId}
      role="listbox"
      aria-label="Ticket queue"
      aria-multiselectable="true"
      aria-busy={loading || undefined}
      aria-activedescendant={activeId ? `${listId}-${activeId}` : undefined}
      tabIndex={0}
      className="h-full overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:ring-inset"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((v) => {
          const style: React.CSSProperties = {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: v.size,
            transform: `translateY(${v.start}px)`,
          };
          if (loading) {
            return (
              <div key={v.key} style={style} className="border-b border-crm-border px-3 py-3">
                <div className="h-3 w-2/3 animate-pulse rounded bg-crm-muted" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-crm-muted" />
              </div>
            );
          }
          const t = tickets[v.index]!;
          const sla = getSla(t);
          return (
            <QueueRow
              key={v.key}
              style={style}
              domId={`${listId}-${t.id}`}
              ticket={t}
              checked={selected.has(t.id)}
              active={t.id === activeId}
              currentUser={currentUser}
              dueAt={sla.dueAt}
              target={sla.target}
              paused={sla.paused}
              hours={hours}
              now={now}
              onActivate={onActivate}
              onToggle={onToggle}
            />
          );
        })}
      </div>
    </div>
  );
}

interface QueueRowProps {
  style: React.CSSProperties;
  domId: string;
  ticket: Ticket;
  checked: boolean;
  active: boolean;
  currentUser: string;
  dueAt: number | null;
  target: number;
  paused: boolean;
  hours: ResolvedBusinessHours;
  now?: Date;
  onActivate: (id: string) => void;
  onToggle: TicketQueueProps["onToggle"];
}

const QueueRow = React.memo(function QueueRow({
  style,
  domId,
  ticket: t,
  checked,
  active,
  currentUser,
  dueAt,
  target,
  paused,
  hours,
  now,
  onActivate,
  onToggle,
}: QueueRowProps) {
  const others = (t.viewers ?? []).filter((v) => v !== currentUser);
  const replying = (t.replying ?? []).filter((v) => v !== currentUser);
  return (
    <div
      id={domId}
      role="option"
      aria-selected={checked}
      aria-current={active || undefined}
      style={style}
      onClick={(e) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) onToggle(t.id, e);
        else onActivate(t.id);
      }}
      className={cn(
        "group flex cursor-pointer gap-2.5 border-b border-crm-border px-3 py-2.5 text-left",
        active ? "bg-crm-raised" : "hover:bg-crm-raised/60",
        checked && "bg-crm-primary/10",
        active && "shadow-[inset_2px_0_0_var(--color-crm-primary)]",
      )}
    >
      <input
        type="checkbox"
        tabIndex={-1}
        aria-label={`Select ticket ${t.id}`}
        checked={checked}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(t.id, e);
        }}
        onChange={() => {}}
        className="mt-0.5 size-3.5 shrink-0 accent-[var(--color-crm-primary)]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("size-1.5 shrink-0 rounded-full", PRIORITY_DOT[t.priority])} />
          <span
            className={cn(
              "truncate text-xs",
              t.unread ? "font-semibold text-crm-fg" : "text-crm-soft",
            )}
          >
            {t.requester.name}
          </span>
          <span className="ml-auto shrink-0 text-[11px] text-crm-muted-fg">
            {formatDistanceToNowStrict(new Date(t.updatedAt), { addSuffix: false })}
          </span>
        </div>
        <p
          className={cn(
            "mt-1 truncate text-[13px]",
            t.unread ? "font-medium text-crm-fg" : "text-crm-soft",
          )}
        >
          {t.subject}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="truncate text-xs text-crm-muted-fg">
            #{t.id} · {t.preview}
          </span>
          {replying.length > 0 ? (
            <span
              title={`${replying.join(", ")} replying`}
              className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[11px] text-crm-danger"
            >
              <PenLine className="size-3" aria-hidden />
              <span className="sr-only">{replying.join(", ")} replying</span>
            </span>
          ) : others.length > 0 ? (
            <span
              title={`${others.join(", ")} viewing`}
              className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[11px] text-crm-warning"
            >
              <Eye className="size-3" aria-hidden />
              {others.length}
              <span className="sr-only"> agents viewing</span>
            </span>
          ) : null}
          <SlaTimer
            compact
            dueAt={dueAt}
            targetMinutes={target}
            hours={hours}
            paused={paused}
            now={now}
            className={replying.length || others.length ? "" : "ml-auto"}
          />
        </div>
      </div>
    </div>
  );
});
