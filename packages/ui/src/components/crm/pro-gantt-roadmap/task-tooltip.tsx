import * as React from "react";
import { FloatingPortal, autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react";
import { differenceInCalendarDays, format } from "date-fns";
import { durationDays, toDate } from "@/lib/gantt-schedule";
import type { GanttTask } from "@/components/crm/pro-gantt-roadmap/types";

export function TaskTooltip({
  task,
  anchor,
  slack,
  critical,
}: {
  task: GanttTask | null;
  anchor: HTMLElement | null;
  slack?: number;
  critical: boolean;
}) {
  const open = !!task && !!anchor;
  const { refs, floatingStyles } = useFloating({
    open,
    placement: "top",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: { reference: anchor },
  });
  if (!open || !task) return null;
  const s = toDate(task.start);
  const e = toDate(task.end);
  const variance =
    task.baselineEnd != null ? differenceInCalendarDays(e, toDate(task.baselineEnd)) : null;
  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        role="tooltip"
        className="pointer-events-none z-50 w-64 animate-crm-in rounded-crm border border-crm-border bg-crm-popover p-3 text-xs text-crm-soft shadow-crm-overlay"
      >
        <p className="mb-1.5 text-sm font-medium text-crm-fg">{task.name}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
          <dt className="text-crm-muted-fg">Dates</dt>
          <dd>
            {format(s, "d MMM")}
            {task.milestone ? "" : ` – ${format(e, "d MMM yyyy")}`}
          </dd>
          {!task.milestone && (
            <>
              <dt className="text-crm-muted-fg">Duration</dt>
              <dd>{durationDays(task)} days</dd>
            </>
          )}
          {task.assignee && (
            <>
              <dt className="text-crm-muted-fg">Owner</dt>
              <dd>{task.assignee}</dd>
            </>
          )}
          {slack != null && (
            <>
              <dt className="text-crm-muted-fg">Float</dt>
              <dd className={critical ? "text-crm-danger" : undefined}>
                {critical ? "Critical path" : `${slack} days`}
              </dd>
            </>
          )}
          {variance != null && (
            <>
              <dt className="text-crm-muted-fg">vs baseline</dt>
              <dd
                className={
                  variance > 0 ? "text-crm-danger" : variance < 0 ? "text-crm-success" : undefined
                }
              >
                {variance === 0 ? "On plan" : `${variance > 0 ? "+" : ""}${variance} days`}
              </dd>
            </>
          )}
        </dl>
      </div>
    </FloatingPortal>
  );
}
