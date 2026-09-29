export type InboxView = "inbox" | "unread" | "snoozed" | "archived";

export interface InboxNotification {
  id: string;
  /** Free-form type key, e.g. "mention" | "deal" | "task" | "system". Used by the type filters. */
  type: string;
  title: string;
  body?: string;
  actor?: { name: string; avatar?: string };
  /** ISO string or Date. */
  createdAt: Date | string;
  readAt?: Date | string | null;
  archivedAt?: Date | string | null;
  snoozedUntil?: Date | string | null;
  href?: string;
}

export type InboxAction =
  | { kind: "read"; ids: string[] }
  | { kind: "unread"; ids: string[] }
  | { kind: "archive"; ids: string[] }
  | { kind: "restore"; ids: string[] }
  | { kind: "snooze"; ids: string[]; until: Date };

export interface InboxTypeMeta {
  label: string;
  /** Tailwind classes for the type dot / chip accent. */
  tone?: string;
}

export type InboxRow =
  | { kind: "header"; key: string; label: string; count: number }
  | { kind: "item"; key: string; item: InboxNotification; index: number };
