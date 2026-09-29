import * as React from "react";
import { Hash, Lock, MessagesSquare, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChannelList } from "@/components/crm/pro-chat-workspace/channel-list";
import { Composer } from "@/components/crm/pro-chat-workspace/composer";
import { MessageItem } from "@/components/crm/pro-chat-workspace/message-item";
import { MessageList, type ThreadStat } from "@/components/crm/pro-chat-workspace/message-list";
import type {
  ChatChannel,
  ChatMessage,
  ChatSendPayload,
  ChatUser,
} from "@/components/crm/pro-chat-workspace/types";
import { useChatDrafts, type ChatDraft } from "@/hooks/use-chat-drafts";

export type {
  ChatChannel,
  ChatMessage,
  ChatSendPayload,
  ChatUser,
  ChatAttachmentMeta,
} from "@/components/crm/pro-chat-workspace/types";

export interface ProChatWorkspaceProps {
  channels: ChatChannel[];
  users: ChatUser[];
  currentUserId: string;
  /** Controlled message store (all channels, any order). */
  messages?: ChatMessage[];
  /** Uncontrolled initial messages. */
  defaultMessages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
  /** Controlled active channel. */
  activeChannelId?: string;
  defaultChannelId?: string;
  onActiveChannelChange?: (id: string) => void;
  /**
   * Persist a message. Resolve with the stored message (server id, attachment urls) to replace
   * the optimistic one; reject to mark it failed with a retry affordance.
   */
  onSend?: (payload: ChatSendPayload) => Promise<ChatMessage | void> | void;
  onReact?: (messageId: string, emoji: string, added: boolean) => void;
  /** Called when a channel is read to the bottom. */
  onMarkRead?: (channelId: string, at: number) => void;
  /** Older history paging for the active channel. */
  hasMoreHistory?: (channelId: string) => boolean;
  onLoadOlder?: (channelId: string) => void;
  loading?: boolean;
  initialDrafts?: Record<string, ChatDraft>;
  workspaceName?: string;
  className?: string;
}

function useControllable<T>(value: T | undefined, initial: T, onChange?: (v: T) => void) {
  const [inner, setInner] = React.useState(initial);
  const current = value !== undefined ? value : inner;
  const ref = React.useRef(current);
  React.useEffect(() => {
    ref.current = current;
  }, [current]);
  const set = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(ref.current) : next;
      ref.current = v;
      setInner(v);
      onChange?.(v);
    },
    [onChange],
  );
  return [current, set] as const;
}

let tempSeq = 0;

/**
 * Slack-style in-product chat: channel list with unread counts and drafts, reverse-virtualised
 * history with day dividers and jump-to-unread, a threads side panel, reactions, and a Tiptap
 * composer with mentions, emoji and attachments. Handles 10k+ messages per channel.
 */
export function ProChatWorkspace({
  channels,
  users,
  currentUserId,
  messages: messagesProp,
  defaultMessages = [],
  onMessagesChange,
  activeChannelId,
  defaultChannelId,
  onActiveChannelChange,
  onSend,
  onReact,
  onMarkRead,
  hasMoreHistory,
  onLoadOlder,
  loading,
  initialDrafts,
  workspaceName,
  className,
}: ProChatWorkspaceProps) {
  const [messages, setMessages] = useControllable(messagesProp, defaultMessages, onMessagesChange);
  const [active, setActive] = useControllable(
    activeChannelId,
    defaultChannelId ?? channels[0]?.id ?? "",
    onActiveChannelChange,
  );
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [readAt, setReadAt] = React.useState<Map<string, number>>(
    () => new Map(channels.map((c) => [c.id, c.lastReadAt ?? 0])),
  );
  const [recentEmoji, setRecentEmoji] = React.useState<string[]>(["👍", "🎉", "👀", "✅", "🙏"]);
  const drafts = useChatDrafts(initialDrafts);

  const userMap = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const channel = channels.find((c) => c.id === active);

  // Single O(n) pass: roots per channel (sorted), replies per thread, thread stats.
  const index = React.useMemo(() => {
    const roots = new Map<string, ChatMessage[]>();
    const replies = new Map<string, ChatMessage[]>();
    const byId = new Map<string, ChatMessage>();
    for (const m of messages) {
      byId.set(m.id, m);
      const bucket = m.threadId ? replies : roots;
      const key = m.threadId ?? m.channelId;
      const arr = bucket.get(key);
      if (arr) arr.push(m);
      else bucket.set(key, [m]);
    }
    const byTime = (a: ChatMessage, b: ChatMessage) => a.createdAt - b.createdAt;
    const stats = new Map<string, ThreadStat>();
    for (const [k, arr] of roots) roots.set(k, arr.sort(byTime));
    for (const [k, arr] of replies) {
      arr.sort(byTime);
      stats.set(k, { count: arr.length, lastAt: arr[arr.length - 1]!.createdAt });
    }
    return { roots, replies, byId, stats };
  }, [messages]);

  const unread = React.useMemo(() => {
    const out = new Map<string, number>();
    for (const c of channels) {
      const since = readAt.get(c.id) ?? 0;
      const list = index.roots.get(c.id) ?? [];
      let n = 0;
      // Walk backwards: stops at the first read message, so cost is O(unread).
      for (let i = list.length - 1; i >= 0 && list[i]!.createdAt > since; i--)
        if (list[i]!.authorId !== currentUserId) n++;
      if (n) out.set(c.id, n);
    }
    return out;
  }, [channels, index, readAt, currentUserId]);

  const directUsers = React.useMemo(() => {
    const out = new Map<string, ChatUser>();
    for (const c of channels) {
      if (c.kind !== "direct") continue;
      const u = users.find((x) => x.name === c.name);
      if (u) out.set(c.id, u);
    }
    return out;
  }, [channels, users]);

  const markRead = React.useCallback(() => {
    const list = index.roots.get(active);
    const last = list?.[list.length - 1]?.createdAt ?? 0;
    if (!last) return;
    setReadAt((prev) => {
      if ((prev.get(active) ?? 0) >= last) return prev;
      const next = new Map(prev);
      next.set(active, last);
      onMarkRead?.(active, last);
      return next;
    });
  }, [active, index, onMarkRead]);

  const selectChannel = React.useCallback(
    (id: string) => {
      setActive(id);
      setThreadId(null);
    },
    [setActive],
  );

  const react = React.useCallback(
    (messageId: string, emoji: string) => {
      let added = false;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const ids = m.reactions?.[emoji] ?? [];
          added = !ids.includes(currentUserId);
          const nextIds = added ? [...ids, currentUserId] : ids.filter((x) => x !== currentUserId);
          return { ...m, reactions: { ...m.reactions, [emoji]: nextIds } };
        }),
      );
      setRecentEmoji((r) => [emoji, ...r.filter((x) => x !== emoji)].slice(0, 8));
      onReact?.(messageId, emoji, added);
    },
    [setMessages, currentUserId, onReact],
  );

  const deliver = React.useCallback(
    (optimistic: ChatMessage, payload: ChatSendPayload) => {
      const replace = (patch: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? patch(m) : m)));
      try {
        const res = onSend?.(payload);
        if (res && typeof (res as Promise<unknown>).then === "function") {
          (res as Promise<ChatMessage | void>).then(
            (saved) => replace((m) => (saved ? saved : { ...m, status: undefined })),
            () => replace((m) => ({ ...m, status: "failed" })),
          );
        } else replace((m) => ({ ...m, status: undefined }));
      } catch {
        replace((m) => ({ ...m, status: "failed" }));
      }
    },
    [onSend, setMessages],
  );

  const pendingPayloads = React.useRef(new Map<string, ChatSendPayload>());

  const send = React.useCallback(
    (threadParent: string | undefined) => (p: Omit<ChatSendPayload, "channelId" | "threadId">) => {
      const payload: ChatSendPayload = { ...p, channelId: active, threadId: threadParent };
      const optimistic: ChatMessage = {
        id: `tmp-${Date.now()}-${++tempSeq}`,
        channelId: active,
        authorId: currentUserId,
        createdAt: Date.now(),
        text: p.text,
        html: p.html,
        threadId: threadParent,
        status: "sending",
        attachments: p.files.map((f, i) => ({
          id: `${f.name}-${i}`,
          name: f.name,
          size: f.size,
          type: f.type,
        })),
      };
      pendingPayloads.current.set(optimistic.id, payload);
      setMessages((prev) => [...prev, optimistic]);
      deliver(optimistic, payload);
    },
    [active, currentUserId, deliver, setMessages],
  );
  const sendRoot = React.useMemo(() => send(undefined), [send]);
  const sendReply = React.useMemo(() => send(threadId ?? undefined), [send, threadId]);

  const retry = React.useCallback(
    (m: ChatMessage) => {
      const payload = pendingPayloads.current.get(m.id);
      if (!payload) return;
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: "sending" } : x)));
      deliver(m, payload);
    },
    [deliver, setMessages],
  );

  const onEmojiUsed = React.useCallback(
    (e: string) => setRecentEmoji((r) => [e, ...r.filter((x) => x !== e)].slice(0, 8)),
    [],
  );

  const rootMessages = React.useMemo(() => index.roots.get(active) ?? [], [index, active]);
  const threadParent = threadId ? index.byId.get(threadId) : undefined;
  const threadReplies = React.useMemo(
    () => (threadId ? (index.replies.get(threadId) ?? []) : []),
    [index, threadId],
  );
  const emptyStats = React.useMemo(() => new Map<string, ThreadStat>(), []);
  const members = React.useMemo(() => users.filter((u) => u.online).length, [users]);

  if (!channels.length) {
    return (
      <div
        className={cn(
          "grid h-[640px] place-items-center rounded-crm border border-crm-border bg-crm-bg text-sm text-crm-muted-fg",
          className,
        )}
      >
        No conversations yet.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-[640px] min-h-0 overflow-hidden rounded-crm border border-crm-border bg-crm-bg text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <div className="hidden w-60 shrink-0 border-r border-crm-border md:block">
        <ChannelList
          channels={channels}
          activeId={active}
          unread={unread}
          drafts={drafts.keys}
          directUsers={directUsers}
          onSelect={selectChannel}
          title={workspaceName}
        />
      </div>

      <section
        aria-label={channel?.name ?? "Conversation"}
        className="flex min-w-0 flex-1 flex-col"
      >
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-crm-border px-4">
          {channel?.kind === "private" ? (
            <Lock className="size-4 text-crm-icon" aria-hidden />
          ) : channel?.kind === "direct" ? null : (
            <Hash className="size-4 text-crm-icon" aria-hidden />
          )}
          <h2 className="truncate text-sm font-semibold">{channel?.name}</h2>
          {channel?.topic ? (
            <span className="hidden truncate border-l border-crm-border pl-2 text-xs text-crm-muted-fg sm:inline">
              {channel.topic}
            </span>
          ) : null}
          <select
            aria-label="Switch conversation"
            value={active}
            onChange={(e) => selectChannel(e.target.value)}
            className="ml-auto h-7 rounded-crm border border-crm-border bg-crm-card px-2 text-xs md:hidden"
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {unread.get(c.id) ? ` (${unread.get(c.id)})` : ""}
              </option>
            ))}
          </select>
          <span className="ml-auto hidden items-center gap-1 text-xs text-crm-muted-fg md:flex">
            <Users className="size-3.5" aria-hidden /> {members} online
          </span>
        </header>
        <MessageList
          key={active}
          label={`Messages in ${channel?.name ?? "conversation"}`}
          messages={rootMessages}
          users={userMap}
          currentUserId={currentUserId}
          lastReadAt={readAt.get(active)}
          threadStats={index.stats}
          recentEmoji={recentEmoji}
          loading={loading}
          hasMoreHistory={hasMoreHistory?.(active)}
          onLoadOlder={onLoadOlder ? () => onLoadOlder(active) : undefined}
          onReact={react}
          onOpenThread={setThreadId}
          onRetry={retry}
          onReachBottom={markRead}
        />
        <Composer
          draftKey={active}
          getDraft={drafts.get}
          setDraft={drafts.set}
          users={users}
          currentUserId={currentUserId}
          placeholder={`Message ${channel?.kind === "direct" ? "" : "#"}${channel?.name ?? ""}`}
          recentEmoji={recentEmoji}
          onEmojiUsed={onEmojiUsed}
          onSend={sendRoot}
        />
      </section>

      {threadParent ? (
        <aside
          aria-label="Thread"
          className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-crm-border bg-crm-bg lg:static lg:w-80"
        >
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-crm-border px-4">
            <MessagesSquare className="size-4 text-crm-icon" aria-hidden />
            <h3 className="text-sm font-semibold">Thread</h3>
            <span className="truncate text-xs text-crm-muted-fg">#{channel?.name}</span>
            <button
              type="button"
              aria-label="Close thread"
              onClick={() => setThreadId(null)}
              className="ml-auto grid size-7 place-items-center rounded-md text-crm-icon hover:bg-crm-muted"
            >
              <X className="size-4" />
            </button>
          </header>
          <div className="border-b border-crm-border py-2">
            <MessageItem
              message={threadParent}
              author={userMap.get(threadParent.authorId)}
              currentUserId={currentUserId}
              grouped={false}
              users={userMap}
              recentEmoji={recentEmoji}
              onReact={react}
              inThread
            />
            <div className="px-4 pt-1 text-[11px] text-crm-muted-fg">
              {threadReplies.length} {threadReplies.length === 1 ? "reply" : "replies"}
            </div>
          </div>
          <MessageList
            key={threadParent.id}
            label="Thread replies"
            messages={threadReplies}
            users={userMap}
            currentUserId={currentUserId}
            threadStats={emptyStats}
            recentEmoji={recentEmoji}
            onReact={react}
            onRetry={retry}
            inThread
            emptyState="No replies yet. Start the thread."
          />
          <Composer
            compact
            draftKey={`thread:${threadParent.id}`}
            getDraft={drafts.get}
            setDraft={drafts.set}
            users={users}
            currentUserId={currentUserId}
            placeholder="Reply in thread"
            recentEmoji={recentEmoji}
            onEmojiUsed={onEmojiUsed}
            onSend={sendReply}
          />
        </aside>
      ) : null}
    </div>
  );
}
