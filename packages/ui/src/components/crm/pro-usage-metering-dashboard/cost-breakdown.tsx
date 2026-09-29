import * as React from "react";
import {
  createColumnHelper,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatMoney,
  formatQuantity,
  type MeterSummary,
  type UsageRecord,
} from "@/components/crm/pro-usage-metering-dashboard/types";

export interface BreakdownRow {
  key: string;
  quantities: Record<string, number>;
  cost: number;
  share: number;
}

const FEATURES = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});
const ROW_H = 36;
const NONE = "(unattributed)";

/**
 * Allocates each meter's overage cost to a dimension (region, project, customer...) in proportion
 * to usage, then renders a sortable, virtualised TanStack table.
 */
export function CostBreakdown({
  records,
  summaries,
  dimensions,
  dimension,
  onDimensionChange,
  currency,
}: {
  records: UsageRecord[];
  summaries: MeterSummary[];
  dimensions: string[];
  dimension: string;
  onDimensionChange: (d: string) => void;
  currency: string;
}) {
  const rows = React.useMemo<BreakdownRow[]>(() => {
    const totals = new Map<string, number>();
    const byKey = new Map<string, Record<string, number>>();
    for (const r of records) {
      const k = r.dimensions?.[dimension] ?? NONE;
      let q = byKey.get(k);
      if (!q) byKey.set(k, (q = {}));
      q[r.meterId] = (q[r.meterId] ?? 0) + r.quantity;
      totals.set(r.meterId, (totals.get(r.meterId) ?? 0) + r.quantity);
    }
    const grand = summaries.reduce((s, m) => s + m.cost, 0) || 1;
    const out: BreakdownRow[] = [];
    for (const [key, quantities] of byKey) {
      let cost = 0;
      for (const s of summaries) {
        const t = totals.get(s.meter.id);
        if (t) cost += s.cost * ((quantities[s.meter.id] ?? 0) / t);
      }
      out.push({ key, quantities, cost, share: cost / grand });
    }
    return out;
  }, [records, summaries, dimension]);

  const [sorting, setSorting] = React.useState<SortingState>([{ id: "cost", desc: true }]);
  const columns = React.useMemo(() => {
    const h = createColumnHelper<typeof FEATURES, BreakdownRow>();
    return h.columns([
      h.accessor("key", { header: dimension, cell: (c) => c.getValue() }),
      ...summaries.map((s) =>
        h.accessor((r) => r.quantities[s.meter.id] ?? 0, {
          id: s.meter.id,
          header: s.meter.name,
          cell: (c) => formatQuantity(c.getValue<number>()),
          meta: { numeric: true },
        }),
      ),
      h.accessor("cost", {
        header: "Overage cost",
        cell: (c) => formatMoney(c.getValue(), currency),
        meta: { numeric: true },
      }),
      h.accessor("share", {
        header: "Share",
        cell: (c) => (
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-12 overflow-hidden rounded-full bg-crm-track" aria-hidden>
              <span
                className="block h-full bg-crm-primary"
                style={{ width: `${c.getValue() * 100}%` }}
              />
            </span>
            {(c.getValue() * 100).toFixed(1)}%
          </span>
        ),
        meta: { numeric: true },
      }),
    ]);
  }, [summaries, dimension, currency]);

  const table = useTable({
    features: FEATURES,
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const tableRows = table.getRowModel().rows;
  const virt = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });
  const items = virt.getVirtualItems();
  const padTop = items[0]?.start ?? 0;
  const padBottom = items.length ? virt.getTotalSize() - items[items.length - 1]!.end : 0;
  const colCount = columns.length;

  return (
    <section
      aria-labelledby="usage-breakdown-title"
      className="rounded-crm border border-crm-border bg-crm-card"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-crm-border px-4 py-3">
        <h3 id="usage-breakdown-title" className="text-sm font-medium text-crm-fg">
          Cost breakdown{" "}
          <span className="text-crm-muted-fg">({rows.length.toLocaleString()} rows)</span>
        </h3>
        <div
          role="radiogroup"
          aria-label="Break down by"
          className="flex rounded-crm bg-crm-muted p-0.5"
        >
          {dimensions.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={d === dimension}
              onClick={() => onDimensionChange(d)}
              className={cn(
                "rounded-crm px-2.5 py-1 text-xs capitalize text-crm-muted-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
                d === dimension && "bg-crm-raised text-crm-fg shadow-crm-raised",
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-crm-muted-fg">
          No usage recorded in this range.
        </p>
      ) : (
        <div
          ref={scrollRef}
          className="max-h-80 overflow-auto"
          tabIndex={0}
          aria-label="Cost breakdown table"
        >
          <table className="w-full border-collapse text-xs" aria-rowcount={tableRows.length + 1}>
            <thead className="sticky top-0 z-10 bg-crm-raised">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    const numeric = (
                      header.column.columnDef.meta as { numeric?: boolean } | undefined
                    )?.numeric;
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={
                          sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                        }
                        className={cn(
                          "px-3 py-2 font-medium text-crm-muted-fg",
                          numeric ? "text-right" : "text-left",
                        )}
                      >
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 capitalize hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {padTop > 0 && (
                <tr aria-hidden>
                  <td colSpan={colCount} style={{ height: padTop }} />
                </tr>
              )}
              {items.map((vi) => {
                const row = tableRows[vi.index]!;
                return (
                  <tr
                    key={row.id}
                    aria-rowindex={vi.index + 2}
                    className="border-t border-crm-border hover:bg-crm-muted/50"
                    style={{ height: ROW_H }}
                  >
                    {row.getAllCells().map((cell) => {
                      const numeric = (
                        cell.column.columnDef.meta as { numeric?: boolean } | undefined
                      )?.numeric;
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "whitespace-nowrap px-3 tabular-nums",
                            numeric ? "text-right text-crm-soft" : "text-crm-fg",
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {padBottom > 0 && (
                <tr aria-hidden>
                  <td colSpan={colCount} style={{ height: padBottom }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
