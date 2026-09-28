import * as React from "react";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Download } from "lucide-react";
import { Button } from "@/components/crm/button";
import { Select } from "@/components/crm/select";
import { cn } from "@/lib/utils";

export interface ReportDimension {
  key: string;
  label: string;
  /** For date fields: bucket to month / quarter. */
  date?: boolean;
}

export interface ReportMeasure {
  key: string;
  label: string;
  currency?: boolean;
}

export type ReportAggregate = "count" | "sum" | "avg" | "min" | "max";

export interface ReportConfig {
  groupBy: string;
  /** Date grain when groupBy is a date dimension. */
  grain: "month" | "quarter" | "year";
  aggregate: ReportAggregate;
  measure: string;
  sort: "value_desc" | "value_asc" | "label";
  limit: number;
}

export type ReportRow = Record<string, string | number | null | undefined>;

export interface ReportBuilderProps {
  title?: string;
  rows: ReportRow[];
  dimensions: ReportDimension[];
  measures: ReportMeasure[];
  config?: ReportConfig;
  defaultConfig?: Partial<ReportConfig>;
  onConfigChange?: (c: ReportConfig) => void;
  currency?: string;
  loading?: boolean;
  error?: string;
  className?: string;
}

function bucket(v: unknown, grain: ReportConfig["grain"]) {
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "Unknown";
  const y = d.getFullYear();
  if (grain === "year") return String(y);
  if (grain === "quarter") return `${y} Q${Math.floor(d.getMonth() / 3) + 1}`;
  return `${y}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface ReportResultRow {
  label: string;
  value: number;
  count: number;
}

/** Group + aggregate rows. Null/empty measure values are ignored for sum/avg/min/max. */
export function runReport(
  rows: ReportRow[],
  dims: ReportDimension[],
  c: ReportConfig,
): ReportResultRow[] {
  const dim = dims.find((d) => d.key === c.groupBy);
  const groups = new Map<string, number[]>();
  const counts = new Map<string, number>();
  for (const r of rows) {
    const raw = r[c.groupBy];
    const label = dim?.date
      ? bucket(raw, c.grain)
      : raw === null || raw === undefined || raw === ""
        ? "(none)"
        : String(raw);
    counts.set(label, (counts.get(label) ?? 0) + 1);
    const m = Number(r[c.measure]);
    const arr = groups.get(label) ?? [];
    if (
      r[c.measure] !== null &&
      r[c.measure] !== undefined &&
      r[c.measure] !== "" &&
      Number.isFinite(m)
    )
      arr.push(m);
    groups.set(label, arr);
  }
  const out = [...counts.keys()].map((label) => {
    const vals = groups.get(label) ?? [];
    const count = counts.get(label)!;
    const sum = vals.reduce((a, b) => a + b, 0);
    const value =
      c.aggregate === "count"
        ? count
        : c.aggregate === "sum"
          ? sum
          : !vals.length
            ? 0
            : c.aggregate === "avg"
              ? sum / vals.length
              : c.aggregate === "min"
                ? Math.min(...vals)
                : Math.max(...vals);
    return { label, value, count };
  });
  out.sort((a, b) =>
    c.sort === "label" || dim?.date
      ? a.label.localeCompare(b.label, undefined, { numeric: true })
      : c.sort === "value_asc"
        ? a.value - b.value
        : b.value - a.value,
  );
  return c.limit > 0 && !dim?.date ? out.slice(0, c.limit) : out;
}

function toCsv(title: string, rows: ReportResultRow[], valueLabel: string) {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [
    [title, valueLabel, "Records"],
    ...rows.map((r) => [r.label, String(Math.round(r.value * 100) / 100), String(r.count)]),
  ]
    .map((r) => r.map(esc).join(","))
    .join("\n");
}

const AGGS = [
  { value: "count", label: "Count of records" },
  { value: "sum", label: "Sum of" },
  { value: "avg", label: "Average" },
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" },
];

/** Ad-hoc grouped report: dimension, aggregate and measure pickers, horizontal bars, totals and CSV export. */
export function ReportBuilder({
  title = "Report",
  rows,
  dimensions,
  measures,
  config,
  defaultConfig,
  onConfigChange,
  currency = "USD",
  loading,
  error,
  className,
}: ReportBuilderProps) {
  const [inner, setInner] = React.useState<ReportConfig>({
    groupBy: dimensions[0]?.key ?? "",
    grain: "month",
    aggregate: "sum",
    measure: measures[0]?.key ?? "",
    sort: "value_desc",
    limit: 10,
    ...defaultConfig,
  });
  const c = config ?? inner;
  const set = (p: Partial<ReportConfig>) => {
    const next = { ...c, ...p };
    if (config === undefined) setInner(next);
    onConfigChange?.(next);
  };
  const dim = dimensions.find((d) => d.key === c.groupBy);
  const measure = measures.find((m) => m.key === c.measure);
  const result = React.useMemo(() => runReport(rows, dimensions, c), [rows, dimensions, c]);
  const max = Math.max(0, ...result.map((r) => Math.abs(r.value)));
  const isMoney = c.aggregate !== "count" && !!measure?.currency;
  const nf = isMoney
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      })
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  const total =
    c.aggregate === "count" || c.aggregate === "sum"
      ? result.reduce((s, r) => s + r.value, 0)
      : null;
  const valueLabel =
    c.aggregate === "count"
      ? "Records"
      : `${AGGS.find((a) => a.value === c.aggregate)?.label} ${measure?.label ?? ""}`.trim();

  const exportCsv = () => {
    const blob = new Blob([toCsv(dim?.label ?? "Group", result, valueLabel)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col gap-4 rounded-crm border border-crm-border bg-crm-card p-4 font-crm",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-crm-fg">{title}</h3>
        <span className="text-xs text-crm-subtle">
          {rows.length.toLocaleString("en-US")} records
        </span>
        <Button
          size="sm"
          className="ml-auto"
          onClick={exportCsv}
          disabled={!result.length || loading}
        >
          <Download /> CSV
        </Button>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          aria-label="Group by"
          options={dimensions.map((d) => ({ value: d.key, label: `By ${d.label}` }))}
          value={c.groupBy}
          onValueChange={(v) => set({ groupBy: v })}
        />
        {dim?.date ? (
          <Select
            aria-label="Date grain"
            options={[
              { value: "month", label: "Monthly" },
              { value: "quarter", label: "Quarterly" },
              { value: "year", label: "Yearly" },
            ]}
            value={c.grain}
            onValueChange={(v) => set({ grain: v as ReportConfig["grain"] })}
          />
        ) : (
          <Select
            aria-label="Limit"
            options={[5, 10, 25, 0].map((n) => ({
              value: String(n),
              label: n ? `Top ${n}` : "All groups",
            }))}
            value={String(c.limit)}
            onValueChange={(v) => set({ limit: Number(v) })}
          />
        )}
        <Select
          aria-label="Aggregate"
          options={AGGS}
          value={c.aggregate}
          onValueChange={(v) => set({ aggregate: v as ReportAggregate })}
        />
        <Select
          aria-label="Measure"
          disabled={c.aggregate === "count"}
          options={measures.map((m) => ({ value: m.key, label: m.label }))}
          value={c.measure}
          onValueChange={(v) => set({ measure: v })}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-crm-soft">
        <span>{valueLabel}</span>
        {!dim?.date ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={c.sort === "value_desc" ? "Sort ascending" : "Sort descending"}
            onClick={() => set({ sort: c.sort === "value_desc" ? "value_asc" : "value_desc" })}
          >
            {c.sort === "value_desc" ? <ArrowDownWideNarrow /> : <ArrowUpNarrowWide />}
            {c.sort === "value_desc" ? "Highest first" : "Lowest first"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-crm bg-crm-danger/10 px-3 py-6 text-center text-xs text-crm-danger"
        >
          {error}
        </p>
      ) : loading ? (
        <ul aria-busy className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <li
              key={i}
              className="h-6 animate-pulse rounded bg-crm-raised"
              style={{ width: `${90 - i * 14}%` }}
            />
          ))}
        </ul>
      ) : result.length === 0 ? (
        <p className="py-6 text-center text-xs text-crm-subtle">
          No records match. Adjust your data or grouping.
        </p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">{`${valueLabel} by ${dim?.label}`}</caption>
          <thead className="sr-only">
            <tr>
              <th>{dim?.label}</th>
              <th>{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {result.map((r) => (
              <tr key={r.label} className="group">
                <th
                  scope="row"
                  className="w-[34%] max-w-0 truncate py-1 pr-3 text-left text-xs font-normal text-crm-soft"
                >
                  {r.label}
                </th>
                <td className="py-1">
                  <div className="flex items-center gap-2">
                    <span className="h-5 flex-1">
                      <span
                        className="block h-full rounded-[4px] bg-crm-primary/80 transition-[width] duration-300 group-hover:bg-crm-primary"
                        style={{
                          width: `${max ? Math.max(1, (Math.abs(r.value) / max) * 100) : 0}%`,
                        }}
                      />
                    </span>
                    <span
                      className="w-20 shrink-0 text-right text-xs text-crm-fg tabular-nums"
                      title={`${r.count} records`}
                    >
                      {nf.format(r.value)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {total !== null ? (
            <tfoot>
              <tr className="border-t border-crm-border">
                <th scope="row" className="pt-2 text-left text-xs font-medium text-crm-fg">
                  Total
                </th>
                <td className="pt-2 text-right text-xs font-medium text-crm-fg tabular-nums">
                  {nf.format(total)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      )}
    </section>
  );
}
