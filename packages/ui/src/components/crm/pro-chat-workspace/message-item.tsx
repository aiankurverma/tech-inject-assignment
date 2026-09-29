import * as React from "react";
import { format } from "date-fns";
import { AlertCircle, FileText, MessageSquareReply, SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/crm/pro-chat-workspace/emoji-picker";
import type { ChatMessage, ChatUser } from "@/components/crm/pro-chat-workspace/types";

export interface MessageItemProps {
  message: ChatMessage;
  author?: ChatUser;
  currentUserId: string;
  /** Consecutive message from the same author within a few minutes: hide avatar + name. */
  grouped: boolean;
  replyCount?: number;
  lastReplyAt?: number;
  users: Map<string, ChatUser>;
  recentEmoji: string[];
  onReact?: (messageId: string, emoji: string) => void;
  onOpenThread?: (messageId: string) => void;
  onRetry?: (message: ChatMessage) => void;
  /** Hide the thread affordance (inside the thread panel). */
  inThread?: boolean;
}

/** Styles for composer HTML (mentions, code, lists, quotes) without a global stylesheet. */
export const CHAT_PROSE =
  "[&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_a]:text-[#8b7bff] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-crm-input [&_blockquote]:pl-3 [&_blockquote]:text-crm-soft [&_code]:rounded [&_code]:bg-crm-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px] [&_pre]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded-crm [&_pre]:bg-crm-bg [&_pre]:p-2 [&_[data-type=mention]]:rounded [&_[data-type=mention]]:bg-crm-primary/25 [&_[data-type=mention]]:px-0.5 [&_[data-type=mention]]:font-medium [&_[data-type=mention]]:text-[#b7aee9]";

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function Initials({ user, className }: { user?: ChatUser; className?: string }) {
  const name = user?.name ?? "?";
  const letters = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return user?.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt=""
      className={cn("size-8 rounded-full object-cover", className)}
    />
  ) : (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-crm-muted text-xs font-semibold text-crm-chip",
        className,
      )}
    >
      {letters}
    </span>
  );
}

function MessageItemImpl({
  message,
  author,
  currentUserId,
  grouped,
  replyCount = 0,
  lastReplyAt,
  users,
  recentEmoji,
  onReact,
  onOpenThread,
  onRetry,
  inThread,
}: MessageItemProps) {
  const reactions = Object.entries(message.reactions ?? {}).filter(([, ids]) => ids.length > 0);
  const time = format(message.createdAt, "HH:mm");

  return (
    <article
      aria-label={`${author?.name ?? "Unknown"} at ${time}`}
      className={cn(
        "group relative flex gap-3 px-4 hover:bg-crm-raised/60 focus-within:bg-crm-raised/60",
        grouped ? "py-0.5" : "pt-2 pb-0.5",
        message.status === "sending" && "opacity-60",
      )}
    >
      <div className="w-8 shrink-0">
        {grouped ? (
          <time
            dateTime={new Date(message.createdAt).toISOString()}
            className="invisible block pt-0.5 text-right text-[10px] text-crm-subtle group-hover:visible"
          >
            {time}
          </time>
        ) : (
          <Initials user={author} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {grouped ? null : (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-crm-fg">{author?.name ?? "Unknown"}</span>
            <time
              dateTime={new Date(message.createdAt).toISOString()}
              className="text-[11px] text-crm-muted-fg"
            >
              {time}
            </time>
          </div>
        )}
        {message.html ? (
          <div
            className={cn(CHAT_PROSE, "text-sm leading-relaxed break-words text-crm-chip")}
            dangerouslySetInnerHTML={{ __html: message.html }}
          />
        ) : (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-crm-chip">
            {message.text}
            {message.edited ? (
              <span className="ml-1 text-[11px] text-crm-subtle">(edited)</span>
            ) : null}
          </p>
        )}

        {message.attachments?.length ? (
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {message.attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-crm border border-crm-border bg-crm-card px-2.5 py-1.5 text-xs"
              >
                <FileText className="size-4 text-crm-icon" aria-hidden />
                <span className="max-w-48 truncate text-crm-fg">{a.name}</span>
                <span className="text-crm-muted-fg">{formatBytes(a.size)}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {message.status === "failed" ? (
          <button
            type="button"
            onClick={() => onRetry?.(message)}
            className="mt-1 flex items-center gap-1 text-xs text-crm-danger hover:underline"
          >
            <AlertCircle className="size-3.5" aria-hidden /> Not delivered. Retry
          </button>
        ) : null}

        {reactions.length ? (
          <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Reactions">
            {reactions.map(([emoji, ids]) => {
              const mine = ids.includes(currentUserId);
              const names = ids.map((id) => users.get(id)?.name ?? "someone").join(", ");
              return (
                <button
                  key={emoji}
                  type="button"
                  aria-pressed={mine}
                  title={names}
                  aria-label={`${emoji} ${ids.length}, reacted by ${names}`}
                  onClick={() => onReact?.(message.id, emoji)}
                  className={cn(
                    "flex h-6 items-center gap-1 rounded-full border px-2 text-xs",
                    mine
                      ? "border-crm-primary bg-crm-primary/20 text-crm-fg"
                      : "border-crm-border bg-crm-card text-crm-soft hover:border-crm-input",
                  )}
                >
                  <span>{emoji}</span>
                  <span className="tabular-nums">{ids.length}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {!inThread && replyCount > 0 ? (
          <button
            type="button"
            onClick={() => onOpenThread?.(message.id)}
            className="mt-1 flex items-center gap-2 rounded-crm px-1 py-0.5 text-xs text-crm-soft hover:bg-crm-muted"
          >
            <span className="font-medium text-[#8b7bff]">
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </span>
            {lastReplyAt ? (
              <span className="text-crm-muted-fg">
                Last reply {format(lastReplyAt, "MMM d, HH:mm")}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      <div
        className={cn(
          "absolute -top-3 right-4 hidden items-center gap-0.5 rounded-crm border border-crm-border bg-crm-popover p-0.5 shadow-crm-raised",
          "group-hover:flex group-focus-within:flex",
        )}
      >
        <EmojiPicker
          onPick={(e) => onReact?.(message.id, e)}
          recent={recentEmoji}
          label="Add reaction"
        >
          {(props) => (
            <button
              {...props}
              type="button"
              aria-label="Add reaction"
              className="grid size-7 place-items-center rounded-md text-crm-icon hover:bg-crm-muted"
            >
              <SmilePlus className="size-4" />
            </button>
          )}
        </EmojiPicker>
        {inThread ? null : (
          <button
            type="button"
            aria-label="Reply in thread"
            onClick={() => onOpenThread?.(message.id)}
            className="grid size-7 place-items-center rounded-md text-crm-icon hover:bg-crm-muted"
          >
            <MessageSquareReply className="size-4" />
          </button>
        )}
      </div>
    </article>
  );
}

export const MessageItem = React.memo(MessageItemImpl);
