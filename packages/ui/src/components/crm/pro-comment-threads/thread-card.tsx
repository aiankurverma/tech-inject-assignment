import * as React from "react";
import { formatDistanceToNowStrict, format } from "date-fns";
import { Check, RotateCcw, SmilePlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/pro-comment-threads/avatar";
import { MentionComposer } from "@/components/crm/pro-comment-threads/mention-composer";
import type {
  CommentThread,
  CommentUser,
  ThreadComment,
} from "@/components/crm/pro-comment-threads/types";

export interface ThreadCardProps {
  thread: CommentThread;
  users: ReadonlyMap<string, CommentUser>;
  userList: CommentUser[];
  currentUserId: string;
  active: boolean;
  detached: boolean;
  reactions: string[];
  readOnly?: boolean;
  canDelete: boolean;
  onActivate: (id: string) => void;
  onReply: (threadId: string, body: string, mentions: string[]) => void;
  onReact: (threadId: string, commentId: string, emoji: string) => void;
  onResolve: (threadId: string, resolved: boolean) => void;
  onDelete: (threadId: string, commentId: string) => void;
  onKeyNav: (e: React.KeyboardEvent, id: string) => void;
}

function CommentBody({
  comment,
  users,
}: {
  comment: ThreadComment;
  users: ReadonlyMap<string, CommentUser>;
}) {
  const names = comment.mentions.map((id) => users.get(id)?.name).filter(Boolean) as string[];
  if (!names.length) return <p className="whitespace-pre-wrap break-words">{comment.body}</p>;
  const re = new RegExp(
    `(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`,
    "g",
  );
  return (
    <p className="whitespace-pre-wrap break-words">
      {comment.body.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="rounded bg-crm-primary/20 px-0.5 font-medium text-crm-fg">
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </p>
  );
}

function ReactionBar({
  comment,
  currentUserId,
  users,
  options,
  disabled,
  onToggle,
}: {
  comment: ThreadComment;
  currentUserId: string;
  users: ReadonlyMap<string, CommentUser>;
  options: string[];
  disabled?: boolean;
  onToggle: (emoji: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {comment.reactions.map((r) => {
        const mine = r.userIds.includes(currentUserId);
        const who = r.userIds.map((id) => users.get(id)?.name ?? id).join(", ");
        return (
          <button
            key={r.emoji}
            type="button"
            disabled={disabled}
            aria-pressed={mine}
            aria-label={`${r.emoji} ${r.userIds.length}: ${who}`}
            title={who}
            onClick={() => onToggle(r.emoji)}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs",
              mine
                ? "border-crm-primary bg-crm-primary/15 text-crm-fg"
                : "border-crm-border bg-crm-raised text-crm-soft hover:border-crm-input",
            )}
          >
            <span>{r.emoji}</span>
            <span className="tabular-nums">{r.userIds.length}</span>
          </button>
        );
      })}
      {!disabled && (
        <div className="relative">
          <button
            type="button"
            aria-label="Add reaction"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-crm-subtle hover:bg-crm-muted hover:text-crm-fg"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
          {open && (
            <div
              role="menu"
              className="absolute left-0 top-7 z-20 flex gap-0.5 rounded-crm border border-crm-border bg-crm-popover p-1 shadow-crm-raised"
              onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            >
              {options.map((emoji, i) => (
                <button
                  key={emoji}
                  type="button"
                  role="menuitem"
                  autoFocus={i === 0}
                  onClick={() => {
                    onToggle(emoji);
                    setOpen(false);
                  }}
                  className="h-7 w-7 rounded-crm text-base hover:bg-crm-muted focus:bg-crm-muted focus:outline-none"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentRow({ comment, ...props }: { comment: ThreadComment } & ThreadCardProps) {
  const { users, currentUserId, readOnly, thread } = props;
  const author = users.get(comment.authorId);
  const date = new Date(comment.createdAt);
  return (
    <li className={cn("flex gap-2", comment.pending && "opacity-60")}>
      <Avatar user={author} size={24} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-xs font-semibold">{author?.name ?? "Unknown"}</span>
          <time
            dateTime={comment.createdAt}
            title={format(date, "PPpp")}
            className="shrink-0 text-[11px] text-crm-subtle"
          >
            {comment.pending ? "Sending…" : `${formatDistanceToNowStrict(date)} ago`}
          </time>
          {props.canDelete &&
            comment.authorId === currentUserId &&
            !comment.pending &&
            !readOnly && (
              <button
                type="button"
                aria-label="Delete comment"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDelete(thread.id, comment.id);
                }}
                className="ml-auto text-crm-subtle hover:text-crm-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
        </div>
        <div className="mt-0.5 text-[13px] leading-snug text-crm-chip">
          <CommentBody comment={comment} users={users} />
        </div>
        <ReactionBar
          comment={comment}
          currentUserId={currentUserId}
          users={users}
          options={props.reactions}
          disabled={readOnly || comment.pending}
          onToggle={(emoji) => props.onReact(thread.id, comment.id, emoji)}
        />
      </div>
    </li>
  );
}

function ThreadCardImpl(props: ThreadCardProps, ref: React.Ref<HTMLDivElement>) {
  const { thread, users, active, detached, readOnly } = props;
  const [first, ...replies] = thread.comments;
  const [collapsed, setCollapsed] = React.useState(true);
  const visibleReplies = !active && collapsed && replies.length > 2 ? replies.slice(-1) : replies;
  const hidden = replies.length - visibleReplies.length;

  return (
    <div
      ref={ref}
      role="article"
      tabIndex={0}
      aria-label={`Comment thread on “${thread.quote.slice(0, 60)}”${thread.resolved ? ", resolved" : ""}`}
      aria-current={active || undefined}
      data-thread-card={thread.id}
      onClick={() => props.onActivate(thread.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        props.onKeyNav(e, thread.id);
      }}
      className={cn(
        "rounded-crm border bg-crm-card p-3 text-sm text-crm-fg transition-[box-shadow,border-color,transform] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
        active
          ? "border-crm-primary shadow-crm-raised -translate-x-1"
          : "border-crm-border hover:border-crm-input",
        thread.resolved && !active && "opacity-70",
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        <blockquote
          className={cn(
            "line-clamp-2 flex-1 border-l-2 pl-2 text-xs text-crm-soft",
            detached ? "border-crm-danger" : "border-crm-warning",
          )}
        >
          {detached && <span className="mr-1 font-medium text-crm-danger">Detached ·</span>}
          {thread.quote}
        </blockquote>
        {!readOnly && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              props.onResolve(thread.id, !thread.resolved);
            }}
            aria-label={thread.resolved ? "Reopen thread" : "Resolve thread"}
            title={thread.resolved ? "Reopen" : "Resolve"}
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-crm hover:bg-crm-muted",
              thread.resolved ? "text-crm-soft" : "text-crm-success",
            )}
          >
            {thread.resolved ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          </button>
        )}
      </div>

      <ol className="flex flex-col gap-3">
        {first && <CommentRow comment={first} {...props} />}
        {hidden > 0 && (
          <li>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed(false);
              }}
              className="text-xs font-medium text-crm-primary hover:underline"
            >
              Show {hidden} more {hidden === 1 ? "reply" : "replies"}
            </button>
          </li>
        )}
        {visibleReplies.map((c) => (
          <CommentRow key={c.id} comment={c} {...props} />
        ))}
      </ol>

      {thread.resolved && thread.resolvedBy && (
        <p className="mt-2 text-xs text-crm-subtle">
          Resolved by {users.get(thread.resolvedBy)?.name ?? "someone"}
          {thread.resolvedAt && ` · ${formatDistanceToNowStrict(new Date(thread.resolvedAt))} ago`}
        </p>
      )}

      {active && !readOnly && !thread.resolved && (
        <MentionComposer
          className="mt-3"
          users={props.userList}
          autoFocus={false}
          onSubmit={(body, mentions) => props.onReply(thread.id, body, mentions)}
        />
      )}
    </div>
  );
}

export const ThreadCard = React.memo(React.forwardRef(ThreadCardImpl));
