import * as React from "react";
import {
  FloatingFocusManager,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { AlertTriangle, Lock, Repeat, Trash2, X } from "lucide-react";
import { Button } from "@/components/crm/button";
import { describeRecurrence } from "@/components/crm/pro-resource-scheduler/recurrence";
import type {
  SchedulerOccurrence,
  SchedulerResource,
} from "@/components/crm/pro-resource-scheduler/types";

export interface EventPopoverProps {
  occ: SchedulerOccurrence | null;
  anchor: HTMLElement | null;
  resource?: SchedulerResource;
  timeZone: string;
  conflict: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onDelete: (occ: SchedulerOccurrence, series: boolean) => void;
  renderDetails?: (occ: SchedulerOccurrence) => React.ReactNode;
}

export function EventPopover({
  occ,
  anchor,
  resource,
  timeZone,
  conflict,
  readOnly,
  onClose,
  onDelete,
  renderDetails,
}: EventPopoverProps) {
  const open = !!occ && !!anchor;
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (o) => !o && onClose(),
    elements: { reference: anchor },
    placement: "bottom-start",
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "dialog" });
  const { getFloatingProps } = useInteractions([dismiss, role]);
  if (!open || !occ) return null;
  const f = (t: number, p: string) => format(new TZDate(t, timeZone), p);
  const rec = describeRecurrence(occ.event);
  const canEdit = !readOnly && !occ.event.locked;

  return (
    <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus>
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        {...getFloatingProps()}
        aria-label={occ.event.title}
        className="z-50 w-72 animate-crm-in rounded-crm border border-crm-border bg-crm-popover p-3 text-xs text-crm-fg shadow-crm-raised"
      >
        <div className="flex items-start gap-2">
          <p className="flex-1 text-sm font-medium">{occ.event.title}</p>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-crm-muted-fg hover:text-crm-fg"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-crm-soft">
          {f(occ.start, "EEE d MMM, HH:mm")} –{" "}
          {f(occ.end, occ.end - occ.start > 864e5 ? "EEE d MMM, HH:mm" : "HH:mm")}
          <span className="ml-1 text-crm-muted-fg">({timeZone})</span>
        </p>
        {resource && <p className="mt-1 text-crm-muted-fg">{resource.name}</p>}
        {rec && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-crm-soft">
            <Repeat className="size-3" aria-hidden /> {rec}
          </p>
        )}
        {occ.event.locked && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-crm-muted-fg">
            <Lock className="size-3" aria-hidden /> Locked booking
          </p>
        )}
        {conflict && (
          <p className="mt-2 flex items-center gap-1.5 rounded-crm bg-crm-danger/10 p-2 text-crm-danger">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            Overlaps another booking on this resource.
          </p>
        )}
        {occ.event.meta && (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {Object.entries(occ.event.meta).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="text-crm-muted-fg">{k}</dt>
                <dd>{v}</dd>
              </React.Fragment>
            ))}
          </dl>
        )}
        {renderDetails?.(occ)}
        {canEdit && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button size="sm" variant="danger" onClick={() => onDelete(occ, false)}>
              <Trash2 className="size-3" /> {rec ? "Delete this one" : "Delete"}
            </Button>
            {rec && (
              <Button size="sm" variant="ghost" onClick={() => onDelete(occ, true)}>
                Delete series
              </Button>
            )}
          </div>
        )}
      </div>
    </FloatingFocusManager>
  );
}
