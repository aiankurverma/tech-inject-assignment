import * as React from "react";
import { useGantt } from "@/hooks/use-gantt-store";
import type { DayTask, ScheduleInfo } from "@/components/crm/pro-gantt-roadmap/types";

export interface DependencyLayerProps {
  /** Visible row range [first, last] from the virtualizer. */
  first: number;
  last: number;
  rowIndex: Map<string, number>;
  days: Map<string, DayTask>;
  preds: Map<string, string[]>;
  succs: Map<string, string[]>;
  rowIds: string[];
  schedule: ScheduleInfo;
  dayWidth: number;
  rowHeight: number;
  top: number;
  width: number;
  height: number;
  left: number;
}

/**
 * Finish-to-start arrows for rows in (or linked to) the rendered window only,
 * so cost is O(visible rows x degree), independent of total task count.
 */
export function DependencyLayer({
  first,
  last,
  rowIndex,
  days,
  preds,
  succs,
  rowIds,
  schedule,
  dayWidth: dw,
  rowHeight,
  top,
  width,
  height,
  left,
}: DependencyLayerProps) {
  const preview = useGantt((s) => s.preview);
  const showCritical = useGantt((s) => s.showCritical);
  const markerId = React.useId().replace(/:/g, "");

  const paths: React.ReactNode[] = [];
  const seen = new Set<string>();
  const pos = (id: string) => {
    const d = days.get(id);
    if (!d) return null;
    const p = preview?.id === id ? preview : null;
    return { s: (d.s + (p?.ds ?? 0)) * dw, e: (d.e + (p?.de ?? 0)) * dw };
  };
  const add = (from: string, to: string) => {
    const key = `${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    const ri = rowIndex.get(from);
    const rj = rowIndex.get(to);
    const a = pos(from);
    const b = pos(to);
    if (ri == null || rj == null || !a || !b) return;
    const y1 = ri * rowHeight + rowHeight / 2;
    const y2 = rj * rowHeight + rowHeight / 2;
    const x1 = a.e;
    const x2 = b.s;
    const d =
      x2 - 12 >= x1
        ? `M${x1} ${y1}H${x1 + 6}V${y2}H${x2 - 2}`
        : `M${x1} ${y1}H${x1 + 6}V${(y1 + y2) / 2}H${x2 - 10}V${y2}H${x2 - 2}`;
    const crit = showCritical && schedule.critical.has(from) && schedule.critical.has(to);
    const bad = schedule.violations.has(key);
    paths.push(
      <path
        key={key}
        d={d}
        fill="none"
        strokeWidth={crit ? 1.75 : 1.25}
        strokeDasharray={bad ? "4 3" : undefined}
        className={bad ? "stroke-crm-warning" : crit ? "stroke-crm-danger" : "stroke-crm-subtle"}
        markerEnd={`url(#${markerId}${bad ? "w" : crit ? "c" : "n"})`}
      />,
    );
  };
  for (let i = first; i <= last; i++) {
    const id = rowIds[i];
    if (!id) continue;
    for (const p of preds.get(id) ?? []) add(p, id);
    for (const s of succs.get(id) ?? []) add(id, s);
  }

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left, top, width, height }}
      width={width}
      height={height}
    >
      <defs>
        {(["n", "c", "w"] as const).map((k) => (
          <marker
            key={k}
            id={`${markerId}${k}`}
            viewBox="0 0 8 8"
            refX="6"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path
              d="M0 0L8 4L0 8z"
              className={
                k === "c" ? "fill-crm-danger" : k === "w" ? "fill-crm-warning" : "fill-crm-subtle"
              }
            />
          </marker>
        ))}
      </defs>
      {paths}
    </svg>
  );
}
