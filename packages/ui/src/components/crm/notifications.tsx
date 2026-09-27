import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { CountBadge } from "@/components/crm/badge";

export interface Notification {
  id: string;
  actor?: { name: string; avatar?: string };
  /** Plain text after the actor's name, e.g. "moved LVMH to Renewal". */
  text: string;
  quote?: string;
  time: string;
  context?: string;
  icon?: React.ReactNode;
  unread?: boolean;
}

/** One notification row: avatar/icon, bold actor, optional quoted message, time and context, unread dot. */
export function NotificationItem({ n }: { n: Notification }) {
  return (
    <div className="relative flex gap-3 rounded-crm px-2 py-3 font-crm hover:bg-crm-card">
      <span className="mt-0.5 shrink-0">
        {n.actor ? (
          <Avatar name={n.actor.name} src={n.actor.avatar} size="md" />
        ) : (
          <span className="grid size-8 place-items-center rounded-crm bg-crm-muted [&_svg]:size-4">
            {n.icon}
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1 pr-4">
        <p className="text-sm text-crm-soft">
          {n.actor ? <span className="font-medium text-crm-fg">{n.actor.name} </span> : null}
          {n.text}
        </p>
        {n.quote ? (
          <p className="mt-2 rounded-crm border border-crm-input/60 bg-crm-raised px-3 py-2 text-sm text-crm-fg">
            {n.quote}
          </p>
        ) : null}
        <p className="mt-1.5 text-xs text-crm-subtle">
          {n.time}
          {n.context ? ` · ${n.context}` : ""}
        </p>
      </div>
      {n.unread ? (
        <span
          className="absolute top-4 right-2 size-1.5 rounded-full bg-crm-danger"
          aria-label="Unread"
        />
      ) : null}
    </div>
  );
}

export interface NotificationsPopoverProps {
  items: Notification[];
  trigger: React.ReactNode;
  onMarkAllRead?: () => void;
  /** Open on first render (demos, onboarding). */
  defaultOpen?: boolean;
}

/** Popover with All / Unread filter and "Mark all as read". */
export function NotificationsPopover({
  items,
  trigger,
  onMarkAllRead,
  defaultOpen,
}: NotificationsPopoverProps) {
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const unread = items.filter((i) => i.unread).length;
  const shown = filter === "all" ? items : items.filter((i) => i.unread);
  const tab = (id: "all" | "unread", label: string) => (
    <button
      type="button"
      aria-pressed={filter === id}
      onClick={() => setFilter(id)}
      className={cn(
        "crm-caption -mb-px cursor-pointer border-b py-3 outline-none focus-visible:text-crm-fg",
        filter === id
          ? "border-crm-fg text-crm-fg"
          : "border-transparent text-crm-subtle hover:text-crm-soft",
      )}
    >
      {label}
    </button>
  );
  return (
    <Popover.Root defaultOpen={defaultOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(400px,calc(100vw-2rem))] rounded-xl border border-crm-border bg-crm-sidebar font-crm text-crm-fg shadow-crm-overlay outline-none data-[state=open]:animate-crm-in"
        >
          <div className="flex items-center justify-between px-4 pt-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              Notifications <CountBadge>{unread}</CountBadge>
            </h2>
            <button
              type="button"
              onClick={onMarkAllRead}
              className="rounded text-xs text-crm-subtle hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:outline-none"
            >
              Mark all as read
            </button>
          </div>
          <div className="mt-2 flex gap-4 border-b border-crm-border px-4">
            {tab("all", "All")}
            {tab("unread", "Unread")}
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {shown.length ? (
              shown.map((n) => <NotificationItem key={n.id} n={n} />)
            ) : (
              <p className="py-10 text-center text-sm text-crm-subtle">You're all caught up.</p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
