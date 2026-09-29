import * as React from "react";
import {
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Bot, KeyRound, Loader2, ShieldAlert, User } from "lucide-react";
import {
  actionTone,
  formatEventTime,
  formatFullTime,
  toneClass,
} from "@/components/crm/pro-audit-log/format";
import type {
  AuditColumnId,
  AuditEvent,
  AuditTimeMode,
} from "@/components/crm/pro-audit-log/types";
import { cn } from "@/lib/utils";

const features = tableFeatures({ columnSizingFeature, columnVisibilityFeature });
const helper = createColumnHelper<typeof features, AuditEvent>();

const ActorIcon = ({ kind }: { kind?: string }) => {
  const Icon = kind === "service" || kind === "system" ? Bot : kind === "api_key" ? KeyRound : User;
  return <Icon className="size-3.5 shrink-0 text-crm-muted-fg" aria-hidden />;
};

function buildColumns(timeMode: AuditTimeMode) {
  return [
    helper.accessor("occurredAt", {
      id: "time",
      header: "Time",
      size: 170,
      cell: (c) => (
        <time
          dateTime={new Date(c.getValue()).toISOString()}
          title={formatFullTime(c.getValue())}
          className="tabular-nums text-crm-soft"
        >
          {formatEventTime(c.getValue(), timeMode)}
        </time>
      ),
    }),
    helper.accessor((e) => e.actor.name, {
      id: "actor",
      header: "Actor",
      size: 200,
      cell: (c) => (
        <span className="flex min-w-0 items-center gap-1.5">
          <ActorIcon kind={c.row.original.actor.kind} />
          <span className="truncate text-crm-fg">{c.getValue()}</span>
        </span>
      ),
    }),
    helper.accessor("action", {
      id: "action",
      header: "Action",
      size: 210,
      cell: (c) => (
        <span
          className={cn(
            "truncate rounded px-1.5 py-0.5 font-mono text-xs",
            toneClass[actionTone(c.getValue())],
          )}
        >
          {c.getValue()}
        </span>
      ),
    }),
    helper.accessor((e) => e.resource.name ?? e.resource.id, {
      id: "resource",
      header: "Resource",
      size: 240,
      cell: (c) => (
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-xs text-crm-muted-fg">{c.row.original.resource.type}</span>
          <span className="truncate text-crm-fg">{c.getValue()}</span>
        </span>
      ),
    }),
    helper.accessor((e) => e.outcome ?? "success", {
      id: "outcome",
      header: "Outcome",
      size: 110,
      cell: (c) => {
        const v = c.getValue();
        if (v === "success") return <span className="text-crm-success">Success</span>;
        const Icon = v === "denied" ? ShieldAlert : AlertTriangle;
        return (
          <span
            className={cn(
              "flex items-center gap-1",
              v === "denied" ? "text-crm-warning" : "text-crm-danger",
            )}
          >
            <Icon className="size-3.5" aria-hidden /> {v === "denied" ? "Denied" : "Failed"}
          </span>
        );
      },
    }),
    helper.accessor((e) => e.ip ?? "", {
      id: "source",
      header: "Source",
      size: 200,
      cell: (c) => (
        <span className="truncate text-crm-muted-fg">
          <span className="font-mono text-xs">{c.getValue() || "—"}</span>
          {c.row.original.location ? ` · ${c.row.original.location}` : ""}
        </span>
      ),
    }),
  ] as ColumnDef<typeof features, AuditEvent>[];
}

export interface AuditEventTableProps {
  events: AuditEvent[];
  total?: number;
  timeMode: AuditTimeMode;
  hiddenColumns: AuditColumnId[];
  rowHeight: number;
  height: number | string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  fetchNextPage: () => void;
  onOpen: (index: number) => void;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  /** Rows before the end at which the next page is requested. */
  prefetchThreshold?: number;
  empty: React.ReactNode;
}

/** Headless-table columns (TanStack Table) + windowed rows (TanStack Virtual) in an ARIA grid. */
export function AuditEventTable({
  events,
  total,
  timeMode,
  hiddenColumns,
  rowHeight,
  height,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  fetchNextPage,
  onOpen,
  activeIndex,
  onActiveIndexChange,
  prefetchThreshold = 25,
  empty,
}: AuditEventTableProps) {
  const columns = React.useMemo(() => buildColumns(timeMode), [timeMode]);
  const columnVisibility = React.useMemo(
    () => Object.fromEntries(hiddenColumns.map((c) => [c, false])),
    [hiddenColumns],
  );
  const table = useTable({
    features,
    columns,
    data: events,
    getRowId: (row) => row.id,
    state: { columnVisibility },
  });
  const rows = table.getRowModel().rows;
  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const template = headers
    .map((h, i) => (i === headers.length - 1 ? `minmax(${h.getSize()}px,1fr)` : `${h.getSize()}px`))
    .join(" ");
  const minWidth = headers.reduce((s, h) => s + h.getSize(), 0);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: hasNextPage ? rows.length + 1 : rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });
  const items = virtualizer.getVirtualItems();
  const lastIndex = items.length ? items[items.length - 1]!.index : -1;

  React.useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && lastIndex >= rows.length - 1 - prefetchThreshold)
      fetchNextPage();
  }, [lastIndex, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage, prefetchThreshold]);

  const move = (next: number) => {
    const i = Math.max(0, Math.min(rows.length - 1, next));
    onActiveIndexChange(i);
    virtualizer.scrollToIndex(i, { align: "auto" });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!rows.length) return;
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / rowHeight) - 1);
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(activeIndex + 1),
      ArrowUp: () => move(activeIndex - 1),
      PageDown: () => move(activeIndex + page),
      PageUp: () => move(activeIndex - page),
      Home: () => move(0),
      End: () => move(rows.length - 1),
      Enter: () => activeIndex >= 0 && onOpen(activeIndex),
      " ": () => activeIndex >= 0 && onOpen(activeIndex),
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  const rowId = (i: number) => `audit-row-${rows[i]?.id ?? i}`;

  return (
    <div
      ref={scrollRef}
      role="grid"
      aria-label="Audit events"
      aria-rowcount={(total ?? rows.length) + 1}
      aria-colcount={headers.length}
      aria-busy={isLoading || isFetchingNextPage}
      aria-activedescendant={activeIndex >= 0 && rows[activeIndex] ? rowId(activeIndex) : undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={() => activeIndex < 0 && rows.length && onActiveIndexChange(0)}
      style={{ height }}
      className="relative overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-crm-ring"
    >
      <div style={{ minWidth }}>
        <div
          role="row"
          aria-rowindex={1}
          className="sticky top-0 z-10 grid border-b border-crm-border bg-crm-raised text-xs font-medium uppercase tracking-wide text-crm-muted-fg"
          style={{ gridTemplateColumns: template }}
        >
          {headers.map((h) => (
            <div key={h.id} role="columnheader" className="truncate px-3 py-2">
              <table.FlexRender header={h} />
            </div>
          ))}
        </div>
        {isLoading ? (
          <div aria-hidden>
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-crm-border px-3"
                style={{ height: rowHeight }}
              >
                {[140, 160, 180, 200, 80].map((w, j) => (
                  <span
                    key={j}
                    className="h-3 animate-pulse rounded bg-crm-muted"
                    style={{ width: w }}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          empty
        ) : (
          <div role="rowgroup" style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {items.map((vi) => {
              const row = rows[vi.index];
              const style: React.CSSProperties = {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: vi.size,
                transform: `translateY(${vi.start}px)`,
              };
              if (!row)
                return (
                  <div
                    key="loader"
                    role="row"
                    style={style}
                    className="flex items-center justify-center gap-2 text-sm text-crm-muted-fg"
                  >
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Loading more events…
                  </div>
                );
              const active = vi.index === activeIndex;
              return (
                <div
                  key={row.id}
                  id={rowId(vi.index)}
                  role="row"
                  aria-rowindex={vi.index + 2}
                  aria-selected={active}
                  onClick={() => {
                    onActiveIndexChange(vi.index);
                    onOpen(vi.index);
                  }}
                  style={{ ...style, gridTemplateColumns: template }}
                  className={cn(
                    "grid cursor-pointer items-center border-b border-crm-border text-sm hover:bg-crm-card",
                    active && "bg-crm-card shadow-[inset_2px_0_0_var(--color-crm-primary)]",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      role="gridcell"
                      className="flex min-w-0 items-center overflow-hidden px-3"
                    >
                      <table.FlexRender cell={cell} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
