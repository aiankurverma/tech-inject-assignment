import * as React from "react";
import { useStore } from "zustand";
import { format } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { AlertTriangle, Lock, Repeat } from "lucide-react";
import type { RowLayout } from "@/components/crm/pro-resource-scheduler/layout";
import type { SchedulerStore } from "@/components/crm/pro-resource-scheduler/store";
import type { TimeScale } from "@/components/crm/pro-resource-scheduler/time-scale";
import type {
  DragMode,
  SchedulerOccurrence,
  SchedulerResource,
} from "@/components/crm/pro-resource-scheduler/types";
import { cn } from "@/lib/utils";

export const LANE_H = 26;
export const ROW_PAD = 6;
export const rowHeight = (lanes: number) => Math.max(1, lanes) * LANE_H + ROW_PAD * 2;

export interface ResourceRowProps {
  resource: SchedulerResource;
  layout: RowLayout;
  scale: TimeScale;
  conflicts: ReadonlySet<string>;
  store: SchedulerStore;
  labelWidth: number;
  onPointerDown: (
    e: React.PointerEvent,
    mode: DragMode,
    target: { occ?: SchedulerOccurrence; resourceId: string },
  ) => void;
  onKeyNudge: (occ: SchedulerOccurrence, e: React.KeyboardEvent) => void;
  setBarRef: (key: string, el: HTMLElement | null) => void;
  rowIndex: number;
}

const fmt = (t: number, tz: string, f: string) => format(new TZDate(t, tz), f);

export const ResourceRow = React.memo(function ResourceRow({
  resource,
  layout,
  scale,
  conflicts,
  store,
  labelWidth,
  onPointerDown,
  onKeyNudge,
  setBarRef,
  rowIndex,
}: ResourceRowProps) {
  // Subscribe only to the drag preview that concerns this row.
  const drag = useStore(store, (s) =>
    s.drag && s.drag.resourceId === resource.id ? s.drag : null,
  );
  const draggingKey = useStore(store, (s) => s.drag?.key ?? null);
  const selectedKey = useStore(store, (s) => s.selectedKey);
  const tz = scale.timeZone;
  const timeFmt = scale.view === "month" ? "MMM d" : "HH:mm";

  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 2}
      data-resource-id={resource.id}
      className="flex border-b border-crm-border"
      style={{ height: rowHeight(layout.lanes), width: labelWidth + scale.width }}
    >
      <div
        role="rowheader"
        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-crm-border bg-crm-card px-3"
        style={{ width: labelWidth }}
      >
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ background: resource.color ?? "var(--color-crm-primary)" }}
        />
        <div className="min-w-0">
          <p
            className={cn("truncate text-xs text-crm-fg", resource.disabled && "text-crm-muted-fg")}
          >
            {resource.name}
          </p>
          {resource.subtitle && (
            <p className="truncate text-[11px] text-crm-muted-fg">{resource.subtitle}</p>
          )}
        </div>
      </div>
      <div
        role="gridcell"
        aria-label={`${resource.name} timeline`}
        className={cn(
          "relative shrink-0",
          resource.disabled ? "cursor-not-allowed bg-crm-muted/20" : "cursor-crosshair",
        )}
        style={{ width: scale.width }}
        onPointerDown={(e) => onPointerDown(e, "create", { resourceId: resource.id })}
      >
        {layout.items.map((o) => {
          const hidden = draggingKey === o.key;
          const x = scale.toX(Math.max(o.start, scale.start));
          const w = Math.max(6, scale.toX(Math.min(o.end, scale.end)) - x);
          const conflict = conflicts.has(o.key);
          const color = o.event.color ?? resource.color ?? "var(--color-crm-primary)";
          const label = `${o.event.title}, ${fmt(o.start, tz, "EEE MMM d HH:mm")} to ${fmt(o.end, tz, "HH:mm")}${conflict ? ", conflicts with another booking" : ""}${o.event.locked ? ", locked" : ""}`;
          return (
            <div
              key={o.key}
              ref={(el) => setBarRef(o.key, el)}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={selectedKey === o.key}
              title={label}
              onPointerDown={(e) => onPointerDown(e, "move", { occ: o, resourceId: resource.id })}
              onKeyDown={(e) => onKeyNudge(o, e)}
              className={cn(
                "group absolute flex items-center gap-1 overflow-hidden rounded-[6px] border px-1.5 text-[11px] text-crm-fg select-none",
                "outline-none focus-visible:ring-2 focus-visible:ring-crm-fg",
                o.event.locked ? "cursor-default" : "cursor-grab active:cursor-grabbing",
                conflict ? "border-crm-danger" : "border-transparent",
                selectedKey === o.key && "ring-2 ring-crm-fg",
                hidden && "opacity-30",
              )}
              style={{
                left: x,
                width: w,
                top: ROW_PAD + o.lane * LANE_H,
                height: LANE_H - 4,
                background: `color-mix(in oklab, ${color} 32%, var(--color-crm-card))`,
                boxShadow: `inset 3px 0 0 ${color}`,
              }}
            >
              {!o.event.locked && (
                <span
                  aria-hidden
                  onPointerDown={(e) =>
                    onPointerDown(e, "resize-start", { occ: o, resourceId: resource.id })
                  }
                  className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize"
                />
              )}
              {conflict && (
                <AlertTriangle className="size-3 shrink-0 text-crm-danger" aria-hidden />
              )}
              {o.event.locked && <Lock className="size-3 shrink-0 text-crm-muted-fg" aria-hidden />}
              {o.occurrenceStart !== undefined && (
                <Repeat className="size-3 shrink-0 text-crm-soft" aria-hidden />
              )}
              <span className="truncate font-medium">{o.event.title}</span>
              {w > 120 && (
                <span className="shrink-0 text-crm-soft">{fmt(o.start, tz, timeFmt)}</span>
              )}
              {!o.event.locked && (
                <span
                  aria-hidden
                  onPointerDown={(e) =>
                    onPointerDown(e, "resize-end", { occ: o, resourceId: resource.id })
                  }
                  className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize"
                />
              )}
            </div>
          );
        })}
        {drag && (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute z-20 flex items-center rounded-[6px] border-2 border-dashed px-1.5 text-[11px] font-medium",
              drag.conflict
                ? "border-crm-danger bg-crm-danger/20 text-crm-danger"
                : "border-crm-primary bg-crm-primary/25 text-crm-fg",
            )}
            style={{
              left: scale.toX(drag.start),
              width: Math.max(6, scale.toX(drag.end) - scale.toX(drag.start)),
              top: ROW_PAD,
              height: LANE_H - 4,
            }}
          >
            <span className="truncate">
              {fmt(drag.start, tz, timeFmt)} – {fmt(drag.end, tz, timeFmt)}
              {drag.conflict ? " · conflict" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
