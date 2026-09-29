import * as React from "react";
import { BellOff, Hash, Lock, PenLine, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Initials } from "@/components/crm/pro-chat-workspace/message-item";
import type { ChatChannel, ChatUser } from "@/components/crm/pro-chat-workspace/types";

export interface ChannelListProps {
  channels: ChatChannel[];
  activeId: string;
  unread: Map<string, number>;
  drafts: ReadonlySet<string>;
  /** For direct messages: channel id -> the other participant. */
  directUsers?: Map<string, ChatUser>;
  onSelect: (id: string) => void;
  title?: string;
}

const DEFAULT_GROUP: Record<NonNullable<ChatChannel["kind"]>, string> = {
  channel: "Channels",
  private: "Channels",
  direct: "Direct messages",
};

/**
 * Sectioned channel list with unread badges and draft markers. Roving tabindex keeps the list
 * a single tab stop; Up/Down/Home/End move focus, Enter/Space opens.
 */
function ChannelListImpl({
  channels,
  activeId,
  unread,
  drafts,
  directUsers,
  onSelect,
  title = "Workspace",
}: ChannelListProps) {
  const [query, setQuery] = React.useState("");
  const [focusId, setFocusId] = React.useState(activeId);
  const refs = React.useRef(new Map<string, HTMLButtonElement>());

  const groups = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = new Map<string, ChatChannel[]>();
    for (const c of channels) {
      if (q && !c.name.toLowerCase().includes(q)) continue;
      const g = c.group ?? DEFAULT_GROUP[c.kind ?? "channel"];
      const arr = out.get(g);
      if (arr) arr.push(c);
      else out.set(g, [c]);
    }
    return [...out.entries()];
  }, [channels, query]);

  const flat = React.useMemo(() => groups.flatMap(([, list]) => list.map((c) => c.id)), [groups]);
  const tabStop = flat.includes(focusId) ? focusId : flat.includes(activeId) ? activeId : flat[0];

  const move = (to: number) => {
    const id = flat[Math.max(0, Math.min(flat.length - 1, to))];
    if (!id) return;
    setFocusId(id);
    refs.current.get(id)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = flat.indexOf(tabStop ?? "");
    if (e.key === "ArrowDown") move(i + 1);
    else if (e.key === "ArrowUp") move(i - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(flat.length - 1);
    else return;
    e.preventDefault();
  };

  const totalUnread = React.useMemo(() => {
    let n = 0;
    for (const c of channels) if (!c.muted) n += unread.get(c.id) ?? 0;
    return n;
  }, [channels, unread]);

  return (
    <nav aria-label="Conversations" className="flex h-full min-h-0 flex-col bg-crm-sidebar">
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <span className="truncate text-sm font-semibold text-crm-fg">{title}</span>
        {totalUnread > 0 ? (
          <span className="rounded-full bg-crm-primary px-1.5 text-[11px] font-semibold text-white tabular-nums">
            {totalUnread > 999 ? "999+" : totalUnread}
          </span>
        ) : null}
      </div>
      <label className="mx-3 mb-2 flex h-8 items-center gap-2 rounded-crm border border-crm-border bg-crm-card px-2 text-crm-muted-fg focus-within:border-crm-primary">
        <Search className="size-3.5" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a conversation"
          aria-label="Find a conversation"
          className="min-w-0 flex-1 bg-transparent text-xs text-crm-fg outline-none placeholder:text-crm-muted-fg"
        />
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3" onKeyDown={onKeyDown}>
        {groups.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-crm-muted-fg">No conversations match.</p>
        ) : null}
        {groups.map(([group, list]) => (
          <div key={group} role="group" aria-label={group} className="mt-1">
            <div className="px-4 py-1 text-[11px] font-medium tracking-wide text-crm-muted-fg uppercase">
              {group}
            </div>
            <ul>
              {list.map((c) => {
                const count = unread.get(c.id) ?? 0;
                const active = c.id === activeId;
                const bold = count > 0 && !c.muted;
                const dmUser = c.kind === "direct" ? directUsers?.get(c.id) : undefined;
                return (
                  <li key={c.id}>
                    <button
                      ref={(el) => {
                        if (el) refs.current.set(c.id, el);
                        else refs.current.delete(c.id);
                      }}
                      type="button"
                      tabIndex={c.id === tabStop ? 0 : -1}
                      aria-current={active ? "page" : undefined}
                      aria-label={`${c.name}${count ? `, ${count} unread` : ""}${drafts.has(c.id) ? ", draft" : ""}`}
                      onFocus={() => setFocusId(c.id)}
                      onClick={() => onSelect(c.id)}
                      className={cn(
                        "mx-2 flex h-8 w-[calc(100%-1rem)] items-center gap-2 rounded-crm px-2 text-left text-sm outline-none",
                        "focus-visible:ring-2 focus-visible:ring-crm-primary",
                        active
                          ? "bg-crm-primary/20 text-crm-fg"
                          : "text-crm-soft hover:bg-crm-muted hover:text-crm-fg",
                        bold && "font-semibold text-crm-fg",
                        c.muted && "opacity-60",
                      )}
                    >
                      {c.kind === "direct" ? (
                        <span className="relative">
                          <Initials
                            user={dmUser ?? { id: c.id, name: c.name }}
                            className="size-5 text-[9px]"
                          />
                          {dmUser?.online ? (
                            <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full border border-crm-sidebar bg-crm-success" />
                          ) : null}
                        </span>
                      ) : c.kind === "private" ? (
                        <Lock className="size-3.5 shrink-0 text-crm-icon" aria-hidden />
                      ) : (
                        <Hash className="size-3.5 shrink-0 text-crm-icon" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      {drafts.has(c.id) && !active ? (
                        <PenLine className="size-3.5 shrink-0 text-crm-muted-fg" aria-hidden />
                      ) : null}
                      {c.muted ? (
                        <BellOff className="size-3 shrink-0 text-crm-muted-fg" aria-hidden />
                      ) : null}
                      {count > 0 ? (
                        <span
                          aria-hidden
                          className={cn(
                            "min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums",
                            c.muted ? "bg-crm-muted text-crm-soft" : "bg-crm-primary text-white",
                          )}
                        >
                          {count > 99 ? "99+" : count}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

export const ChannelList = React.memo(ChannelListImpl);
