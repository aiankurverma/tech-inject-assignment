export interface SchedulerResource {
  id: string;
  name: string;
  /** Secondary line, e.g. role or region. */
  subtitle?: string;
  /** Group heading label (resources should be pre-sorted by group). */
  group?: string;
  /** CSS colour used for this resource's events. */
  color?: string;
  /** Hide the row from drag targets. */
  disabled?: boolean;
}

export type RecurrenceFreq = "daily" | "weekly" | "monthly";

/** Small, dependency-free subset of RFC 5545 RRULE. */
export interface Recurrence {
  freq: RecurrenceFreq;
  /** Every N periods. Default 1. */
  interval?: number;
  /** Weekly only: weekdays (0 = Sunday). Default: the weekday of the first start. */
  byWeekday?: number[];
  /** Stop after N occurrences. */
  count?: number;
  /** ISO end (inclusive). */
  until?: string;
  /** ISO starts of skipped occurrences. */
  exdates?: string[];
}

export interface SchedulerEvent {
  id: string;
  resourceId: string;
  title: string;
  /** ISO start. */
  start: string;
  /** ISO end (exclusive). */
  end: string;
  color?: string;
  /** Locks the event against drag / resize / delete. */
  locked?: boolean;
  recurrence?: Recurrence;
  meta?: Record<string, string | number>;
}

/** A concrete bar on the timeline (a single event, or one expanded occurrence). */
export interface SchedulerOccurrence {
  key: string;
  event: SchedulerEvent;
  start: number;
  end: number;
  resourceId: string;
  /** Original start of a recurring occurrence. */
  occurrenceStart?: number;
}

export type SchedulerView = "day" | "week" | "month";

export type SchedulerChange =
  | { type: "create"; event: SchedulerEvent }
  | { type: "update"; event: SchedulerEvent; previous: SchedulerEvent }
  | {
      type: "detach";
      /** The series with this occurrence excluded. */
      series: SchedulerEvent;
      /** The new standalone event created from the occurrence. */
      event: SchedulerEvent;
    }
  | { type: "delete"; event: SchedulerEvent; occurrenceStart?: number };

export type DragMode = "move" | "resize-start" | "resize-end" | "create";
