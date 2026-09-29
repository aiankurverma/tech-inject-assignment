import * as React from "react";
import { format } from "date-fns";
import { ChevronRight, Diamond } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GanttRow } from "@/components/crm/pro-gantt-roadmap/types";

function CellImpl({
  row,
  width,
  start,
  days,
  critical,
  selected,
  onToggle,
}: {
  row: GanttRow;
  width: number;
  start: Date;
  days: number;
  critical: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const { task, depth, hasChildren, expanded } = row;
  return (
    <div
      className={cn(
        "sticky left-0 z-20 flex h-full items-center border-r border-crm-border text-sm",
        selected ? "bg-crm-muted" : "bg-crm-card group-hover/row:bg-crm-raised",
      )}
      style={{ width }}
    >
      <div
        role="gridcell"
        className="flex min-w-0 flex-1 items-center gap-1"
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        {hasChildren ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={expanded ? "Collapse" : "Expand"}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(task.id);
            }}
            className="flex size-5 shrink-0 items-center justify-center rounded text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg"
          >
            <ChevronRight
              className={cn("size-3.5 transition-transform", expanded && "rotate-90")}
              aria-hidden
            />
          </button>
        ) : (
          <span className="flex size-5 shrink-0 items-center justify-center">
            {task.milestone ? (
              <Diamond className="size-3 text-crm-warning" aria-hidden />
            ) : (
              <span
                className={cn("size-1.5 rounded-full", critical ? "bg-crm-danger" : "bg-crm-faint")}
              />
            )}
          </span>
        )}
        <span className={cn("truncate", hasChildren ? "font-medium text-crm-fg" : "text-crm-soft")}>
          {task.name}
        </span>
      </div>
      <div role="gridcell" className="w-16 shrink-0 text-xs text-crm-muted-fg tabular-nums">
        {format(start, "d MMM")}
      </div>
      <div
        role="gridcell"
        className="w-10 shrink-0 pr-3 text-right text-xs text-crm-muted-fg tabular-nums"
      >
        {task.milestone ? "—" : `${days}d`}
      </div>
    </div>
  );
}

export const GridCell = React.memo(CellImpl);
