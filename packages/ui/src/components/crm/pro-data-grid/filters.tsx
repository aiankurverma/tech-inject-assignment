import * as React from "react";
import type { Column } from "@tanstack/react-table";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatValue, isNumeric, type GridFeatures } from "@/components/crm/pro-data-grid/engine";
import type { GridFilterValue } from "@/components/crm/pro-data-grid/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GridColumnInstance = Column<GridFeatures, any, unknown>;

const input =
  "h-8 w-full rounded-[6px] border border-crm-input bg-crm-bg px-2 text-sm text-crm-fg outline-none placeholder:text-crm-muted-fg focus-visible:border-crm-ring";

/** Faceted filter editor for one column; facets are computed only while this is mounted. */
export function ColumnFilter({ column }: { column: GridColumnInstance }) {
  const spec = column.columnDef.meta?.spec;
  const type = spec?.type ?? "text";
  const value = column.getFilterValue() as GridFilterValue | undefined;
  const set = (next: GridFilterValue | undefined) => column.setFilterValue(next);

  if (isNumeric(type)) {
    const [lo, hi] = column.getFacetedMinMaxValues() ?? [undefined, undefined];
    const range = value?.kind === "range" ? value : { kind: "range" as const };
    const parse = (s: string) =>
      s.trim() === "" || Number.isNaN(Number(s)) ? undefined : Number(s);
    const scale = type === "percent" ? 100 : 1;
    return (
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs text-crm-muted-fg">
          Min
          <input
            className={input}
            inputMode="decimal"
            placeholder={lo === undefined ? "" : formatValue(type, lo, spec?.currency)}
            defaultValue={range.min === undefined ? "" : String(range.min * scale)}
            onChange={(e) => {
              const n = parse(e.target.value);
              set({ ...range, min: n === undefined ? undefined : n / scale });
            }}
          />
        </label>
        <label className="grid gap-1 text-xs text-crm-muted-fg">
          Max
          <input
            className={input}
            inputMode="decimal"
            placeholder={hi === undefined ? "" : formatValue(type, hi, spec?.currency)}
            defaultValue={range.max === undefined ? "" : String(range.max * scale)}
            onChange={(e) => {
              const n = parse(e.target.value);
              set({ ...range, max: n === undefined ? undefined : n / scale });
            }}
          />
        </label>
      </div>
    );
  }

  if (type === "date") {
    const range = value?.kind === "dateRange" ? value : { kind: "dateRange" as const };
    return (
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs text-crm-muted-fg">
          From
          <input
            type="date"
            className={input}
            value={range.from ?? ""}
            onChange={(e) => set({ ...range, from: e.target.value || undefined })}
          />
        </label>
        <label className="grid gap-1 text-xs text-crm-muted-fg">
          To
          <input
            type="date"
            className={input}
            value={range.to ?? ""}
            onChange={(e) => set({ ...range, to: e.target.value || undefined })}
          />
        </label>
      </div>
    );
  }

  if (type === "enum" || type === "boolean") {
    return <SetFilter column={column} value={value} onChange={set} />;
  }

  return (
    <input
      className={input}
      placeholder={`Contains…`}
      defaultValue={value?.kind === "text" ? value.query : ""}
      onChange={(e) => set({ kind: "text", query: e.target.value })}
      aria-label={`${spec?.header ?? column.id} contains`}
    />
  );
}

function SetFilter({
  column,
  value,
  onChange,
}: {
  column: GridColumnInstance;
  value: GridFilterValue | undefined;
  onChange: (v: GridFilterValue | undefined) => void;
}) {
  const spec = column.columnDef.meta?.spec;
  const facets = column.getFacetedUniqueValues();
  const [query, setQuery] = React.useState("");
  const selected = React.useMemo(() => new Set(value?.kind === "set" ? value.values : []), [value]);
  const entries = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const [k, n] of facets) {
      const key = String(k ?? "");
      counts.set(key, (counts.get(key) ?? 0) + n);
    }
    const order = spec?.options ?? [];
    for (const o of order) if (!counts.has(o)) counts.set(o, 0);
    const list = [...counts.entries()];
    if (order.length) list.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    else list.sort((a, b) => b[1] - a[1]);
    return list;
  }, [facets, spec?.options]);
  const q = query.trim().toLowerCase();
  const shown = (q ? entries.filter(([k]) => k.toLowerCase().includes(q)) : entries).slice(0, 100);
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next.size ? { kind: "set", values: [...next] } : undefined);
  };
  const label = (k: string) =>
    spec?.type === "boolean" ? (k === "true" ? "Yes" : "No") : k || "(blank)";

  return (
    <div className="grid gap-1.5">
      {entries.length > 8 && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-2 left-2 size-4 text-crm-muted-fg"
            aria-hidden
          />
          <input
            className={cn(input, "pl-7")}
            placeholder="Search values"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      <ul className="max-h-48 overflow-auto" role="group" aria-label={`${spec?.header} values`}>
        {shown.map(([key, count]) => (
          <li key={key}>
            <label className="flex cursor-pointer items-center gap-2 rounded-[6px] px-1.5 py-1 text-sm hover:bg-crm-muted">
              <input
                type="checkbox"
                className="size-3.5 accent-crm-primary"
                checked={selected.has(key)}
                onChange={() => toggle(key)}
              />
              <span className="min-w-0 flex-1 truncate text-crm-fg">{label(key)}</span>
              <span className="text-xs text-crm-muted-fg tabular-nums">
                {count.toLocaleString()}
              </span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="px-1.5 py-1 text-sm text-crm-muted-fg">No values</li>}
      </ul>
    </div>
  );
}

/** Short human summary of an active filter, for chips. */
export function describeFilter(column: GridColumnInstance): string {
  const spec = column.columnDef.meta?.spec;
  const type = spec?.type ?? "text";
  const v = column.getFilterValue() as GridFilterValue | undefined;
  if (!v) return "";
  const fmt = (n: number) => formatValue(type, n, spec?.currency);
  switch (v.kind) {
    case "text":
      return `contains “${v.query}”`;
    case "set":
      return v.values.length <= 2
        ? v.values.map((x) => (type === "boolean" ? (x === "true" ? "Yes" : "No") : x)).join(", ")
        : `${v.values.length} values`;
    case "range":
      if (v.min !== undefined && v.max !== undefined) return `${fmt(v.min)} – ${fmt(v.max)}`;
      return v.min !== undefined ? `≥ ${fmt(v.min)}` : `≤ ${fmt(v.max ?? 0)}`;
    case "dateRange":
      return `${v.from ?? "…"} → ${v.to ?? "…"}`;
  }
}

export function FilterChip({ column }: { column: GridColumnInstance }) {
  const spec = column.columnDef.meta?.spec;
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-crm-border bg-crm-card pr-1 pl-2.5 text-xs text-crm-soft">
      <span className="text-crm-muted-fg">{spec?.header ?? column.id}</span>
      <span className="max-w-40 truncate text-crm-fg">{describeFilter(column)}</span>
      <button
        type="button"
        onClick={() => column.setFilterValue(undefined)}
        aria-label={`Remove ${spec?.header ?? column.id} filter`}
        className="grid size-5 place-items-center rounded-full text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}
