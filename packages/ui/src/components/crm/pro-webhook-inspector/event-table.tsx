import { memo, useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equals,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceStrict } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { OutcomeChip, StatusCodeChip } from "@/components/crm/pro-webhook-inspector/status-chip";
import type { WebhookRow } from "@/components/crm/pro-webhook-inspector/types";

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  filterFns: { equals: filterFn_equals, includesString: filterFn_includesString },
});

const col = createColumnHelper<typeof features, WebhookRow>();

const GRID = "grid grid-cols-[108px_minmax(0,1.4fr)_minmax(0,1fr)_64px_56px_92px]";
const ROW_H = 44;

export interface EventTableProps {
  rows: WebhookRow[];
  sorting: SortingState;
  onSortingChange: (s: SortingState) => void;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
  onVisibleCountChange?: (n: number) => void;
}

/** Sortable, filterable, virtualised event list (TanStack Table v9 + TanStack Virtual). */
export function EventTable({
  rows,
  sorting,
  onSortingChange,
  columnFilters,
  globalFilter,
  selectedId,
  onSelect,
  now,
  onVisibleCountChange,
}: EventTableProps) {
  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("outcome", { header: "Status", filterFn: "equals", sortFn: "alphanumeric" }),
        col.accessor("type", { header: "Event", sortFn: "alphanumeric" }),
        col.accessor("endpointId", {
          header: "Endpoint",
          filterFn: "equals",
          enableSorting: false,
        }),
        col.accessor("lastStatus", { header: "HTTP", sortFn: "basic" }),
        col.accessor("attemptCount", { header: "Tries", sortFn: "basic" }),
        col.accessor("lastAttemptAt", { header: "Last try", sortFn: "basic" }),
        col.accessor("id", { header: "Id", enableSorting: false }),
      ]),
    [],
  );

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (r) => r.id,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: (u) => onSortingChange(typeof u === "function" ? u(sorting) : u),
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (c) => c.id === "id" || c.id === "type",
  });

  const model = table.getRowModel().rows;
  useEffect(() => onVisibleCountChange?.(model.length), [model.length, onVisibleCountChange]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: model.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  const selectedIndex = useMemo(
    () => (selectedId ? model.findIndex((r) => r.id === selectedId) : -1),
    [model, selectedId],
  );

  const move = useCallback(
    (delta: number | "start" | "end") => {
      if (!model.length) return;
      const next =
        delta === "start"
          ? 0
          : delta === "end"
            ? model.length - 1
            : Math.min(
                model.length - 1,
                Math.max(0, (selectedIndex < 0 ? -1 : selectedIndex) + delta),
              );
      onSelect(model[next]!.id);
      virtualizer.scrollToIndex(next, { align: "auto" });
    },
    [model, selectedIndex, onSelect, virtualizer],
  );

  const onKeyDown = (e: KeyboardEvent) => {
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / ROW_H) - 1);
    const map: Record<string, number | "start" | "end"> = {
      ArrowDown: 1,
      ArrowUp: -1,
      j: 1,
      k: -1,
      PageDown: page,
      PageUp: -page,
      Home: "start",
      End: "end",
    };
    const d = map[e.key];
    if (d === undefined) return;
    e.preventDefault();
    move(d);
  };

  const headers = table.getHeaderGroups()[0]!.headers.filter((h) => h.column.id !== "id");

  return (
    <div
      role="grid"
      aria-label="Webhook events"
      aria-rowcount={model.length + 1}
      aria-activedescendant={selectedId ? `wh-row-${selectedId}` : undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex min-h-0 flex-1 flex-col outline-none focus-visible:ring-1 focus-visible:ring-crm-ring"
    >
      <div
        role="row"
        aria-rowindex={1}
        className={cn(GRID, "border-b border-crm-border px-3 py-2")}
      >
        {headers.map((h) => {
          const sorted = h.column.getIsSorted();
          const can = h.column.getCanSort();
          const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
          return (
            <div
              key={h.id}
              role="columnheader"
              aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
              className="text-[11px] font-medium uppercase tracking-wide text-crm-muted-fg"
            >
              {can ? (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={h.column.getToggleSortingHandler()}
                  className="inline-flex items-center gap-1 hover:text-crm-fg"
                >
                  {String(h.column.columnDef.header)}
                  <Icon className={cn("size-3", !sorted && "opacity-40")} />
                </button>
              ) : (
                String(h.column.columnDef.header)
              )}
            </div>
          );
        })}
      </div>
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        {model.length === 0 ? (
          <p className="p-8 text-center text-sm text-crm-muted-fg">
            No events match these filters.
          </p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize() }} className="relative">
            {virtualizer.getVirtualItems().map((v) => {
              const r = model[v.index]!.original;
              return (
                <EventRow
                  key={r.id}
                  row={r}
                  index={v.index}
                  top={v.start}
                  selected={r.id === selectedId}
                  onSelect={onSelect}
                  now={now}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const EventRow = memo(function EventRow({
  row,
  index,
  top,
  selected,
  onSelect,
  now,
}: {
  row: WebhookRow;
  index: number;
  top: number;
  selected: boolean;
  onSelect: (id: string) => void;
  now: number;
}) {
  return (
    <div
      id={`wh-row-${row.id}`}
      role="row"
      aria-rowindex={index + 2}
      aria-selected={selected}
      onClick={() => onSelect(row.id)}
      style={{ height: ROW_H, transform: `translateY(${top}px)` }}
      className={cn(
        GRID,
        "absolute inset-x-0 top-0 cursor-pointer items-center border-b border-crm-border px-3 text-xs",
        selected ? "bg-crm-muted" : "hover:bg-crm-raised",
      )}
    >
      <div role="gridcell">
        <OutcomeChip outcome={row.outcome} />
      </div>
      <div role="gridcell" className="min-w-0 pr-2">
        <div className="truncate font-medium text-crm-fg">{row.type}</div>
        <div className="truncate font-mono text-[10px] text-crm-muted-fg">{row.id}</div>
      </div>
      <div
        role="gridcell"
        className="truncate pr-2 font-mono text-[11px] text-crm-soft"
        title={row.endpointUrl}
      >
        {row.endpointUrl.replace(/^https?:\/\//, "")}
      </div>
      <div role="gridcell">
        {row.attemptCount ? (
          <StatusCodeChip code={row.lastStatus} />
        ) : (
          <span className="text-crm-subtle">-</span>
        )}
      </div>
      <div role="gridcell" className="tabular-nums text-crm-soft">
        {row.attemptCount}
      </div>
      <div role="gridcell" className="truncate text-crm-muted-fg">
        {Number.isFinite(row.lastAttemptAt)
          ? `${formatDistanceStrict(row.lastAttemptAt, now)} ago`
          : "never"}
      </div>
    </div>
  );
});
