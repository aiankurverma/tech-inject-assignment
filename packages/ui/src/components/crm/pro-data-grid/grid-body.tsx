import * as React from "react";
import type { Row, RowData } from "@tanstack/react-table";
import type { VirtualItem } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import {
  CellEditor,
  CellValue,
  GroupCellValue,
  type EditMove,
} from "@/components/crm/pro-data-grid/cells";
import { formatValue, isNumeric, type GridFeatures } from "@/components/crm/pro-data-grid/engine";
import type { GridColumnInstance } from "@/components/crm/pro-data-grid/filters";
import type { ActiveCell } from "@/components/crm/pro-data-grid/types";

export interface EditingState {
  rowId: string;
  columnId: string;
  draft: string;
  error: string | null;
}

export interface ColumnLayout {
  column: GridColumnInstance;
  /** Index in the combined (start + center + end) visible column list. */
  index: number;
  width: number;
  pinned: false | "start" | "end";
  /** Sticky offset for pinned columns. */
  offset: number;
}

export interface GridRowProps {
  row: Row<GridFeatures, RowData>;
  rowIndex: number;
  item: VirtualItem;
  start: ColumnLayout[];
  center: ColumnLayout[];
  end: ColumnLayout[];
  padStart: number;
  padEnd: number;
  totalWidth: number;
  activeCol: number | null;
  editing: EditingState | null;
  cellId: (row: number, col: number) => string;
  currency: string;
  canEdit: (row: Row<GridFeatures, RowData>, column: GridColumnInstance) => boolean;
  onCellMouseDown: (cell: ActiveCell) => void;
  onCellDoubleClick: (cell: ActiveCell) => void;
  onDraftChange: (draft: string) => void;
  onCommit: (move: EditMove) => void;
  onCancel: () => void;
}

function GridRowImpl({
  row,
  rowIndex,
  item,
  start,
  center,
  end,
  padStart,
  padEnd,
  totalWidth,
  activeCol,
  editing,
  cellId,
  currency,
  canEdit,
  onCellMouseDown,
  onCellDoubleClick,
  onDraftChange,
  onCommit,
  onCancel,
}: GridRowProps) {
  const grouped = row.getIsGrouped();
  const firstIndex = start[0]?.index ?? center[0]?.index ?? end[0]?.index ?? 0;

  const renderCell = (l: ColumnLayout) => {
    const { column } = l;
    const spec = column.columnDef.meta!.spec;
    const type = spec.type ?? "text";
    const active = activeCol === l.index;
    const isEditing = editing?.columnId === column.id && editing.rowId === row.id;
    const editable = !grouped && canEdit(row, column);
    let content: React.ReactNode;
    if (grouped) {
      if (l.index === firstIndex) {
        content = (
          <GroupCellValue
            label={String(row.groupingValue ?? "")}
            count={row.getLeafRows().filter((r) => !r.getIsGrouped()).length}
            expanded={row.getIsExpanded()}
            depth={row.depth}
            onToggle={() => row.toggleExpanded()}
          />
        );
      } else if (spec.aggregate) {
        const v = row.getValue(column.id);
        content = (
          <span className="truncate font-medium text-crm-soft tabular-nums">
            {spec.aggregate === "count" || spec.aggregate === "uniqueCount"
              ? Number(v ?? 0).toLocaleString()
              : formatValue(type, v, spec.currency ?? currency)}
          </span>
        );
      } else content = null;
    } else if (isEditing && editing) {
      content = (
        <CellEditor
          spec={spec}
          draft={editing.draft}
          error={editing.error}
          onDraftChange={onDraftChange}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      );
    } else {
      content = (
        <CellValue
          spec={spec}
          value={row.getValue(column.id)}
          row={row.original as never}
          currency={currency}
        />
      );
    }
    const indent = !grouped && row.depth > 0 && l.index === firstIndex ? row.depth * 16 + 20 : 0;
    return (
      <div
        key={column.id}
        id={cellId(rowIndex, l.index)}
        role={grouped && l.index === firstIndex ? "rowheader" : "gridcell"}
        aria-colindex={l.index + 1}
        aria-selected={active || undefined}
        aria-readonly={!editable || undefined}
        onMouseDown={() => onCellMouseDown({ row: rowIndex, col: l.index })}
        onDoubleClick={() => onCellDoubleClick({ row: rowIndex, col: l.index })}
        style={{
          width: l.width,
          paddingInlineStart: indent ? indent : undefined,
          ...(l.pinned === "start" ? { position: "sticky", left: l.offset } : null),
          ...(l.pinned === "end" ? { position: "sticky", right: l.offset } : null),
        }}
        className={cn(
          "relative flex h-full shrink-0 items-center border-r border-b border-crm-border px-2 text-sm text-crm-fg",
          l.pinned ? "z-[1] bg-crm-card" : "bg-transparent",
          isNumeric(type) && "justify-end text-right tabular-nums",
          spec.align === "center" && "justify-center",
          editable && "cursor-cell",
          isEditing && "z-[5] px-0.5",
          active && !isEditing && "z-[2] outline-2 -outline-offset-2 outline-crm-primary",
        )}
      >
        {content}
      </div>
    );
  };

  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 2}
      aria-level={grouped || row.depth ? row.depth + 1 : undefined}
      aria-expanded={grouped ? row.getIsExpanded() : undefined}
      data-index={item.index}
      style={{ height: item.size, transform: `translateY(${item.start}px)`, width: totalWidth }}
      className={cn(
        "absolute top-0 left-0 flex",
        grouped ? "bg-crm-muted/60" : "hover:bg-crm-muted/40",
        activeCol !== null && !grouped && "bg-crm-primary/[0.06]",
      )}
    >
      {start.map(renderCell)}
      {padStart > 0 && <div aria-hidden style={{ width: padStart }} className="shrink-0" />}
      {center.map(renderCell)}
      {padEnd > 0 && <div aria-hidden style={{ width: padEnd }} className="shrink-0" />}
      {end.map(renderCell)}
    </div>
  );
}

/** Rows re-render only when their row object, the visible column window or their own edit changes. */
export const GridRow = React.memo(GridRowImpl) as typeof GridRowImpl;
