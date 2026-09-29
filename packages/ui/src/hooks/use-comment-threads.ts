import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type {
  CommentAdapter,
  CommentThread,
  NewThreadInput,
  ThreadComment,
} from "@/components/crm/pro-comment-threads/types";

type Ctx = { previous?: CommentThread[] };

/**
 * Server state for comment threads, backed by TanStack Query. Every write is
 * optimistic: the cache is patched immediately, the previous snapshot is kept
 * in the mutation context and restored if the adapter rejects.
 */
export function useCommentThreads(opts: {
  adapter: CommentAdapter;
  documentId: string;
  currentUserId: string;
  onError?: (error: unknown, action: string) => void;
}) {
  const { adapter, documentId, currentUserId, onError } = opts;
  const qc = useQueryClient();
  const key: QueryKey = ["kb-comment-threads", documentId];

  const query = useQuery({
    queryKey: key,
    queryFn: () => adapter.listThreads(documentId),
    staleTime: 30_000,
  });

  const patch = async (fn: (threads: CommentThread[]) => CommentThread[]): Promise<Ctx> => {
    await qc.cancelQueries({ queryKey: key });
    const previous = qc.getQueryData<CommentThread[]>(key);
    qc.setQueryData<CommentThread[]>(key, (old) => fn(old ?? []));
    return { previous };
  };
  const rollback = (action: string) => (err: unknown, _v: unknown, ctx: Ctx | undefined) => {
    if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    onError?.(err, action);
  };
  const mapThread =
    (id: string, fn: (t: CommentThread) => CommentThread) => (list: CommentThread[] | undefined) =>
      (list ?? []).map((t) => (t.id === id ? fn(t) : t));

  const createThread = useMutation<CommentThread, unknown, NewThreadInput, Ctx>({
    mutationFn: (input) => adapter.createThread(documentId, input, currentUserId),
    onMutate: (input) => {
      const now = new Date().toISOString();
      return patch((list) => [
        ...list,
        {
          id: input.id,
          quote: input.quote,
          resolved: false,
          createdAt: now,
          comments: [
            {
              id: `${input.id}-c0`,
              authorId: currentUserId,
              body: input.body,
              mentions: input.mentions,
              createdAt: now,
              reactions: [],
              pending: true,
            },
          ],
        },
      ]);
    },
    onError: rollback("create"),
    onSuccess: (thread) =>
      qc.setQueryData<CommentThread[]>(
        key,
        mapThread(thread.id, () => thread),
      ),
  });

  const addReply = useMutation<
    ThreadComment,
    unknown,
    { threadId: string; id: string; body: string; mentions: string[] },
    Ctx
  >({
    mutationFn: ({ threadId, ...input }) =>
      adapter.addReply(documentId, threadId, input, currentUserId),
    onMutate: ({ threadId, id, body, mentions }) =>
      patch(
        mapThread(threadId, (t) => ({
          ...t,
          comments: [
            ...t.comments,
            {
              id,
              authorId: currentUserId,
              body,
              mentions,
              createdAt: new Date().toISOString(),
              reactions: [],
              pending: true,
            },
          ],
        })),
      ),
    onError: rollback("reply"),
    onSuccess: (comment, { threadId, id }) =>
      qc.setQueryData<CommentThread[]>(
        key,
        mapThread(threadId, (t) => ({
          ...t,
          comments: t.comments.map((c) => (c.id === id ? comment : c)),
        })),
      ),
  });

  const toggleReaction = useMutation<
    void,
    unknown,
    { threadId: string; commentId: string; emoji: string },
    Ctx
  >({
    mutationFn: ({ threadId, commentId, emoji }) =>
      adapter.toggleReaction(documentId, threadId, commentId, emoji, currentUserId),
    onMutate: ({ threadId, commentId, emoji }) =>
      patch(
        mapThread(threadId, (t) => ({
          ...t,
          comments: t.comments.map((c) =>
            c.id !== commentId ? c : { ...c, reactions: toggle(c.reactions, emoji, currentUserId) },
          ),
        })),
      ),
    onError: rollback("reaction"),
  });

  const setResolved = useMutation<void, unknown, { threadId: string; resolved: boolean }, Ctx>({
    mutationFn: ({ threadId, resolved }) =>
      adapter.setResolved(documentId, threadId, resolved, currentUserId),
    onMutate: ({ threadId, resolved }) =>
      patch(
        mapThread(threadId, (t) => ({
          ...t,
          resolved,
          resolvedBy: resolved ? currentUserId : undefined,
          resolvedAt: resolved ? new Date().toISOString() : undefined,
        })),
      ),
    onError: rollback("resolve"),
  });

  const deleteComment = useMutation<void, unknown, { threadId: string; commentId: string }, Ctx>({
    mutationFn: ({ threadId, commentId }) =>
      adapter.deleteComment
        ? adapter.deleteComment(documentId, threadId, commentId)
        : Promise.reject(new Error("Deleting comments is not supported")),
    onMutate: ({ threadId, commentId }) =>
      patch(
        mapThread(threadId, (t) => ({
          ...t,
          comments: t.comments.filter((c) => c.id !== commentId),
        })),
      ),
    onError: rollback("delete"),
  });

  return { query, createThread, addReply, toggleReaction, setResolved, deleteComment };
}

function toggle(
  reactions: CommentThread["comments"][number]["reactions"],
  emoji: string,
  uid: string,
) {
  const existing = reactions.find((r) => r.emoji === emoji);
  if (!existing) return [...reactions, { emoji, userIds: [uid] }];
  const has = existing.userIds.includes(uid);
  const userIds = has ? existing.userIds.filter((u) => u !== uid) : [...existing.userIds, uid];
  return userIds.length
    ? reactions.map((r) => (r.emoji === emoji ? { emoji, userIds } : r))
    : reactions.filter((r) => r.emoji !== emoji);
}
