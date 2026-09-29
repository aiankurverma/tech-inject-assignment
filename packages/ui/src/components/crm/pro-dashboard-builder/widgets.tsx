import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardField, WidgetConfig } from "@/components/crm/pro-dashboard-builder/schema";
import {
  aggregate,
  compileQuery,
  formatValue,
  groupSeries,
  type DataRecord,
} from "@/components/crm/pro-dashboard-builder/query";

export interface WidgetBodyProps {
  widget: WidgetConfig;
  rows: DataRecord[];
  fields: DashboardField[];
}

function WidgetError({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex h-full items-center justify-center gap-2 p-4 text-center text-xs text-crm-danger"
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      {children}
    </div>
  );
}

/** Returns an error message when the widget points at fields the dataset does not have. */
function configError(w: WidgetConfig, byName: Map<string, DashboardField>): string | null {
  if (w.type !== "table" && w.agg !== "count") {
    const m = w.metric && byName.get(w.metric);
    if (!m || m.type !== "number") return "Pick a numeric metric in the widget settings.";
  }
  if (w.type === "line" && byName.get(w.groupBy ?? "")?.type !== "date")
    return "Line charts need a date field to group by.";
  if (w.type === "bar" && !byName.has(w.groupBy ?? "")) return "Bar charts need a group-by field.";
  return null;
}

const axis = { fontSize: 11, fill: "var(--color-crm-muted-fg)" };
const tooltipStyle = {
  background: "var(--color-crm-popover)",
  border: "1px solid var(--color-crm-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-crm-fg)",
};

export const WidgetBody = React.memo(function WidgetBody({
  widget,
  rows,
  fields,
}: WidgetBodyProps) {
  const byName = React.useMemo(() => new Map(fields.map((f) => [f.name, f])), [fields]);
  const filtered = React.useMemo(() => {
    const p = compileQuery(widget.query, fields);
    return rows.filter(p);
  }, [rows, widget.query, fields]);
  const error = configError(widget, byName);
  const series = React.useMemo(
    () =>
      !error && (widget.type === "line" || widget.type === "bar") && widget.groupBy
        ? groupSeries(
            filtered,
            widget.groupBy,
            byName.get(widget.groupBy)!.type,
            widget.metric,
            widget.agg,
          ).slice(0, widget.type === "bar" ? 12 : 120)
        : [],
    [error, filtered, widget.type, widget.groupBy, widget.metric, widget.agg, byName],
  );
  if (error) return <WidgetError>{error}</WidgetError>;
  if (widget.type === "table")
    return <TableWidget rows={filtered} widget={widget} fields={fields} />;
  if (widget.type === "kpi") {
    const value = aggregate(filtered, widget.metric, widget.agg);
    return (
      <div className="flex h-full flex-col justify-center px-4 pb-3">
        <div className="text-3xl font-semibold tabular-nums text-crm-fg">
          {formatValue(value, widget.format)}
        </div>
        <div className="mt-1 text-xs text-crm-muted-fg">
          {widget.agg} of {byName.get(widget.metric ?? "")?.label ?? "records"} ·{" "}
          {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} records
        </div>
      </div>
    );
  }
  if (!series.length) return <WidgetError>No records match this widget's query.</WidgetError>;
  const tick = (v: number) => formatValue(v, widget.format);
  return (
    <div className="h-full min-h-0 px-2 pb-2" aria-label={`${widget.title} chart`} role="img">
      <ResponsiveContainer width="100%" height="100%">
        {widget.type === "line" ? (
          <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid
              stroke="var(--color-crm-border)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis dataKey="key" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={tick} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => tick(Number(v))} />
            <Line
              type="monotone"
              dataKey="value"
              name={widget.title}
              stroke="var(--color-crm-primary)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        ) : (
          <BarChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid
              stroke="var(--color-crm-border)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis dataKey="key" tick={axis} tickLine={false} axisLine={false} interval={0} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={tick} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "var(--color-crm-muted)" }}
              formatter={(v) => tick(Number(v))}
            />
            <Bar
              dataKey="value"
              name={widget.title}
              fill="var(--color-crm-primary)"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
});

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});
const helper = createColumnHelper<typeof features, DataRecord>();

function TableWidget({
  rows,
  widget,
  fields,
}: {
  rows: DataRecord[];
  widget: WidgetConfig;
  fields: DashboardField[];
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const cols = React.useMemo(() => {
    const wanted = widget.columns?.length ? widget.columns : fields.slice(0, 5).map((f) => f.name);
    return fields.filter((f) => wanted.includes(f.name));
  }, [widget.columns, fields]);
  const columns = React.useMemo(
    () =>
      helper.columns(
        cols.map((f) =>
          helper.accessor((r) => r[f.name] as string | number, {
            id: f.name,
            header: f.label,
            sortFn: f.type === "string" ? "alphanumeric" : "basic",
            cell: (c) => {
              const v = c.getValue();
              if (f.type === "date") return String(v).slice(0, 10);
              if (f.type === "number" && typeof v === "number")
                return formatValue(v, f.name === widget.metric ? widget.format : "number");
              return String(v ?? "");
            },
          }),
        ),
      ),
    [cols, widget.metric, widget.format],
  );
  const table = useTable({
    features,
    columns,
    data: rows,
    state: { sorting },
    onSortingChange: setSorting,
  });
  const model = table.getRowModel().rows;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: model.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 30,
    overscan: 12,
  });
  if (!model.length) return <WidgetError>No records match this widget's query.</WidgetError>;
  const template = `repeat(${cols.length}, minmax(96px, 1fr))`;
  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto text-xs"
      role="grid"
      aria-rowcount={model.length + 1}
      aria-colcount={cols.length}
      tabIndex={0}
    >
      <div
        role="row"
        className="sticky top-0 z-10 grid border-b border-crm-border bg-crm-card"
        style={{ gridTemplateColumns: template }}
      >
        {table.getHeaderGroups()[0]?.headers.map((h) => {
          const dir = h.column.getIsSorted();
          return (
            <button
              key={h.id}
              type="button"
              role="columnheader"
              aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
              onClick={h.column.getToggleSortingHandler()}
              className="flex items-center gap-1 px-3 py-2 text-left font-medium text-crm-muted-fg hover:text-crm-fg focus-visible:outline-2 focus-visible:outline-crm-ring"
            >
              <table.FlexRender header={h} />
              {dir === "asc" ? (
                <ArrowUp className="size-3" aria-hidden />
              ) : dir === "desc" ? (
                <ArrowDown className="size-3" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>
      <div style={{ height: virt.getTotalSize(), position: "relative" }}>
        {virt.getVirtualItems().map((vi) => {
          const row = model[vi.index];
          if (!row) return null;
          return (
            <div
              key={row.id}
              role="row"
              aria-rowindex={vi.index + 2}
              className={cn(
                "absolute left-0 grid w-full border-b border-crm-border/60",
                vi.index % 2 && "bg-crm-muted/40",
              )}
              style={{
                height: vi.size,
                transform: `translateY(${vi.start}px)`,
                gridTemplateColumns: template,
              }}
            >
              {row.getAllCells().map((cell) => (
                <div
                  key={cell.id}
                  role="gridcell"
                  className="truncate px-3 py-1.5 tabular-nums text-crm-fg"
                >
                  <table.FlexRender cell={cell} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
