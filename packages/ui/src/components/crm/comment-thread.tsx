import * as React from "react";
import { Check, CornerDownRight, MoreHorizontal, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { CommentBox, type Mentionable } from "@/components/crm/comment-box";
import { RelativeTime } from "@/components/crm/relative-time";

export interface ThreadComment {
  id: string;
  author: { id: string; name: string; avatar?: string };
  body: string;
  createdAt: Date | string;
  editedAt?: Date | string;
  replies?: ThreadComment[];
  resolved?: boolean;
  /** Optimistic comment still being saved, or one that failed. */
  pending?: "saving" | "failed";
}

export interface CommentThreadProps {
  comments: ThreadComment[];
  currentUser: { id: string; name: string; avatar?: string };
  mentionables?: Mentionable[];
  /** parentId is null for a new top-level comment. */
  onAdd: (body: string, parentId: string | null, mentions: Mentionable[]) => void | Promise<void>;
  onEdit?: (id: string, body: string) => void | Promise<void>;
  onDelete?: (id: string) => void;
  onResolve?: (id: string, resolved: boolean) => void;
  onRetry?: (id: string) => void;
  /** Replies shown before "Show N more replies". */
  visibleReplies?: number;
  /** Hide resolved threads behind a toggle. */
  collapseResolved?: boolean;
  className?: string;
}

function Body({ text, names }: { text: string; names: string[] }) {
  if (!names.length) return <>{text}</>;
  const esc = [...names]
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const parts = text.split(new RegExp(`(@(?:${esc}))`, "g"));
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("@") && names.includes(p.slice(1)) ? (
          <span key={i} className="rounded bg-crm-primary/15 px-0.5 text-tag-purple-text">
            {p}
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

/**
 * Threaded discussion for a record: top-level comments with one level of replies, @mention
 * highlighting, inline edit/delete of your own comments, resolve/reopen per thread, "show more
 * replies", optimistic saving/failed states and a composer that reuses CommentBox.
 */
export function CommentThread({
  comments,
  currentUser,
  mentionables = [],
  onAdd,
  onEdit,
  onDelete,
  onResolve,
  onRetry,
  visibleReplies = 2,
  collapseResolved = true,
  className,
}: CommentThreadProps) {
  const [replyTo, setReplyTo] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<{ id: string; text: string } | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [showResolved, setShowResolved] = React.useState(!collapseResolved);
  const [menu, setMenu] = React.useState<string | null>(null);
  const names = mentionables.map((m) => m.name);
  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const resolvedCount = sorted.filter((c) => c.resolved).length;
  const visible = showResolved ? sorted : sorted.filter((c) => !c.resolved);

  const saveEdit = async () => {
    if (!editing || !onEdit) return;
    const t = editing.text.trim();
    if (t) await onEdit(editing.id, t);
    setEditing(null);
  };

  const renderComment = (c: ThreadComment, parent: ThreadComment | null) => {
    const mine = c.author.id === currentUser.id;
    const isEditing = editing?.id === c.id;
    return (
      <div className={cn("group flex gap-2.5", c.pending === "saving" && "opacity-60")}>
        <Avatar
          name={c.author.name}
          src={c.author.avatar}
          size={parent ? "sm" : "md"}
          className={parent ? "mt-0.5 size-6" : undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-medium text-crm-fg">{c.author.name}</span>
            <RelativeTime date={c.createdAt} format="short" className="text-crm-muted-fg" />
            {c.editedAt ? <span className="text-crm-muted-fg">(edited)</span> : null}
            {c.pending === "saving" ? <span className="text-crm-muted-fg">Saving…</span> : null}
            {mine && !c.pending && (onEdit || onDelete) ? (
              <span className="relative ml-auto">
                <button
                  type="button"
                  aria-label="Comment actions"
                  aria-haspopup="menu"
                  aria-expanded={menu === c.id}
                  onClick={() => setMenu(menu === c.id ? null : c.id)}
                  className="grid size-6 cursor-pointer place-items-center rounded-full text-crm-muted-fg opacity-100 outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                >
                  <MoreHorizontal className="size-3.5" aria-hidden />
                </button>
                {menu === c.id ? (
                  <span
                    role="menu"
                    onKeyDown={(e) => e.key === "Escape" && setMenu(null)}
                    className="absolute top-full right-0 z-20 mt-1 flex w-28 flex-col rounded-xl border border-crm-border bg-crm-popover p-1 shadow-crm-overlay"
                  >
                    {onEdit ? (
                      <button
                        type="button"
                        role="menuitem"
                        autoFocus
                        onClick={() => {
                          setEditing({ id: c.id, text: c.body });
                          setMenu(null);
                        }}
                        className="cursor-pointer rounded-lg px-2 py-1 text-left text-xs text-crm-chip outline-none hover:bg-crm-muted focus-visible:bg-crm-muted"
                      >
                        Edit
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onDelete(c.id);
                          setMenu(null);
                        }}
                        className="cursor-pointer rounded-lg px-2 py-1 text-left text-xs text-crm-danger outline-none hover:bg-crm-danger/15 focus-visible:bg-crm-danger/15"
                      >
                        Delete
                      </button>
                    ) : null}
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
          {isEditing ? (
            <div className="mt-1">
              <textarea
                autoFocus
                aria-label="Edit comment"
                value={editing.text}
                onChange={(e) => setEditing({ id: c.id, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(null);
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void saveEdit();
                }}
                className="block min-h-[56px] w-full resize-none rounded-crm border border-crm-input/60 bg-crm-raised px-2.5 py-2 text-sm text-crm-fg outline-none focus:border-crm-ring"
              />
              <div className="mt-1 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  className="h-6 cursor-pointer rounded-full bg-crm-primary px-2.5 text-xs text-crm-primary-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="h-6 cursor-pointer rounded-full px-2 text-xs text-crm-muted-fg hover:text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-crm-chip">
              <Body text={c.body} names={names} />
            </p>
          )}
          {c.pending === "failed" ? (
            <p role="alert" className="mt-1 text-xs text-crm-danger">
              Couldn’t post.{" "}
              {onRetry ? (
                <button
                  type="button"
                  onClick={() => onRetry(c.id)}
                  className="cursor-pointer rounded underline outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                >
                  Retry
                </button>
              ) : null}
            </p>
          ) : null}
          {!parent && !c.pending && !isEditing ? (
            <div className="mt-1 flex items-center gap-3 text-xs">
              {!c.resolved ? (
                <button
                  type="button"
                  onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                  className="cursor-pointer rounded text-crm-muted-fg hover:text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                >
                  Reply
                </button>
              ) : null}
              {onResolve ? (
                <button
                  type="button"
                  onClick={() => onResolve(c.id, !c.resolved)}
                  className="flex cursor-pointer items-center gap-1 rounded text-crm-muted-fg hover:text-crm-fg [&_svg]:size-3 outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                >
                  {c.resolved ? <RotateCcw aria-hidden /> : <Check aria-hidden />}
                  {c.resolved ? "Reopen" : "Resolve"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <section className={cn("flex flex-col gap-4 font-crm", className)} aria-label="Comments">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-crm-fg">
          Comments{" "}
          <span className="text-crm-muted-fg">
            {sorted.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0)}
          </span>
        </h3>
        {resolvedCount ? (
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="cursor-pointer rounded text-xs text-crm-muted-fg hover:text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            {showResolved ? "Hide" : "Show"} {resolvedCount} resolved
          </button>
        ) : null}
      </div>
      {visible.length === 0 ? (
        <p className="rounded-crm border border-dashed border-crm-border py-6 text-center text-sm text-crm-muted-fg">
          {sorted.length
            ? "All threads are resolved."
            : "No comments yet. Start the conversation below."}
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {visible.map((c) => {
            const replies = c.replies ?? [];
            const open = expanded.has(c.id);
            const shown = open ? replies : replies.slice(-visibleReplies);
            const hiddenCount = replies.length - shown.length;
            return (
              <li
                key={c.id}
                className={cn(
                  "rounded-crm border border-crm-border bg-crm-card p-3",
                  c.resolved && "border-dashed bg-transparent",
                )}
              >
                {c.resolved ? (
                  <p className="mb-2 flex items-center gap-1 text-[11px] text-crm-success">
                    <Check className="size-3" aria-hidden /> Resolved
                  </p>
                ) : null}
                {renderComment(c, null)}
                {replies.length ? (
                  <ol className="mt-3 flex flex-col gap-3 border-l border-crm-border pl-3 sm:ml-4">
                    {hiddenCount > 0 ? (
                      <li>
                        <button
                          type="button"
                          onClick={() => setExpanded((s) => new Set(s).add(c.id))}
                          className="flex cursor-pointer items-center gap-1 rounded text-xs text-crm-soft hover:text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                        >
                          <CornerDownRight className="size-3" aria-hidden />
                          Show {hiddenCount} more {hiddenCount === 1 ? "reply" : "replies"}
                        </button>
                      </li>
                    ) : null}
                    {shown.map((r) => (
                      <li key={r.id}>{renderComment(r, c)}</li>
                    ))}
                  </ol>
                ) : null}
                {replyTo === c.id ? (
                  <div className="mt-3 sm:ml-4">
                    <CommentBox
                      author={currentUser}
                      mentionables={mentionables}
                      placeholder={`Reply to ${c.author.name.split(" ")[0]}…`}
                      submitLabel="Reply"
                      onSubmit={async (text, mentions) => {
                        await onAdd(text, c.id, mentions);
                        setReplyTo(null);
                        setExpanded((s) => new Set(s).add(c.id));
                      }}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      <CommentBox
        author={currentUser}
        mentionables={mentionables}
        onSubmit={(text, mentions) => onAdd(text, null, mentions)}
      />
    </section>
  );
}
