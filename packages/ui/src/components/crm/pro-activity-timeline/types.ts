export type ActivityType = "email" | "call" | "meeting" | "note" | "stage" | "task";

export const ACTIVITY_TYPES: readonly ActivityType[] = [
  "email",
  "call",
  "meeting",
  "note",
  "stage",
  "task",
];

export interface ActivityActor {
  name: string;
  avatarUrl?: string;
}

export interface TimelineActivity {
  id: string;
  type: ActivityType;
  /** ISO string, epoch ms or Date. */
  at: string | number | Date;
  actor: ActivityActor;
  /** One-line summary, e.g. "Re: Renewal pricing" or "Discovery call". */
  title: string;
  /** Long body: email text, note text, call notes. Collapsible when long. */
  body?: string;
  email?: { from: string; to: string[]; cc?: string[]; direction: "inbound" | "outbound" };
  call?: { durationSec: number; outcome: "connected" | "voicemail" | "no-answer" };
  stage?: { from: string; to: string };
  task?: { done: boolean; due?: string | number | Date };
  meeting?: { attendees: number; location?: string };
}

/** A cursor-based page. `olderCursor`/`newerCursor` are null when that end is reached. */
export interface ActivityPage {
  items: TimelineActivity[];
  olderCursor: string | null;
  newerCursor: string | null;
}

export interface ActivityPageRequest {
  /** null = first page around the anchor. */
  cursor: string | null;
  direction: "older" | "newer";
  types: ActivityType[];
  signal?: AbortSignal;
}

export type FetchActivityPage = (req: ActivityPageRequest) => Promise<ActivityPage>;

export type TimeMode = "relative" | "absolute";

/** Flattened virtual row: either a day header or an activity. */
export type FeedRow =
  | { kind: "day"; key: string; day: Date; label: string }
  | { kind: "item"; key: string; item: TimelineActivity; index: number };

export function toDate(v: string | number | Date): Date {
  return v instanceof Date ? v : new Date(v);
}
