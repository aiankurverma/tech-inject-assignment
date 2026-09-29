export interface CommentUser {
  id: string;
  name: string;
  /** Optional avatar image URL; initials are shown otherwise. */
  avatarUrl?: string;
  /** Short role or title shown in the mention picker. */
  title?: string;
}

export interface CommentReaction {
  emoji: string;
  /** Ids of users who reacted with this emoji. */
  userIds: string[];
}

export interface ThreadComment {
  id: string;
  authorId: string;
  /** Plain text body; mentions appear as "@Name" and are listed in `mentions`. */
  body: string;
  mentions: string[];
  createdAt: string;
  reactions: CommentReaction[];
  /** Set while an optimistic write is in flight. */
  pending?: boolean;
}

export interface CommentThread {
  id: string;
  /** The text that was selected when the thread was opened (kept for detached threads). */
  quote: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  comments: ThreadComment[];
}

export type ThreadFilter = "open" | "mine" | "resolved" | "all";

export interface NewThreadInput {
  id: string;
  quote: string;
  body: string;
  mentions: string[];
}

/**
 * Persistence boundary. Every method returns a promise so the component can
 * apply optimistic updates and roll back when the server rejects a write.
 */
export interface CommentAdapter {
  listThreads(documentId: string): Promise<CommentThread[]>;
  createThread(documentId: string, input: NewThreadInput, authorId: string): Promise<CommentThread>;
  addReply(
    documentId: string,
    threadId: string,
    input: { id: string; body: string; mentions: string[] },
    authorId: string,
  ): Promise<ThreadComment>;
  toggleReaction(
    documentId: string,
    threadId: string,
    commentId: string,
    emoji: string,
    userId: string,
  ): Promise<void>;
  setResolved(
    documentId: string,
    threadId: string,
    resolved: boolean,
    userId: string,
  ): Promise<void>;
  deleteComment?(documentId: string, threadId: string, commentId: string): Promise<void>;
}
