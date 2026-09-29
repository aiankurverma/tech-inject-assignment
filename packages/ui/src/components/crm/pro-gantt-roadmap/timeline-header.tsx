import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  addDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachQuarterOfInterval,
  eachWeekOfInterval,
  format,
  isWeekend,
} from "date-fns";
import { cn } from "@/lib/utils";
import { dayIndex } from "@/lib/gantt-schedule";
import type { GanttZoom } from "@/components/crm/pro-gantt-roadmap/types";

export const DAY_WIDTH: Record<GanttZoom, number> = { day: 36, week: 12, quarter: 2.5 };

export interface ScaleCell {
  start: number;
  len: number;
  label: string;
  muted?: boolean;
}

function clip(cells: ScaleCell[], total: number) {
  return cells
    .map((c) => {
      const s = Math.max(0, c.start);
      const e = Math.min(total, c.start + c.len);
      return { ...c, start: s, len: e - s };
    })
    .filter((c) => c.len > 0);
}

/** Two-tier header cells for the given zoom, on the integer day axis. */
export function buildScale(origin: Date, total: number, zoom: GanttZoom) {
  const end = addDays(origin, total - 1);
  const interval = { start: origin, end };
  const span = (dates: Date[], next: (d: Date) => Date, label: (d: Date) => string) =>
    dates.map((d) => {
      const s = dayIndex(origin, d);
      return { start: s, len: dayIndex(origin, next(d)) - s, label: label(d) };
    });
  const months = (fmt: string) =>
    span(
      eachMonthOfInterval(interval),
      (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1),
      (d) => format(d, fmt),
    );
  if (zoom === "day")
    return {
      top: clip(months("MMMM yyyy"), total),
      bottom: eachDayOfInterval(interval).map((d, i) => ({
        start: i,
        len: 1,
        label: format(d, "d"),
        muted: isWeekend(d),
      })),
    };
  if (zoom === "week")
    return {
      top: clip(months("MMM yyyy"), total),
      bottom: clip(
        span(
          eachWeekOfInterval(interval, { weekStartsOn: 1 }),
          (d) => addDays(d, 7),
          (d) => format(d, "d MMM"),
        ),
        total,
      ),
    };
  return {
    top: clip(
      span(
        eachQuarterOfInterval(interval),
        (d) => new Date(d.getFullYear(), d.getMonth() + 3, 1),
        (d) => format(d, "QQQ yyyy"),
      ),
      total,
    ),
    bottom: clip(months("MMM"), total),
  };
}

export function TimelineHeader({
  scrollRef,
  origin,
  total,
  zoom,
  gridWidth,
  height,
  corner,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  origin: Date;
  total: number;
  zoom: GanttZoom;
  gridWidth: number;
  height: number;
  corner: React.ReactNode;
}) {
  const dw = DAY_WIDTH[zoom];
  const { top, bottom } = React.useMemo(
    () => buildScale(origin, total, zoom),
    [origin, total, zoom],
  );
  const cols = useVirtualizer({
    horizontal: true,
    count: bottom.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (bottom[i]?.len ?? 1) * dw,
    paddingStart: gridWidth,
    overscan: 6,
  });
  const half = height / 2;
  return (
    <div
      className="sticky top-0 z-30 border-b border-crm-border bg-crm-card"
      style={{ height, width: gridWidth + total * dw }}
      aria-hidden
    >
      <div
        className="sticky left-0 z-10 flex h-full items-end border-r border-crm-border bg-crm-card"
        style={{ width: gridWidth }}
      >
        {corner}
      </div>
      {top.map((c) => (
        <div
          key={`t${c.start}`}
          className="absolute top-0 truncate border-l border-crm-border px-2 text-xs leading-7 font-medium text-crm-soft"
          style={{ left: gridWidth + c.start * dw, width: c.len * dw, height: half }}
        >
          {c.len * dw > 40 ? c.label : ""}
        </div>
      ))}
      {cols.getVirtualItems().map((vi) => {
        const c = bottom[vi.index]!;
        return (
          <div
            key={vi.key}
            className={cn(
              "absolute truncate border-t border-l border-crm-border text-center text-[11px] leading-7 tabular-nums",
              c.muted ? "text-crm-subtle" : "text-crm-muted-fg",
            )}
            style={{ top: half, left: vi.start, width: vi.size, height: half }}
          >
            {vi.size > 18 ? c.label : ""}
          </div>
        );
      })}
    </div>
  );
}
