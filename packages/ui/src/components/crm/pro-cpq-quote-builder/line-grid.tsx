import * as React from "react";
import {
  columnSizingFeature,
  createSortedRowModel,
  flexRender,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ShieldAlert, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { formatBp } from "@/components/crm/pro-cpq-quote-builder/money";
import { describeTiers } from "@/components/crm/pro-cpq-quote-builder/pricing";
import type { PricedLine, QuoteLine } from "@/components/crm/pro-cpq-quote-builder/types";

export interface LineGridProps {
  lines: readonly PricedLine[];
  format: (minor: number) => string;
  formatNative: (minor: number, currency: string) => string;
  readOnly?: boolean;
  height?: number;
  onUpdate: (ids: readonly string[], patch: Partial<Omit<QuoteLine, "id">>) => void;
  onRemove: (ids: readonly string[]) => void;
}

const TERMS = [1, 12, 24, 36, 48, 60];

const features = tableFeatures({
  columnSizingFeature,
  rowSortingFeature,
  rowSelectionFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

/**
 * Commit-on-blur numeric cell. Keeps a local draft so typing never re-prices a 10k-line quote on
 * every keystroke; Enter commits, Escape reverts.
 */
const NumberCell = React.memo(function NumberCell({
  value,
  onCommit,
  label,
  suffix,
  min = 0,
  max,
  step = 1,
  disabled,
  invalid,
}: {
  value: number;
  onCommit: (v: number) => void;
  label: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [draft, setDraft] = React.useState(String(value));
  React.useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || draft.trim() === "") return setDraft(String(value));
    const clamped = Math.min(max ?? Infinity, Math.max(min, n));
    if (clamped !== value) onCommit(clamped);
    else setDraft(String(value));
  };
  return (
    <span className="relative inline-flex items-center">
      <input
        inputMode="decimal"
        aria-label={label}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        value={draft}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(String(value));
        }}
        className={cn(
          "h-7 w-20 rounded-crm border bg-crm-input px-2 text-right text-xs text-crm-fg tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-50",
          suffix && "pr-5",
          invalid ? "border-crm-warning" : "border-crm-border",
        )}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-1.5 text-[10px] text-crm-subtle">
          {suffix}
        </span>
      ) : null}
    </span>
  );
});

/** Virtualised, sortable, multi-select line grid built on TanStack Table + TanStack Virtual. */
export function LineGrid({
  lines,
  format,
  formatNative,
  readOnly,
  height = 420,
  onUpdate,
  onRemove,
}: LineGridProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDiscount, setBulkDiscount] = React.useState("10");
  const updateRef = React.useRef(onUpdate);
  updateRef.current = onUpdate;

  const columns = React.useMemo<ColumnDef<typeof features, PricedLine>[]>(
    () => [
      {
        id: "select",
        size: 36,
        enableSorting: false,
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all lines"
            checked={table.getIsAllRowsSelected()}
            ref={(el) => {
              if (el) el.indeterminate = table.getIsSomeRowsSelected();
            }}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="size-3.5 accent-[var(--crm-primary,#6d5bff)]"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.product.name}`}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="size-3.5 accent-[var(--crm-primary,#6d5bff)]"
          />
        ),
      },
      {
        id: "product",
        header: "Product",
        size: 260,
        accessorFn: (r) => r.product.name,
        cell: ({ row }) => {
          const { product, line } = row.original;
          return (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-crm-fg">{product.name}</p>
              <p
                className="truncate text-[11px] text-crm-subtle"
                title={describeTiers(product, (m) => formatNative(m, product.currency))}
              >
                {product.sku}
                {product.model !== "flat" ? ` · ${product.model}` : ""}
                {line.bundleName ? ` · ${line.bundleName}` : ""}
              </p>
            </div>
          );
        },
      },
      {
        id: "quantity",
        header: "Qty",
        size: 96,
        accessorFn: (r) => r.line.quantity,
        cell: ({ row }) => (
          <NumberCell
            label={`${row.original.product.name} quantity`}
            value={row.original.line.quantity}
            min={row.original.product.minQty ?? 0}
            disabled={readOnly}
            onCommit={(v) => updateRef.current([row.original.line.id], { quantity: v })}
          />
        ),
      },
      {
        id: "unit",
        header: "Unit",
        size: 100,
        accessorFn: (r) => r.unitPrice,
        cell: ({ row }) => (
          <span className="text-xs text-crm-muted-fg tabular-nums">
            {format(row.original.unitPrice)}
          </span>
        ),
      },
      {
        id: "term",
        header: "Term",
        size: 96,
        accessorFn: (r) => r.line.termMonths,
        cell: ({ row }) =>
          row.original.product.billing === "one-time" ? (
            <span className="text-[11px] text-crm-subtle">One-time</span>
          ) : (
            <select
              aria-label={`${row.original.product.name} term`}
              disabled={readOnly}
              value={row.original.line.termMonths}
              onChange={(e) =>
                updateRef.current([row.original.line.id], { termMonths: Number(e.target.value) })
              }
              className="h-7 rounded-crm border border-crm-border bg-crm-input px-1.5 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              {TERMS.filter((t) => t > 1 || row.original.product.billing === "monthly").map((t) => (
                <option key={t} value={t}>
                  {t} mo
                </option>
              ))}
            </select>
          ),
      },
      {
        id: "discount",
        header: "Disc.",
        size: 100,
        accessorFn: (r) => r.line.discountBp,
        cell: ({ row }) => (
          <NumberCell
            label={`${row.original.product.name} discount percent`}
            value={row.original.line.discountBp / 100}
            max={100}
            step={0.5}
            suffix="%"
            invalid={row.original.needsApproval}
            disabled={readOnly}
            onCommit={(v) =>
              updateRef.current([row.original.line.id], { discountBp: Math.round(v * 100) })
            }
          />
        ),
      },
      {
        id: "list",
        header: "List",
        size: 110,
        accessorFn: (r) => r.listTotal,
        cell: ({ row }) => (
          <span className="text-xs text-crm-muted-fg tabular-nums">
            {format(row.original.listTotal)}
          </span>
        ),
      },
      {
        id: "net",
        header: "Net",
        size: 120,
        accessorFn: (r) => r.netTotal,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-crm-fg tabular-nums">
            {row.original.needsApproval ? (
              <ShieldAlert
                className="size-3.5 text-crm-warning"
                aria-label={`Over rep ceiling of ${formatBp(row.original.ceilingBp)}`}
              />
            ) : null}
            {format(row.original.netTotal)}
          </span>
        ),
      },
      {
        id: "actions",
        size: 44,
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) =>
          readOnly ? null : (
            <button
              type="button"
              aria-label={`Remove ${row.original.product.name}`}
              onClick={() => onRemove([row.original.line.id])}
              className="grid size-7 place-items-center rounded-crm text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-danger focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          ),
      },
    ],
    [format, formatNative, readOnly, onRemove],
  );

  const table = useTable({
    features,
    data: lines as PricedLine[],
    columns,
    state: { sorting, rowSelection },
    getRowId: (r) => r.line.id,
    enableRowSelection: !readOnly,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
  });

  const rows = table.getRowModel().rows;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items[0]?.start ?? 0;
  const padBottom = items.length ? virtualizer.getTotalSize() - items[items.length - 1]!.end : 0;
  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const colCount = columns.length;

  return (
    <div className="flex flex-col gap-2">
      {selectedIds.length > 0 && !readOnly ? (
        <div
          role="toolbar"
          aria-label="Bulk line actions"
          className="flex flex-wrap items-center gap-2 rounded-crm bg-crm-muted px-3 py-1.5 text-xs text-crm-fg"
        >
          <span className="tabular-nums">{selectedIds.length.toLocaleString()} selected</span>
          <label className="ml-auto flex items-center gap-1.5 text-crm-muted-fg">
            Discount %
            <input
              aria-label="Bulk discount percent"
              inputMode="decimal"
              value={bulkDiscount}
              onChange={(e) => setBulkDiscount(e.target.value)}
              className="h-7 w-14 rounded-crm border border-crm-border bg-crm-input px-2 text-right text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            />
          </label>
          <Button
            size="sm"
            onClick={() =>
              onUpdate(selectedIds, {
                discountBp: Math.round(Math.min(100, Math.max(0, Number(bulkDiscount) || 0)) * 100),
              })
            }
          >
            Apply
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              onRemove(selectedIds);
              setRowSelection({});
            }}
          >
            Remove
          </Button>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        style={{ height }}
        className="overflow-auto rounded-crm border border-crm-border bg-crm-card"
      >
        <table
          className="w-full min-w-[900px] table-fixed border-collapse text-left"
          aria-rowcount={rows.length + 1}
        >
          <colgroup>
            {table.getAllLeafColumns().map((c) => (
              <col key={c.id} style={{ width: c.getSize() }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-crm-raised">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  const numeric = !["select", "product", "actions"].includes(h.column.id);
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={cn(
                        "h-8 border-b border-crm-border px-2 text-[11px] font-medium text-crm-subtle",
                        numeric && "text-right",
                      )}
                    >
                      {h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 rounded outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" aria-hidden />
                          ) : null}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="p-10 text-center text-xs text-crm-subtle">
                  No lines yet. Add a bundle above to start the quote.
                </td>
              </tr>
            ) : null}
            {padTop > 0 ? (
              <tr aria-hidden style={{ height: padTop }}>
                <td colSpan={colCount} />
              </tr>
            ) : null}
            {items.map((vi) => {
              const row = rows[vi.index]!;
              return (
                <tr
                  key={row.id}
                  aria-rowindex={vi.index + 2}
                  aria-selected={row.getIsSelected() || undefined}
                  style={{ height: 44 }}
                  className={cn(
                    "border-b border-crm-border/60",
                    row.getIsSelected() ? "bg-crm-primary/10" : "hover:bg-crm-muted/40",
                  )}
                >
                  {row.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-2",
                        !["select", "product", "actions"].includes(cell.column.id) && "text-right",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {padBottom > 0 ? (
              <tr aria-hidden style={{ height: padBottom }}>
                <td colSpan={colCount} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
