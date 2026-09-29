import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditorContent, useEditor, useEditorState, type Content, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import { AlertTriangle, MessageSquarePlus, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommentThreads } from "@/hooks/use-comment-threads";
import { layoutAnchored, useMeasuredHeights } from "@/hooks/use-anchored-layout";
import { useControllableState } from "@/hooks/use-controllable-state";
import {
  CommentAnchor,
  collectAnchors,
  threadIdsAtSelection,
} from "@/components/crm/pro-comment-threads/comment-mark";
import { ThreadCard } from "@/components/crm/pro-comment-threads/thread-card";
import { FilterBar } from "@/components/crm/pro-comment-threads/filter-bar";
import { MentionComposer } from "@/components/crm/pro-comment-threads/mention-composer";
import type {
  CommentAdapter,
  CommentThread,
  CommentUser,
  ThreadFilter,
} from "@/components/crm/pro-comment-threads/types";

export type {
  CommentAdapter,
  CommentThread,
  CommentUser,
  ThreadComment,
  CommentReaction,
  ThreadFilter,
  NewThreadInput,
} from "@/components/crm/pro-comment-threads/types";
export { CommentAnchor } from "@/components/crm/pro-comment-threads/comment-mark";

export interface ProCommentThreadsProps {
  /** Scopes the query cache and every adapter call. */
  documentId: string;
  /** Initial document (HTML or Tiptap JSON). Anchors are `<span data-comment-id="…">`. */
  content: Content;
  adapter: CommentAdapter;
  users: CommentUser[];
  currentUserId: string;
  filter?: ThreadFilter;
  defaultFilter?: ThreadFilter;
  onFilterChange?: (filter: ThreadFilter) => void;
  activeThreadId?: string | null;
  defaultActiveThreadId?: string | null;
  onActiveThreadChange?: (id: string | null) => void;
  /** Allow editing the document text itself. */
  editable?: boolean;
  /** Disable creating, replying, reacting and resolving. */
  readOnly?: boolean;
  /** Emoji offered in the reaction picker. */
  reactions?: string[];
  /** Height of the scrolling review surface. */
  height?: number | string;
  /** Share a QueryClient with the host app; one is created otherwise. */
  queryClient?: QueryClient;
  /** Called with HTML whenever text or anchors change, so the host can persist anchors. */
  onContentChange?: (html: string) => void;
  /** Called when an optimistic write was rolled back. */
  onError?: (error: unknown, action: string) => void;
  className?: string;
}

const DEFAULT_REACTIONS = ["👍", "🎉", "👀", "❤️", "✅", "🤔"];
const OVERSCAN = 600;
const DRAFT_ID = "__draft__";

function newId(prefix: string) {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rnd}`;
}

/**
 * Anchored review comments on a rich-text document: select text to open a
 * thread, discuss with replies, @mentions and reactions, then resolve. Cards
 * align to their anchors, never overlap, and only on-screen cards are mounted.
 */
export function ProCommentThreads({ queryClient, ...props }: ProCommentThreadsProps) {
  const [fallback] = React.useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient ?? fallback}>
      <CommentSurface {...props} />
    </QueryClientProvider>
  );
}

type Draft = { from: number; to: number; quote: string; top: number };

function CommentSurface({
  documentId,
  content,
  adapter,
  users,
  currentUserId,
  filter: filterProp,
  defaultFilter = "open",
  onFilterChange,
  activeThreadId,
  defaultActiveThreadId = null,
  onActiveThreadChange,
  editable = false,
  readOnly = false,
  reactions = DEFAULT_REACTIONS,
  height = 640,
  onContentChange,
  onError,
  className,
}: Omit<ProCommentThreadsProps, "queryClient">) {
  const [filter, setFilter] = useControllableState(filterProp, defaultFilter, onFilterChange);
  const [active, setActive] = useControllableState<string | null>(
    activeThreadId,
    defaultActiveThreadId,
    onActiveThreadChange,
  );
  const [banner, setBanner] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [anchors, setAnchors] = React.useState<Map<string, number>>(() => new Map());
  const [viewport, setViewport] = React.useState({ top: 0, height: 800 });
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const scope = React.useId().replace(/[^a-zA-Z0-9]/g, "");

  const api = useCommentThreads({
    adapter,
    documentId,
    currentUserId,
    onError: (err, action) => {
      setBanner(
        `Could not ${action === "create" ? "start the thread" : `save your ${action}`}. Changes were reverted.`,
      );
      onError?.(err, action);
    },
  });
  const threads = React.useMemo(() => api.query.data ?? [], [api.query.data]);

  const userMap = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const onContentRef = React.useRef(onContentChange);
  onContentRef.current = onContentChange;

  const editor = useEditor({
    extensions: [StarterKit, CommentAnchor],
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose-crm min-h-full px-8 py-6 text-[15px] leading-7 text-crm-chip focus:outline-none [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-crm-fg [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-crm-fg [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6",
        "aria-label": "Document under review",
      },
    },
    onUpdate: ({ editor }) => onContentRef.current?.(editor.getHTML()),
  });

  /* ---------- anchor measurement (one pass over the doc, batched per frame) ---------- */
  const measureAnchors = React.useCallback(() => {
    const ed = editor;
    const host = contentRef.current;
    if (!ed || ed.isDestroyed || !host) return;
    const base = host.getBoundingClientRect().top;
    const next = new Map<string, number>();
    for (const [id, pos] of collectAnchors(ed)) {
      try {
        next.set(id, Math.max(0, ed.view.coordsAtPos(pos).top - base - 4));
      } catch {
        /* position outside the rendered doc; treated as detached */
      }
    }
    setAnchors((prev) => (sameMap(prev, next) ? prev : next));
  }, [editor]);

  React.useEffect(() => {
    if (!editor) return;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measureAnchors);
    };
    schedule();
    editor.on("update", schedule);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (contentRef.current) ro?.observe(contentRef.current);
    return () => {
      cancelAnimationFrame(raf);
      editor.off("update", schedule);
      ro?.disconnect();
    };
  }, [editor, measureAnchors]);

  /* ---------- viewport tracking for card virtualisation ---------- */
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const read = () => setViewport({ top: el.scrollTop, height: el.clientHeight });
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(read);
    };
    read();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  /* ---------- filtering ---------- */
  const involvesMe = React.useCallback(
    (t: CommentThread) =>
      t.comments.some((c) => c.authorId === currentUserId || c.mentions.includes(currentUserId)),
    [currentUserId],
  );
  const counts = React.useMemo(() => {
    const c = { open: 0, mine: 0, resolved: 0, all: threads.length };
    for (const t of threads) {
      if (t.resolved) c.resolved++;
      else {
        c.open++;
        if (involvesMe(t)) c.mine++;
      }
    }
    return c;
  }, [threads, involvesMe]);

  const visible = React.useMemo(
    () =>
      threads.filter((t) =>
        filter === "open"
          ? !t.resolved
          : filter === "resolved"
            ? t.resolved
            : filter === "mine"
              ? !t.resolved && involvesMe(t)
              : true,
      ),
    [threads, filter, involvesMe],
  );

  /* ---------- layout ---------- */
  const { heights, version, measure } = useMeasuredHeights();
  const ordered = React.useMemo(() => {
    const anchored: { id: string; anchorTop: number }[] = [];
    const detached: string[] = [];
    for (const t of visible) {
      const top = anchors.get(t.id);
      if (top === undefined) detached.push(t.id);
      else anchored.push({ id: t.id, anchorTop: top });
    }
    if (draft) anchored.push({ id: DRAFT_ID, anchorTop: draft.top });
    anchored.sort((a, b) => a.anchorTop - b.anchorTop);
    const tail = anchored.length ? anchored[anchored.length - 1]!.anchorTop : 0;
    return [...anchored, ...detached.map((id) => ({ id, anchorTop: tail }))];
  }, [visible, anchors, draft]);

  const pinned = draft ? DRAFT_ID : active;
  const tops = React.useMemo(
    () => layoutAnchored(ordered, heights, pinned),
    // `version` changes whenever a measured height changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordered, pinned, version],
  );
  const railHeight = React.useMemo(() => {
    let max = 0;
    for (const it of ordered)
      max = Math.max(max, (tops.get(it.id) ?? 0) + (heights.get(it.id) ?? 120));
    return max;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered, tops, version]);

  const threadById = React.useMemo(() => new Map(threads.map((t) => [t.id, t])), [threads]);
  const lo = viewport.top - OVERSCAN;
  const hi = viewport.top + viewport.height + OVERSCAN;
  const mounted = ordered.filter((it) => {
    if (it.id === pinned) return true;
    const top = tops.get(it.id) ?? 0;
    return top + (heights.get(it.id) ?? 120) >= lo && top <= hi;
  });

  /* ---------- actions ---------- */
  const scrollToAnchor = React.useCallback(
    (id: string) => {
      const el = scrollRef.current;
      const top = anchors.get(id);
      if (!el || top === undefined) return;
      if (top < el.scrollTop + 40 || top > el.scrollTop + el.clientHeight - 80)
        el.scrollTo({ top: Math.max(0, top - el.clientHeight / 3), behavior: "smooth" });
    },
    [anchors],
  );

  const activate = React.useCallback(
    (id: string | null) => {
      setActive(id);
      if (id) scrollToAnchor(id);
    },
    [setActive, scrollToAnchor],
  );

  React.useEffect(() => {
    if (!editor) return;
    const onSel = () => {
      const ids = threadIdsAtSelection(editor);
      if (!ids.length) return;
      const shown = ids.find((id) => visible.some((t) => t.id === id));
      if (shown && shown !== active) setActive(shown);
    };
    editor.on("selectionUpdate", onSel);
    return () => {
      editor.off("selectionUpdate", onSel);
    };
  }, [editor, visible, active, setActive]);

  React.useEffect(() => {
    if (active && !visible.some((t) => t.id === active) && threads.length) setActive(null);
  }, [active, visible, threads.length, setActive]);

  const startDraft = React.useCallback(
    (ed: Editor) => {
      const { from, to, empty } = ed.state.selection;
      const host = contentRef.current;
      if (empty || !host) return;
      const quote = ed.state.doc.textBetween(from, to, " ").trim().slice(0, 280);
      if (!quote) return;
      const top = ed.view.coordsAtPos(from).top - host.getBoundingClientRect().top - 4;
      setActive(null);
      setDraft({ from, to, quote, top: Math.max(0, top) });
    },
    [setActive],
  );

  const submitDraft = (body: string, mentions: string[]) => {
    if (!editor || !draft) return;
    const id = newId("th");
    editor.chain().setTextSelection({ from: draft.from, to: draft.to }).setCommentAnchor(id).run();
    api.createThread.mutate(
      { id, quote: draft.quote, body, mentions },
      { onError: () => editor.commands.unsetCommentAnchor(id) },
    );
    setDraft(null);
    if (filter === "resolved") setFilter("open");
    setActive(id);
  };

  const onReply = React.useCallback(
    (threadId: string, body: string, mentions: string[]) =>
      api.addReply.mutate({ threadId, id: newId("c"), body, mentions }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api.addReply.mutate],
  );
  const onReact = React.useCallback(
    (threadId: string, commentId: string, emoji: string) =>
      api.toggleReaction.mutate({ threadId, commentId, emoji }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api.toggleReaction.mutate],
  );
  const onResolve = React.useCallback(
    (threadId: string, resolved: boolean) => api.setResolved.mutate({ threadId, resolved }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api.setResolved.mutate],
  );
  const onDelete = React.useCallback(
    (threadId: string, commentId: string) => api.deleteComment.mutate({ threadId, commentId }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api.deleteComment.mutate],
  );

  const pendingFocus = React.useRef<string | null>(null);
  const orderedRef = React.useRef(ordered);
  orderedRef.current = ordered;
  const onKeyNav = React.useCallback(
    (e: React.KeyboardEvent, id: string) => {
      const list = orderedRef.current.filter((i) => i.id !== DRAFT_ID);
      const idx = list.findIndex((i) => i.id === id);
      let target: string | undefined;
      if (e.key === "ArrowDown" || e.key === "j") target = list[idx + 1]?.id;
      else if (e.key === "ArrowUp" || e.key === "k") target = list[idx - 1]?.id;
      else if (e.key === "Home") target = list[0]?.id;
      else if (e.key === "End") target = list.at(-1)?.id;
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate(id);
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        setActive(null);
        return;
      } else return;
      e.preventDefault();
      if (!target) return;
      pendingFocus.current = target;
      activate(target);
    },
    [activate, setActive],
  );
  React.useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(
      `[data-thread-card="${CSS.escape(id)}"]`,
    );
    if (el) {
      el.focus({ preventScroll: true });
      pendingFocus.current = null;
    }
  });

  /* ---------- anchor highlight styles (one rule per special thread) ---------- */
  const anchorCss = React.useMemo(() => {
    const s = `[data-kb-ct="${scope}"]`;
    const rules = [
      `${s} .kb-comment-anchor{background:color-mix(in srgb,var(--color-crm-warning) 16%,transparent);border-bottom:2px solid color-mix(in srgb,var(--color-crm-warning) 55%,transparent);cursor:pointer;border-radius:2px}`,
    ];
    for (const t of threads) {
      const sel = `${s} [data-comment-id="${CSS.escape(t.id)}"]`;
      if (t.resolved && filter !== "resolved" && filter !== "all")
        rules.push(`${sel}{background:transparent;border-bottom-color:transparent;cursor:text}`);
    }
    if (active)
      rules.push(
        `${s} [data-comment-id="${CSS.escape(active)}"]{background:color-mix(in srgb,var(--color-crm-warning) 38%,transparent);border-bottom-color:var(--color-crm-warning)}`,
      );
    return rules.join("\n");
  }, [threads, filter, active, scope]);

  /* ---------- render ---------- */
  const isLoading = api.query.isPending;
  const isError = api.query.isError;

  return (
    <section
      data-kb-ct={scope}
      aria-label="Document review"
      className={cn(
        "flex flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-bg font-crm text-crm-fg",
        className,
      )}
      onKeyDown={(e) => {
        if (e.key === "Escape" && draft) setDraft(null);
        if (
          editor &&
          !readOnly &&
          e.altKey &&
          (e.ctrlKey || e.metaKey) &&
          e.key.toLowerCase() === "m"
        ) {
          e.preventDefault();
          startDraft(editor);
        }
      }}
    >
      <style>{anchorCss}</style>
      <header className="flex flex-wrap items-center gap-3 border-b border-crm-border bg-crm-sidebar px-4 py-2">
        <h2 className="text-sm font-semibold">Comments</h2>
        <FilterBar value={filter} counts={counts} onChange={setFilter} />
        <span className="ml-auto hidden text-xs text-crm-subtle md:inline">
          Select text and press Ctrl + Alt + M to comment
        </span>
        {api.query.isFetching && !isLoading && (
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-crm-subtle" aria-label="Syncing" />
        )}
      </header>

      {banner && (
        <div
          role="alert"
          className="flex items-center gap-2 border-b border-crm-border bg-tag-red-bg px-4 py-2 text-xs text-tag-red-text"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="flex-1">{banner}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setBanner(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div ref={scrollRef} className="relative overflow-auto" style={{ height }}>
        <div className="grid min-h-full grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
          <div ref={contentRef} className="relative border-r border-crm-border bg-crm-card">
            <EditorContent editor={editor} />
            {editor && !readOnly && (
              <BubbleMenu
                editor={editor}
                shouldShow={({ state }) => !state.selection.empty && !draft}
                options={{ placement: "top" }}
              >
                <button
                  type="button"
                  onClick={() => startDraft(editor)}
                  className="inline-flex items-center gap-1.5 rounded-crm border border-crm-border bg-crm-popover px-2.5 py-1.5 text-xs font-medium text-crm-fg shadow-crm-raised hover:bg-crm-muted"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" /> Comment
                </button>
              </BubbleMenu>
            )}
            {!editor && <DocSkeleton />}
          </div>

          <aside
            aria-label="Comment threads"
            className="relative bg-crm-bg px-3"
            style={{ minHeight: railHeight + 24 }}
          >
            {isLoading && <RailSkeleton />}
            {isError && (
              <div
                role="alert"
                className="mt-4 rounded-crm border border-crm-border bg-crm-card p-3 text-sm"
              >
                <p className="mb-2 text-crm-danger">Comments failed to load.</p>
                <button
                  type="button"
                  onClick={() => api.query.refetch()}
                  className="rounded-crm bg-crm-muted px-2.5 py-1 text-xs hover:bg-crm-input"
                >
                  Retry
                </button>
              </div>
            )}
            {!isLoading && !isError && ordered.length === 0 && (
              <p className="mt-6 px-2 text-center text-sm text-crm-subtle">
                {filter === "resolved"
                  ? "Nothing resolved yet."
                  : filter === "mine"
                    ? "No open threads involve you."
                    : readOnly
                      ? "No comments."
                      : "No open comments. Select text in the document to start a thread."}
              </p>
            )}
            {mounted.map(({ id }) => {
              const top = tops.get(id) ?? 0;
              if (id === DRAFT_ID && draft)
                return (
                  <div
                    key={id}
                    ref={measure(id)}
                    className="absolute inset-x-3 rounded-crm border border-crm-primary bg-crm-card p-3 shadow-crm-raised"
                    style={{ top }}
                  >
                    <blockquote className="mb-2 line-clamp-2 border-l-2 border-crm-warning pl-2 text-xs text-crm-soft">
                      {draft.quote}
                    </blockquote>
                    <MentionComposer
                      users={users}
                      autoFocus
                      submitLabel="Comment"
                      placeholder="Add a comment… use @ to mention"
                      onSubmit={submitDraft}
                      onCancel={() => setDraft(null)}
                    />
                  </div>
                );
              const thread = threadById.get(id);
              if (!thread) return null;
              return (
                <div
                  key={id}
                  className="absolute inset-x-3 transition-[top] duration-200"
                  style={{ top }}
                >
                  <ThreadCard
                    ref={measure(id)}
                    thread={thread}
                    users={userMap}
                    userList={users}
                    currentUserId={currentUserId}
                    active={id === active}
                    detached={!anchors.has(id)}
                    reactions={reactions}
                    readOnly={readOnly}
                    canDelete={!!adapter.deleteComment}
                    onActivate={activate}
                    onReply={onReply}
                    onReact={onReact}
                    onResolve={onResolve}
                    onDelete={onDelete}
                    onKeyNav={onKeyNav}
                  />
                </div>
              );
            })}
          </aside>
        </div>
      </div>
      <EditorStatus editor={editor} anchored={anchors.size} total={threads.length} />
    </section>
  );
}

function EditorStatus({
  editor,
  anchored,
  total,
}: {
  editor: Editor | null;
  anchored: number;
  total: number;
}) {
  const words = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e ? e.state.doc.textContent.split(/\s+/).filter(Boolean).length : 0,
  });
  return (
    <footer className="flex items-center gap-4 border-t border-crm-border bg-crm-sidebar px-4 py-1.5 text-[11px] text-crm-subtle">
      <span>{(words ?? 0).toLocaleString()} words</span>
      <span>
        {anchored.toLocaleString()} anchored · {Math.max(0, total - anchored).toLocaleString()}{" "}
        detached
      </span>
    </footer>
  );
}

function DocSkeleton() {
  return (
    <div className="space-y-3 px-8 py-6" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-crm-muted"
          style={{ width: `${60 + ((i * 37) % 40)}%` }}
        />
      ))}
    </div>
  );
}

function RailSkeleton() {
  return (
    <div className="mt-4 space-y-3" aria-busy aria-label="Loading comments">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-crm border border-crm-border bg-crm-card"
        />
      ))}
    </div>
  );
}

function sameMap(a: Map<string, number>, b: Map<string, number>) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (Math.abs((b.get(k) ?? -1) - v) > 0.5) return false;
  return true;
}
