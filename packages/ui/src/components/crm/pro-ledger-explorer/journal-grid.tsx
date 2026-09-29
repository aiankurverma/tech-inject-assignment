import * as React from "react";
import { createColumnHelper, flexRender, tableFeatures, useTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DisplayRow, JournalLine } from "@/components/crm/pro-ledger-explorer/ledger-model";

type LineRow = Extract<DisplayRow, { kind: "line" }>;
const features = tableFeatures({ columnMeta: {} as { num?: boolean } });
const col = createColumnHelper<typeof features, LineRow>();

export interface JournalGridProps {
  rows: DisplayRow[];
  formatMoney: (minor: number) => string;
  height: number;
  collapsed: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  onOpenLine: (line: JournalLine) => void;
  activeKey?: string | null;
}

const TEMPLATE = "96px 110px minmax(160px,1.4fr) minmax(160px,2fr) 120px 120px 130px";

/**
 * Virtualised journal. TanStack Table owns the column model (headers, cell renderers);
 * TanStack Virtual renders only visible rows, so 100k+ lines stay at a constant DOM size.
 */
export function JournalGrid({
  rows,
  formatMoney,
  height,
  collapsed,
  onToggleGroup,
  onOpenLine,
  activeKey,
}: JournalGridProps) {
  const columns = React.useMemo(
    () =>
      col.columns([
        col.accessor("date", {
          header: "Date",
          cell: (c) => format(c.getValue(), "dd MMM yyyy"),
        }),
        col.accessor((r) => r.entry.reference, { id: "ref", header: "Reference" }),
        col.accessor((r) => `${r.account.code} ${r.account.name}`, {
          id: "account",
          header: "Account",
          cell: (c) => (
            <span className="truncate">
              <span className="font-mono text-crm-faint">{c.row.original.account.code}</span>{" "}
              {c.row.original.account.name}
            </span>
          ),
        }),
        col.accessor((r) => r.memo || r.entry.description, { id: "desc", header: "Description" }),
        col.accessor("debit", {
          header: "Debit",
          meta: { num: true },
          cell: (c) => (c.getValue() ? formatMoney(c.getValue()) : ""),
        }),
        col.accessor("credit", {
          header: "Credit",
          meta: { num: true },
          cell: (c) => (c.getValue() ? formatMoney(c.getValue()) : ""),
        }),
        col.accessor("balance", {
          header: "Running bal.",
          meta: { num: true },
          cell: (c) => (
            <span className={cn(c.getValue() < 0 && "text-crm-danger")}>
              {formatMoney(c.getValue())}
            </span>
          ),
        }),
      ]),
    [formatMoney],
  );

  const lineRows = React.useMemo(() => rows.filter((r): r is LineRow => r.kind === "line"), [rows]);
  const table = useTable({
    features,
    data: lineRows,
    columns,
    getRowId: (r) => r.key,
  });
  const headers = table.getHeaderGroups()[0]?.headers ?? [];

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 34,
    overscan: 12,
  });
  const [focus, setFocus] = React.useState(0);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const max = rows.length - 1;
    let next = focus;
    if (e.key === "ArrowDown") next = Math.min(max, focus + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, focus - 1);
    else if (e.key === "PageDown") next = Math.min(max, focus + 15);
    else if (e.key === "PageUp") next = Math.max(0, focus - 15);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = max;
    else if (e.key === "Enter" || e.key === " ") {
      const r = rows[focus];
      if (!r) return;
      e.preventDefault();
      if (r.kind === "group") onToggleGroup(r.key);
      else onOpenLine(r);
      return;
    } else return;
    e.preventDefault();
    setFocus(next);
    virtualizer.scrollToIndex(next, { align: "auto" });
  };

  return (
    <div
      role="grid"
      aria-rowcount={rows.length + 1}
      aria-label="Journal lines"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="min-w-0 overflow-hidden rounded-crm border border-crm-border bg-crm-card focus:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
    >
      <div ref={scrollRef} style={{ height }} className="overflow-auto">
        <div style={{ minWidth: 860 }}>
          <div
            role="row"
            aria-rowindex={1}
            className="sticky top-0 z-10 grid border-b border-crm-border bg-crm-raised text-[11px] font-medium uppercase tracking-wide text-crm-muted-fg"
            style={{ gridTemplateColumns: TEMPLATE }}
          >
            {headers.map((h) => (
              <div
                role="columnheader"
                key={h.id}
                className={cn("px-3 py-2", h.column.columnDef.meta?.num && "text-right")}
              >
                {flexRender(h.column.columnDef.header, h.getContext())}
              </div>
            ))}
          </div>
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((v) => {
              const r = rows[v.index]!;
              const focused = v.index === focus;
              const base = {
                position: "absolute" as const,
                top: 0,
                left: 0,
                right: 0,
                height: v.size,
                transform: `translateY(${v.start}px)`,
              };
              if (r.kind === "group") {
                const open = !collapsed.has(r.key);
                return (
                  <div
                    key={`g:${r.key}`}
                    role="row"
                    aria-rowindex={v.index + 2}
                    aria-expanded={open}
                    style={{ ...base, gridTemplateColumns: TEMPLATE }}
                    onClick={() => {
                      setFocus(v.index);
                      onToggleGroup(r.key);
                    }}
                    className={cn(
                      "grid cursor-pointer items-center border-b border-crm-border bg-crm-muted/60 text-xs font-medium text-crm-fg",
                      focused && "ring-1 ring-inset ring-crm-ring",
                    )}
                  >
                    <div role="gridcell" className="col-span-4 flex items-center gap-1.5 px-3">
                      <ChevronRight
                        className={cn("size-3.5 transition-transform", open && "rotate-90")}
                      />
                      {r.label}
                      <span className="text-crm-muted-fg">({r.count.toLocaleString()})</span>
                    </div>
                    <div role="gridcell" className="px-3 text-right tabular-nums">
                      {formatMoney(r.debit)}
                    </div>
                    <div role="gridcell" className="px-3 text-right tabular-nums">
                      {formatMoney(r.credit)}
                    </div>
                    <div role="gridcell" className="px-3 text-right tabular-nums text-crm-muted-fg">
                      {formatMoney(r.debit - r.credit)}
                    </div>
                  </div>
                );
              }
              const row = table.getRow(r.key, true);
              return (
                <div
                  key={r.key}
                  role="row"
                  aria-rowindex={v.index + 2}
                  aria-selected={activeKey === r.key}
                  style={{ ...base, gridTemplateColumns: TEMPLATE }}
                  onClick={() => {
                    setFocus(v.index);
                    onOpenLine(r);
                  }}
                  className={cn(
                    "grid cursor-pointer items-center border-b border-crm-border/60 text-xs text-crm-fg hover:bg-crm-muted/50",
                    activeKey === r.key && "bg-crm-primary/10",
                    focused && "ring-1 ring-inset ring-crm-ring",
                  )}
                >
                  {row?.getAllCells().map((c) => (
                    <div
                      role="gridcell"
                      key={c.id}
                      className={cn(
                        "truncate px-3",
                        c.column.columnDef.meta?.num && "text-right tabular-nums",
                      )}
                    >
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
