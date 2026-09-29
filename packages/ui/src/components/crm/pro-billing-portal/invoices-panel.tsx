import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { ArrowUpDown, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import {
  billingKeys,
  type BillingApi,
  type Invoice,
} from "@/components/crm/pro-billing-portal/billing-types";

const statusTone: Record<Invoice["status"], string> = {
  paid: "bg-crm-success/15 text-crm-success",
  open: "bg-crm-warning/15 text-crm-warning",
  void: "bg-crm-muted text-crm-muted-fg",
  uncollectible: "bg-crm-danger/15 text-crm-danger",
};

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  columnMeta: {} as { num?: boolean },
});
const col = createColumnHelper<typeof features, Invoice>();

export function InvoicesPanel({
  api,
  formatMoney,
}: {
  api: BillingApi;
  formatMoney: (m: number) => string;
}) {
  const q = useInfiniteQuery({
    queryKey: billingKeys.invoices,
    queryFn: ({ pageParam }) => api.listInvoices(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
  });
  const data = React.useMemo(() => q.data?.pages.flatMap((p) => p.invoices) ?? [], [q.data]);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "date", desc: true }]);

  const download = React.useCallback(
    (inv: Invoice) => {
      if (api.downloadInvoice) return void api.downloadInvoice(inv);
      if (inv.pdfUrl) window.open(inv.pdfUrl, "_blank", "noopener");
    },
    [api],
  );

  const columns = React.useMemo(
    () =>
      col.columns([
        col.accessor("number", { header: "Invoice", sortFn: "alphanumeric" }),
        col.accessor("date", {
          header: "Date",
          sortFn: "text",
          cell: (c) => format(parseISO(c.getValue()), "dd MMM yyyy"),
        }),
        col.accessor("amount", {
          header: "Amount",
          sortFn: "basic",
          meta: { num: true },
          cell: (c) => formatMoney(c.getValue()),
        }),
        col.accessor("status", {
          header: "Status",
          sortFn: "text",
          cell: (c) => (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] capitalize",
                statusTone[c.getValue()],
              )}
            >
              {c.getValue()}
            </span>
          ),
        }),
        col.display({
          id: "actions",
          header: () => <span className="sr-only">Download</span>,
          enableSorting: false,
          cell: (c) => (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Download ${c.row.original.number}`}
              disabled={!c.row.original.pdfUrl && !api.downloadInvoice}
              onClick={() => download(c.row.original)}
            >
              <Download className="size-3.5" /> PDF
            </Button>
          ),
        }),
      ]),
    [formatMoney, download, api.downloadInvoice],
  );

  const table = useTable({
    features,
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  });

  if (q.isError)
    return (
      <div role="alert" className="flex items-center gap-2 text-sm text-crm-danger">
        Could not load invoices.{" "}
        <Button size="sm" onClick={() => q.refetch()}>
          Retry
        </Button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-crm border border-crm-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-crm-raised text-left text-[11px] uppercase tracking-wide text-crm-muted-fg">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const num = h.column.columnDef.meta?.num;
                  const sort = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      aria-sort={sort ? (sort === "asc" ? "ascending" : "descending") : undefined}
                      className={cn("px-3 py-2 font-medium", num && "text-right")}
                    >
                      {h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 uppercase"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <ArrowUpDown className="size-3" />
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
            {q.isPending
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-t border-crm-border">
                    <td colSpan={5} className="px-3 py-2.5">
                      <div className="h-4 animate-pulse rounded bg-crm-muted" />
                    </td>
                  </tr>
                ))
              : table.getRowModel().rows.map((r) => (
                  <tr key={r.id} className="border-t border-crm-border hover:bg-crm-muted/40">
                    {r.getAllCells().map((c) => (
                      <td
                        key={c.id}
                        className={cn(
                          "px-3 py-2",
                          c.column.columnDef.meta?.num && "text-right tabular-nums",
                        )}
                      >
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
            {!q.isPending && data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-crm-muted-fg">
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {q.hasNextPage && (
        <Button className="w-fit" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
          Load older invoices
        </Button>
      )}
    </div>
  );
}
