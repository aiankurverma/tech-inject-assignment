export type TicketStatus = "open" | "pending" | "on-hold" | "solved";
export type TicketPriority = "urgent" | "high" | "normal" | "low";

export interface TicketRequester {
  name: string;
  email: string;
  company?: string;
  plan?: string;
}

export interface Ticket {
  id: string;
  subject: string;
  /** First line of the latest message, shown in the queue. */
  preview: string;
  requester: TicketRequester;
  status: TicketStatus;
  priority: TicketPriority;
  assignee?: string | null;
  tags: string[];
  /** ISO time the ticket was created. */
  createdAt: string;
  /** ISO time of the last customer or agent update. */
  updatedAt: string;
  /** ISO time the SLA clock started (defaults to createdAt). */
  slaStartedAt?: string;
  /** Business minutes allowed for the next response; overrides the priority policy. */
  slaMinutes?: number;
  unread?: boolean;
  /** Other agents currently viewing this ticket (collision detection). */
  viewers?: string[];
  /** Agents currently drafting a reply (stronger collision signal). */
  replying?: string[];
}

export type TicketMessageRole = "customer" | "agent" | "internal";

export interface TicketMessage {
  id: string;
  author: string;
  role: TicketMessageRole;
  body: string;
  /** ISO time. */
  at: string;
}

export interface TicketPatch {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignee?: string | null;
  addTags?: string[];
  removeTags?: string[];
  unread?: boolean;
}

export interface TicketMacro {
  id: string;
  name: string;
  description?: string;
  patch: TicketPatch;
  /** Optional canned reply; `{{name}}` is replaced by the requester's first name. */
  reply?: string;
}

export interface BusinessHours {
  /** IANA zone the support team works in. Default: the viewer's zone. */
  timeZone?: string;
  /** Working weekdays, 0 = Sunday. Default Mon-Fri. */
  days?: number[];
  /** "HH:mm" local start. Default "09:00". */
  start?: string;
  /** "HH:mm" local end. Default "18:00". */
  end?: string;
  /** "yyyy-MM-dd" holidays in the team zone. */
  holidays?: string[];
}

/** Business minutes for the next response per priority. */
export type SlaPolicy = Record<TicketPriority, number>;

export const DEFAULT_SLA_POLICY: SlaPolicy = { urgent: 60, high: 240, normal: 480, low: 1440 };

export type TicketView = "open" | "mine" | "unassigned" | "breaching" | "solved" | "all";

export type TicketBulkAction =
  | { type: "patch"; patch: TicketPatch }
  | { type: "macro"; macro: TicketMacro }
  | { type: "delete" };
