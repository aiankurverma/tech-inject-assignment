import * as React from "react";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNowStrict, format } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, KeyRound, RotateCw, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { UsageSparkline } from "@/components/crm/pro-api-key-manager/usage-sparkline";
import { keyStatus } from "@/hooks/use-api-key-manager";
import type { ApiKey, ApiKeyStatus } from "@/components/crm/pro-api-key-manager/types";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});
const helper = createColumnHelper<typeof features, ApiKey>();

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : undefined);
const sum = (u: number[] | undefined) => (u ? u.reduce((a, b) => a + b, 0) : 0);

const GRID =
  "grid grid-cols-[minmax(220px,1.6fr)_minmax(160px,1.2fr)_110px_120px_120px_150px_84px]";

export interface KeyTableProps {
  keys: ApiKey[];
  now: number;
  height: number;
  rowHeight?: number;
  scopeLabel: (id: string) => string;
  onRotate: (key: ApiKey) => void;
  onRevoke: (key: ApiKey) => void;
  disabled?: boolean;
  empty?: React.ReactNode;
  sorting: SortingState;
  onSortingChange: (s: SortingState) => void;
}

function StatusDot({ status }: { status: ApiKeyStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium uppercase tracking-wide",
        status === "active" && "bg-crm-success/15 text-crm-success",
        status === "expired" && "bg-crm-warning/15 text-crm-warning",
        status === "revoked" && "bg-crm-muted text-crm-muted-fg",
      )}
    >
      {status}
    </span>
  );
}

/** TanStack Table (sorting model) + TanStack Virtual rows, rendered with ARIA table roles. */
export function KeyTable({
  keys,
  now,
  height,
  rowHeight = 52,
  scopeLabel,
  onRotate,
  onRevoke,
  disabled,
  empty,
  sorting,
  onSortingChange,
}: KeyTableProps) {
  const columns = React.useMemo(
    () =>
      helper.columns([
        helper.accessor("name", { id: "name", header: "Key", sortFn: "alphanumeric" }),
        helper.accessor((k) => k.scopes.length, {
          id: "scopes",
          header: "Scopes",
          enableSorting: false,
        }),
        helper.accessor((k) => time(k.createdAt), {
          id: "createdAt",
          header: "Created",
          sortUndefined: "last",
        }),
        helper.accessor((k) => time(k.lastUsedAt), {
          id: "lastUsedAt",
          header: "Last used",
          sortUndefined: "last",
        }),
        helper.accessor((k) => time(k.expiresAt), {
          id: "expiresAt",
          header: "Expires",
          sortUndefined: "last",
        }),
        helper.accessor((k) => sum(k.usage), { id: "usage", header: "Usage (14d)" }),
        helper.display({ id: "actions", header: "Actions" }),
      ]),
    [],
  );

  const table = useTable({
    features,
    columns,
    data: keys,
    getRowId: (k) => k.id,
    state: { sorting },
    onSortingChange: (u) => onSortingChange(typeof u === "function" ? u(sorting) : u),
    enableSortingRemoval: true,
  });

  const rows = table.getRowModel().rows;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    getItemKey: (i) => rows[i]?.id ?? i,
    overscan: 8,
  });

  const headers = table.getHeaderGroups()[0]?.headers ?? [];

  return (
    <div
      role="table"
      aria-label="API keys"
      aria-rowcount={rows.length + 1}
      className="min-w-[980px] text-[13px]"
    >
      <div role="rowgroup">
        <div
          role="row"
          aria-rowindex={1}
          className={cn(GRID, "border-b border-crm-border bg-crm-raised px-3")}
        >
          {headers.map((h) => {
            const sortable = h.column.getCanSort();
            const dir = h.column.getIsSorted();
            return (
              <div
                key={h.id}
                role="columnheader"
                aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                className={cn(
                  "flex h-9 items-center text-xs font-medium text-crm-muted-fg",
                  h.id === "actions" && "justify-end",
                )}
              >
                {sortable ? (
                  <button
                    type="button"
                    onClick={h.column.getToggleSortingHandler()}
                    className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-crm-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-crm-ring"
                  >
                    <table.FlexRender header={h} />
                    {dir === "asc" ? (
                      <ArrowUp className="size-3" aria-hidden />
                    ) : dir === "desc" ? (
                      <ArrowDown className="size-3" aria-hidden />
                    ) : (
                      <ArrowUpDown className="size-3 opacity-40" aria-hidden />
                    )}
                  </button>
                ) : (
                  <span className={h.id === "actions" ? "sr-only" : undefined}>
                    <table.FlexRender header={h} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div ref={scrollRef} role="rowgroup" className="overflow-y-auto" style={{ height }}>
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-crm-muted-fg">
            {empty}
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const row = rows[vi.index]!;
              const k = row.original;
              const status = keyStatus(k, now);
              const inactive = status !== "active";
              const expSoon = !inactive && k.expiresAt && Date.parse(k.expiresAt) - now < 7 * 864e5;
              return (
                <div
                  key={row.id}
                  role="row"
                  aria-rowindex={vi.index + 2}
                  className={cn(
                    GRID,
                    "absolute inset-x-0 items-center border-b border-crm-border px-3 hover:bg-crm-raised/60",
                    inactive && "text-crm-muted-fg",
                  )}
                  style={{ height: vi.size, transform: `translateY(${vi.start}px)` }}
                >
                  <div role="cell" className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-md border border-crm-border",
                        k.environment === "live" ? "text-crm-success" : "text-crm-warning",
                      )}
                      aria-hidden
                    >
                      <KeyRound className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("truncate font-medium", !inactive && "text-crm-fg")}>
                          {k.name}
                        </span>
                        {inactive ? <StatusDot status={status} /> : null}
                      </div>
                      <div
                        className="truncate font-mono text-[11px] text-crm-muted-fg"
                        aria-label={`Key ending in ${k.last4}`}
                      >
                        {k.prefix}••••••••{k.last4}
                      </div>
                    </div>
                  </div>
                  <div
                    role="cell"
                    className="flex min-w-0 flex-wrap gap-1 overflow-hidden pr-2"
                    title={k.scopes.join(", ")}
                  >
                    {k.scopes.slice(0, 2).map((s) => (
                      <span
                        key={s}
                        className="truncate rounded border border-crm-border bg-crm-raised px-1.5 py-px font-mono text-[11px]"
                      >
                        {scopeLabel(s)}
                      </span>
                    ))}
                    {k.scopes.length > 2 ? (
                      <span className="rounded px-1 py-px text-[11px] text-crm-muted-fg">
                        +{k.scopes.length - 2}
                      </span>
                    ) : null}
                  </div>
                  <div role="cell" title={format(Date.parse(k.createdAt), "PPpp")}>
                    {format(Date.parse(k.createdAt), "MMM d, yyyy")}
                  </div>
                  <div role="cell">
                    {k.lastUsedAt
                      ? formatDistanceToNowStrict(Date.parse(k.lastUsedAt), { addSuffix: true })
                      : "Never"}
                  </div>
                  <div role="cell" className={cn(expSoon && "text-crm-warning")}>
                    {status === "revoked"
                      ? "Revoked"
                      : k.expiresAt
                        ? formatDistanceToNowStrict(Date.parse(k.expiresAt), { addSuffix: true })
                        : "Never"}
                  </div>
                  <div role="cell">
                    <UsageSparkline data={k.usage} muted={inactive} />
                  </div>
                  <div role="cell" className="flex justify-end gap-1">
                    <button
                      type="button"
                      disabled={disabled || status === "revoked"}
                      onClick={() => onRotate(k)}
                      aria-label={`Rotate ${k.name}`}
                      title="Rotate"
                      className="rounded-md p-1.5 text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-crm-ring disabled:pointer-events-none disabled:opacity-30"
                    >
                      <RotateCw className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={disabled || status === "revoked"}
                      onClick={() => onRevoke(k)}
                      aria-label={`Revoke ${k.name}`}
                      title="Revoke"
                      className="rounded-md p-1.5 text-crm-soft hover:bg-crm-danger/15 hover:text-crm-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-crm-ring disabled:pointer-events-none disabled:opacity-30"
                    >
                      <Ban className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
