import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { Header } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  EyeOff,
  Filter,
  Group,
  MoreHorizontal,
  Pin,
  PinOff,
  RotateCcw,
  Ungroup,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GridFeatures } from "@/components/crm/pro-data-grid/engine";
import { isNumeric } from "@/components/crm/pro-data-grid/engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GridHeader = Header<GridFeatures, any, unknown>;

export interface HeaderCellProps {
  header: GridHeader;
  domId: string;
  colIndex: number;
  active: boolean;
  style: React.CSSProperties;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  dropSide: "before" | "after" | null;
  onDragStart: (e: React.DragEvent, columnId: string) => void;
  onDragOver: (e: React.DragEvent, columnId: string) => void;
  onDrop: (e: React.DragEvent, columnId: string) => void;
  onDragEnd: () => void;
  onActivate: () => void;
  /** Number of active sort levels; the level index is shown when more than one. */
  sortLevels: number;
}

const menuItem =
  "flex cursor-default items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm text-crm-fg outline-none data-[highlighted]:bg-crm-muted data-[disabled]:opacity-40";

export function HeaderCell({
  header,
  domId,
  colIndex,
  active,
  style,
  menuOpen,
  onMenuOpenChange,
  dropSide,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onActivate,
  sortLevels,
}: HeaderCellProps) {
  const column = header.column;
  const spec = column.columnDef.meta?.spec;
  const sorted = column.getIsSorted();
  const sortIndex = column.getSortIndex();
  const pinned = column.getIsPinned();
  const numeric = isNumeric(spec?.type);

  return (
    <div
      id={domId}
      role="columnheader"
      aria-colindex={colIndex + 1}
      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
      data-active={active || undefined}
      draggable={!column.getIsResizing()}
      onDragStart={(e) => onDragStart(e, column.id)}
      onDragOver={(e) => onDragOver(e, column.id)}
      onDrop={(e) => onDrop(e, column.id)}
      onDragEnd={onDragEnd}
      onMouseDown={onActivate}
      style={style}
      className={cn(
        "group/h relative flex h-full shrink-0 items-center gap-1 border-r border-b border-crm-border bg-crm-card px-2 text-xs font-medium text-crm-soft select-none",
        pinned && "z-[3]",
        active && "outline-2 -outline-offset-2 outline-crm-primary",
      )}
    >
      {dropSide && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-1 w-0.5 rounded bg-crm-primary",
            dropSide === "before" ? "left-0" : "right-0",
          )}
        />
      )}
      <button
        type="button"
        tabIndex={-1}
        disabled={!column.getCanSort()}
        onClick={column.getToggleSortingHandler()}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1 truncate text-left outline-none disabled:cursor-default",
          numeric && "flex-row-reverse text-right",
        )}
        title={column.getCanSort() ? "Sort (Shift+click adds a sort level)" : undefined}
      >
        <span className="truncate">{spec?.header ?? column.id}</span>
        {sorted === "asc" && <ArrowUp className="size-3.5 shrink-0 text-crm-fg" aria-hidden />}
        {sorted === "desc" && <ArrowDown className="size-3.5 shrink-0 text-crm-fg" aria-hidden />}
        {sorted === false && column.getCanSort() && (
          <ChevronsUpDown
            className="size-3.5 shrink-0 opacity-0 group-hover/h:opacity-60"
            aria-hidden
          />
        )}
        {sortLevels > 1 && sorted !== false && (
          <span className="text-[10px] text-crm-muted-fg tabular-nums">{sortIndex + 1}</span>
        )}
      </button>
      {column.getIsFiltered() && (
        <Filter className="size-3 shrink-0 text-crm-primary" aria-label="Filtered" />
      )}
      {column.getIsGrouped() && (
        <Group className="size-3 shrink-0 text-crm-primary" aria-label="Grouped" />
      )}
      {pinned && <Pin className="size-3 shrink-0 text-crm-muted-fg" aria-label="Pinned" />}
      <DropdownMenu.Root open={menuOpen} onOpenChange={onMenuOpenChange} modal={false}>
        <DropdownMenu.Trigger
          tabIndex={-1}
          aria-label={`${spec?.header ?? column.id} column menu`}
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-[6px] text-crm-muted-fg outline-none hover:bg-crm-muted hover:text-crm-fg",
            menuOpen ? "opacity-100" : "opacity-0 group-hover/h:opacity-100",
          )}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-48 rounded-crm border border-crm-border bg-crm-popover p-1 font-crm shadow-crm-overlay"
          >
            <DropdownMenu.Item
              className={menuItem}
              disabled={!column.getCanSort()}
              onSelect={() => column.toggleSorting(false, false)}
            >
              <ArrowUp className="size-4" aria-hidden /> Sort ascending
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItem}
              disabled={!column.getCanSort()}
              onSelect={() => column.toggleSorting(true, false)}
            >
              <ArrowDown className="size-4" aria-hidden /> Sort descending
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItem}
              disabled={!column.getCanSort()}
              onSelect={() => column.toggleSorting(sorted === "asc", true)}
            >
              <ChevronsUpDown className="size-4" aria-hidden /> Add as sort level
            </DropdownMenu.Item>
            {sorted !== false && (
              <DropdownMenu.Item className={menuItem} onSelect={() => column.clearSorting()}>
                <RotateCcw className="size-4" aria-hidden /> Clear sort
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Separator className="my-1 h-px bg-crm-border" />
            {pinned !== "start" && (
              <DropdownMenu.Item
                className={menuItem}
                disabled={!column.getCanPin()}
                onSelect={() => column.pin("start")}
              >
                <Pin className="size-4" aria-hidden /> Pin to start
              </DropdownMenu.Item>
            )}
            {pinned !== "end" && (
              <DropdownMenu.Item
                className={menuItem}
                disabled={!column.getCanPin()}
                onSelect={() => column.pin("end")}
              >
                <Pin className="size-4 -scale-x-100" aria-hidden /> Pin to end
              </DropdownMenu.Item>
            )}
            {pinned && (
              <DropdownMenu.Item className={menuItem} onSelect={() => column.pin(false)}>
                <PinOff className="size-4" aria-hidden /> Unpin
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Separator className="my-1 h-px bg-crm-border" />
            <DropdownMenu.Item
              className={menuItem}
              disabled={!column.getCanGroup()}
              onSelect={() => column.toggleGrouping()}
            >
              {column.getIsGrouped() ? (
                <>
                  <Ungroup className="size-4" aria-hidden /> Ungroup
                </>
              ) : (
                <>
                  <Group className="size-4" aria-hidden /> Group by {spec?.header ?? column.id}
                </>
              )}
            </DropdownMenu.Item>
            <DropdownMenu.Item className={menuItem} onSelect={() => column.resetSize()}>
              <RotateCcw className="size-4" aria-hidden /> Reset width
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItem}
              disabled={!column.getCanHide()}
              onSelect={() => column.toggleVisibility(false)}
            >
              <EyeOff className="size-4" aria-hidden /> Hide column
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {column.getCanResize() && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${spec?.header ?? column.id}`}
          onMouseDown={(e) => {
            e.stopPropagation();
            header.getResizeHandler()(e);
          }}
          onTouchStart={(e) => header.getResizeHandler()(e)}
          onDoubleClick={() => column.resetSize()}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className={cn(
            "absolute top-0 -right-1 z-[4] h-full w-2 cursor-col-resize touch-none",
            "after:absolute after:inset-y-2 after:left-[3px] after:w-0.5 after:rounded after:bg-crm-primary after:opacity-0 hover:after:opacity-100",
            column.getIsResizing() && "after:opacity-100",
          )}
        />
      )}
    </div>
  );
}
