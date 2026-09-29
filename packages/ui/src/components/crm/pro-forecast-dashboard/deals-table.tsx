import * as React from "react";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format as formatDate } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, MOVEMENT_LABEL } from "@/components/crm/pro-forecast-dashboard/model";
import type {
  ForecastCategory,
  ForecastDeal,
  Movement,
} from "@/components/crm/pro-forecast-dashboard/types";

export interface DealRow extends ForecastDeal {
  movement?: Movement;
  delta?: number;
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
  },
});

const col = createColumnHelper<typeof features, DealRow>();

const CAT_TONE: Record<ForecastCategory, string> = {
  closed: "border-tag-green-border bg-tag-green-bg text-tag-green-text",
  commit: "border-tag-purple-border bg-tag-purple-bg text-tag-purple-text",
  best: "border-tag-blue-border bg-tag-blue-bg text-tag-blue-text",
  pipeline: "border-tag-neutral-border bg-tag-neutral-bg text-tag-neutral-text",
  lost: "border-tag-red-border bg-tag-red-bg text-tag-red-text",
};

const ROW_H = 40;

export interface DealsTableProps {
  rows: DealRow[];
  format: (n: number) => string;
  /** Chips describing the active drilldown; each can be cleared. */
  filters: { id: string; label: string; onClear: () => void }[];
  onDealClick?: (deal: ForecastDeal) => void;
  height?: number;
}

/** Sortable, searchable, virtualized deal list (handles 10k+ rows). */
export function DealsTable({ rows, format, filters, onDealClick, height = 420 }: DealsTableProps) {
  const [query, setQuery] = React.useState("");
  const deferred = React.useDeferredValue(query);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "amount", desc: true }]);

  const data = React.useMemo(() => {
    const q = deferred.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.account.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q) ||
        r.stage.toLowerCase().includes(q),
    );
  }, [rows, deferred]);

  const columns = React.useMemo(
    () =>
      col.columns([
        col.accessor("name", {
          header: "Deal",
          sortFn: "alphanumeric",
          cell: (c) => <span className="font-medium text-crm-fg">{c.getValue()}</span>,
        }),
        col.accessor("account", { header: "Account", sortFn: "alphanumeric" }),
        col.accessor("owner", { header: "Owner", sortFn: "alphanumeric" }),
        col.accessor("stage", { header: "Stage", sortFn: "alphanumeric" }),
        col.accessor("category", {
          header: "Category",
          sortFn: "alphanumeric",
          cell: (c) => (
            <span
              className={cn(
                "inline-flex rounded-[5px] border px-1.5 text-xs leading-5",
                CAT_TONE[c.getValue()],
              )}
            >
              {CATEGORY_LABEL[c.getValue()]}
            </span>
          ),
        }),
        col.accessor("closeDate", {
          header: "Close",
          sortFn: "datetime",
          cell: (c) => formatDate(c.getValue(), "MMM d, yyyy"),
        }),
        col.accessor("amount", {
          header: "Amount",
          sortFn: "basic",
          sortDescFirst: true,
          cell: (c) => format(c.getValue()),
        }),
        col.accessor((r) => r.delta ?? 0, {
          id: "delta",
          header: "Change",
          sortFn: "basic",
          cell: (c) => {
            const r = c.row.original;
            if (!r.movement) return <span className="text-crm-faint">—</span>;
            const d = r.delta ?? 0;
            return (
              <span className={d >= 0 ? "text-crm-success" : "text-crm-danger"}>
                {d >= 0 ? "+" : "−"}
                {format(Math.abs(d))}
                <span className="ml-1 text-xs text-crm-subtle">{MOVEMENT_LABEL[r.movement]}</span>
              </span>
            );
          },
        }),
      ]),
    [format],
  );

  const table = useTable({
    features,
    columns,
    data,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (r) => r.id,
  });

  const tableRows = table.getRowModel().rows;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items[0]?.start ?? 0;
  const padBottom = items.length ? virtualizer.getTotalSize() - items[items.length - 1]!.end : 0;
  const total = React.useMemo(() => data.reduce((s, r) => s + r.amount, 0), [data]);
  const colCount = columns.length;

  return (
    <section
      aria-label="Deals"
      className="flex min-w-0 flex-col rounded-crm border border-crm-border bg-crm-card shadow-crm-raised"
    >
      <header className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2">
        <h3 className="text-sm font-medium text-crm-fg">Deals</h3>
        <span className="text-xs text-crm-muted-fg" aria-live="polite">
          {data.length.toLocaleString()} · {format(total)}
        </span>
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 rounded-full border border-crm-border bg-crm-raised py-0.5 pr-0.5 pl-2 text-xs text-crm-fg"
            >
              {f.label}
              <button
                type="button"
                onClick={f.onClear}
                aria-label={`Clear filter ${f.label}`}
                className="rounded-full p-0.5 text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <label className="ml-auto flex h-8 w-full items-center gap-1.5 rounded-[6px] border border-crm-input px-2 focus-within:border-crm-ring sm:w-56">
          <Search className="size-3.5 text-crm-muted-fg" aria-hidden />
          <span className="sr-only">Search deals</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deal, account, owner"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-crm-fg outline-none placeholder:text-crm-faint"
          />
        </label>
      </header>
      <div ref={scrollRef} className="overflow-auto" style={{ height }} tabIndex={0}>
        <table
          className="w-full min-w-[56rem] border-collapse text-sm"
          aria-rowcount={tableRows.length + 1}
        >
          <thead className="sticky top-0 z-10 bg-crm-card">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} aria-rowindex={1}>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  const right = h.column.id === "amount" || h.column.id === "delta";
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                      }
                      className={cn(
                        "border-b border-crm-border px-3 py-2 text-xs font-medium text-crm-muted-fg",
                        right ? "text-right" : "text-left",
                      )}
                    >
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                      >
                        <table.FlexRender header={h} />
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3" aria-hidden />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3" aria-hidden />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" aria-hidden />
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {tableRows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-3 py-10 text-center text-sm text-crm-muted-fg">
                  No deals match these filters.
                </td>
              </tr>
            )}
            {padTop > 0 && (
              <tr aria-hidden>
                <td colSpan={colCount} style={{ height: padTop, padding: 0 }} />
              </tr>
            )}
            {items.map((vi) => {
              const row = tableRows[vi.index]!;
              return (
                <tr
                  key={row.id}
                  aria-rowindex={vi.index + 2}
                  style={{ height: ROW_H }}
                  onClick={onDealClick ? () => onDealClick(row.original) : undefined}
                  className={cn(
                    "border-b border-crm-border text-crm-soft hover:bg-crm-raised",
                    onDealClick && "cursor-pointer",
                  )}
                >
                  {row.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "truncate px-3 whitespace-nowrap tabular-nums",
                        (cell.column.id === "amount" || cell.column.id === "delta") && "text-right",
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              );
            })}
            {padBottom > 0 && (
              <tr aria-hidden>
                <td colSpan={colCount} style={{ height: padBottom, padding: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
