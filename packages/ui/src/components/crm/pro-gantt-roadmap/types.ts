export type GanttZoom = "day" | "week" | "quarter";

export interface GanttTask {
  id: string;
  name: string;
  /** Inclusive start (Date or ISO). */
  start: Date | string;
  /** Exclusive end. For milestones set end === start. */
  end: Date | string;
  /** Parent task id; parents become summary rows whose span rolls up from children. */
  parentId?: string | null;
  /** 0..1 */
  progress?: number;
  /** Finish-to-start predecessors. */
  dependencies?: string[];
  milestone?: boolean;
  /** Original plan, rendered as a ghost bar when baseline compare is on. */
  baselineStart?: Date | string;
  baselineEnd?: Date | string;
  assignee?: string;
  /** Tailwind bg-* class override for the bar. */
  color?: string;
}

/** Normalised task on an integer day axis (day 0 = timeline origin). */
export interface DayTask {
  id: string;
  s: number;
  e: number;
  bs?: number;
  be?: number;
}

export interface GanttRow {
  task: GanttTask;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  index: number;
}

export interface ScheduleInfo {
  /** Total float in days (0 or less = critical). */
  slack: Map<string, number>;
  critical: Set<string>;
  /** Tasks participating in a dependency cycle (ignored by scheduling). */
  cyclic: Set<string>;
  /** Dependency edges whose successor starts before its predecessor ends. */
  violations: Set<string>;
}
