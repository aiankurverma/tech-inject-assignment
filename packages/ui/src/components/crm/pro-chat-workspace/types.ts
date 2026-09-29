export interface ChatUser {
  id: string;
  name: string;
  avatarUrl?: string;
  /** Shown under the name in the mention picker, e.g. "Account Executive". */
  title?: string;
  online?: boolean;
}

export interface ChatChannel {
  id: string;
  name: string;
  kind?: "channel" | "direct" | "private";
  topic?: string;
  /** Messages newer than this timestamp (ms) that were not sent by the current user are unread. */
  lastReadAt?: number;
  muted?: boolean;
  /** Section heading in the channel list. Defaults by kind. */
  group?: string;
}

export interface ChatAttachmentMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  /** Epoch milliseconds. */
  createdAt: number;
  /** Plain text body; used when html is absent and for search / previews. */
  text: string;
  /** Sanitised HTML produced by the composer (bold, italic, code, lists, mentions). */
  html?: string;
  /** Present on replies: the id of the parent message. Replies stay out of the main stream. */
  threadId?: string;
  /** emoji -> user ids who reacted. */
  reactions?: Record<string, string[]>;
  attachments?: ChatAttachmentMeta[];
  edited?: boolean;
  /** Optimistic state for messages still in flight. */
  status?: "sending" | "failed";
}

export interface ChatSendPayload {
  channelId: string;
  threadId?: string;
  text: string;
  html: string;
  mentions: string[];
  files: File[];
}

/** Flattened row rendered by the virtualised list. */
export type ChatRow =
  | { kind: "day"; key: string; at: number }
  | { kind: "unread"; key: string; count: number }
  | { kind: "message"; key: string; message: ChatMessage; grouped: boolean };
