import * as React from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { MessageItem } from "@/components/crm/pro-chat-workspace/message-item";
import type { ChatMessage, ChatRow, ChatUser } from "@/components/crm/pro-chat-workspace/types";

const GROUP_WINDOW = 5 * 60 * 1000;
/** Virtuoso needs a stable, positive index origin so prepended history keeps scroll position. */
const INDEX_BASE = 10_000_000;

/**
 * Flattens a chronologically sorted message array into rows with day dividers and a single
 * "new messages" marker before the first unread message. O(n), memoised by the caller.
 */
export function buildChatRows(
  messages: ChatMessage[],
  currentUserId: string,
  lastReadAt?: number,
): { rows: ChatRow[]; unreadIndex: number; unreadCount: number } {
  const rows: ChatRow[] = [];
  let unreadIndex = -1;
  let unreadCount = 0;
  let prevDay = -1;
  let prev: ChatMessage | undefined;
  for (const m of messages) {
    const day = startOfDay(m.createdAt).getTime();
    if (day !== prevDay) {
      rows.push({ kind: "day", key: `day-${day}`, at: day });
      prevDay = day;
      prev = undefined;
    }
    const isUnread = lastReadAt != null && m.createdAt > lastReadAt && m.authorId !== currentUserId;
    if (isUnread) {
      unreadCount++;
      if (unreadIndex < 0) {
        unreadIndex = rows.length;
        rows.push({ kind: "unread", key: "unread", count: 0 });
        prev = undefined;
      }
    }
    const grouped =
      !!prev && prev.authorId === m.authorId && m.createdAt - prev.createdAt < GROUP_WINDOW;
    rows.push({ kind: "message", key: m.id, message: m, grouped });
    prev = m;
  }
  if (unreadIndex >= 0) rows[unreadIndex] = { kind: "unread", key: "unread", count: unreadCount };
  return { rows, unreadIndex, unreadCount };
}

function dayLabel(at: number) {
  if (isToday(at)) return "Today";
  if (isYesterday(at)) return "Yesterday";
  return format(at, "EEEE, MMMM d");
}

export interface ThreadStat {
  count: number;
  lastAt: number;
}

export interface MessageListProps {
  messages: ChatMessage[];
  users: Map<string, ChatUser>;
  currentUserId: string;
  lastReadAt?: number;
  threadStats: Map<string, ThreadStat>;
  recentEmoji: string[];
  loading?: boolean;
  hasMoreHistory?: boolean;
  onLoadOlder?: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onOpenThread?: (messageId: string) => void;
  onRetry?: (message: ChatMessage) => void;
  onReachBottom?: () => void;
  emptyState?: React.ReactNode;
  inThread?: boolean;
  label: string;
}

/**
 * Reverse (bottom-anchored) virtualised history on react-virtuoso: opens at the first unread
 * message (or the bottom), sticks to the bottom while new messages arrive, keeps position when
 * older history is prepended, and offers "jump to unread" / "jump to latest" pills.
 */
export function MessageList({
  messages,
  users,
  currentUserId,
  lastReadAt,
  threadStats,
  recentEmoji,
  loading,
  hasMoreHistory,
  onLoadOlder,
  onReact,
  onOpenThread,
  onRetry,
  onReachBottom,
  emptyState,
  inThread,
  label,
}: MessageListProps) {
  const ref = React.useRef<VirtuosoHandle>(null);
  // Freeze the read marker for the lifetime of this list so it does not jump while reading.
  const [frozenRead] = React.useState(lastReadAt);
  const { rows, unreadIndex, unreadCount } = React.useMemo(
    () => buildChatRows(messages, currentUserId, frozenRead),
    [messages, currentUserId, frozenRead],
  );
  const [atBottom, setAtBottom] = React.useState(true);
  const [unreadSeen, setUnreadSeen] = React.useState(false);

  // Track prepends: the first row key moving means older history was loaded above.
  const firstKey = React.useRef<string | undefined>(undefined);
  const prependOffset = React.useRef(0);
  const prevLen = React.useRef(0);
  if (firstKey.current !== undefined && rows[0]?.key !== firstKey.current) {
    const oldIdx = rows.findIndex((r) => r.key === firstKey.current);
    if (oldIdx > 0) prependOffset.current += oldIdx;
  } else if (firstKey.current !== undefined && rows.length < prevLen.current) {
    prependOffset.current = 0;
  }
  firstKey.current = rows[0]?.key;
  prevLen.current = rows.length;
  const firstItemIndex = INDEX_BASE - prependOffset.current;

  React.useEffect(() => {
    if (atBottom) onReachBottom?.();
  }, [atBottom, onReachBottom, messages.length]);

  if (loading && messages.length === 0) {
    return (
      <div className="grid flex-1 place-items-center text-crm-muted-fg" role="status">
        <Loader2 className="size-5 animate-spin" aria-label="Loading messages" />
      </div>
    );
  }
  if (messages.length === 0) {
    return (
      <div className="grid flex-1 place-items-center px-6 text-center text-sm text-crm-muted-fg">
        {emptyState ?? "No messages yet. Say hello."}
      </div>
    );
  }

  const start = unreadIndex >= 0 ? unreadIndex : rows.length - 1;

  return (
    <div className="relative min-h-0 flex-1">
      <Virtuoso
        ref={ref}
        role="log"
        aria-label={label}
        aria-live="polite"
        className="h-full"
        data={rows}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={{ index: start, align: unreadIndex >= 0 ? "start" : "end" }}
        computeItemKey={(_, row) => row.key}
        alignToBottom
        followOutput={(bottom) => (bottom ? "smooth" : false)}
        atBottomStateChange={setAtBottom}
        atBottomThreshold={48}
        increaseViewportBy={{ top: 400, bottom: 400 }}
        startReached={() => {
          if (hasMoreHistory && !loading) onLoadOlder?.();
        }}
        rangeChanged={(r) => {
          if (unreadIndex >= 0 && r.startIndex - firstItemIndex <= unreadIndex) setUnreadSeen(true);
        }}
        components={{
          Header: () =>
            hasMoreHistory ? (
              <div className="flex justify-center py-3 text-crm-muted-fg">
                <Loader2 className="size-4 animate-spin" aria-label="Loading older messages" />
              </div>
            ) : (
              <div className="px-4 pt-6 pb-2 text-xs text-crm-muted-fg">
                This is the very beginning of the conversation.
              </div>
            ),
          Footer: () => <div className="h-3" />,
        }}
        itemContent={(_, row) => {
          if (row.kind === "day") {
            return (
              <div role="separator" className="flex items-center gap-3 px-4 py-2">
                <span className="h-px flex-1 bg-crm-border" />
                <span className="rounded-full border border-crm-border bg-crm-card px-2.5 py-0.5 text-[11px] font-medium text-crm-soft">
                  {dayLabel(row.at)}
                </span>
                <span className="h-px flex-1 bg-crm-border" />
              </div>
            );
          }
          if (row.kind === "unread") {
            return (
              <div
                role="separator"
                aria-label={`${row.count} new messages`}
                className="flex items-center gap-2 px-4 py-1"
              >
                <span className="h-px flex-1 bg-crm-danger/70" />
                <span className="text-[11px] font-semibold text-crm-danger">New</span>
              </div>
            );
          }
          const m = row.message;
          const stat = threadStats.get(m.id);
          return (
            <MessageItem
              message={m}
              author={users.get(m.authorId)}
              currentUserId={currentUserId}
              grouped={row.grouped}
              replyCount={stat?.count}
              lastReplyAt={stat?.lastAt}
              users={users}
              recentEmoji={recentEmoji}
              onReact={onReact}
              onOpenThread={onOpenThread}
              onRetry={onRetry}
              inThread={inThread}
            />
          );
        }}
      />
      {unreadIndex >= 0 && !unreadSeen ? (
        <button
          type="button"
          onClick={() => {
            ref.current?.scrollToIndex({ index: unreadIndex, align: "start", behavior: "smooth" });
            setUnreadSeen(true);
          }}
          className="absolute top-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-crm-primary px-3 py-1 text-xs font-medium text-white shadow-crm-raised"
        >
          <ArrowUp className="size-3.5" aria-hidden /> {unreadCount} new since{" "}
          {frozenRead ? format(frozenRead, "HH:mm") : "last visit"}
        </button>
      ) : null}
      {!atBottom ? (
        <button
          type="button"
          onClick={() =>
            ref.current?.scrollToIndex({ index: rows.length - 1, align: "end", behavior: "smooth" })
          }
          className="absolute right-4 bottom-3 flex items-center gap-1.5 rounded-full border border-crm-border bg-crm-popover px-3 py-1 text-xs text-crm-fg shadow-crm-raised"
        >
          <ArrowDown className="size-3.5" aria-hidden /> Jump to latest
        </button>
      ) : null}
    </div>
  );
}
