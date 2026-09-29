import * as React from "react";
import { ArrowDownRight, ArrowUpLeft, Crosshair, Columns3, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLineage, useLineageContext } from "@/components/crm/pro-data-lineage-graph/context";
import { STATUS_META } from "@/components/crm/pro-data-lineage-graph/lineage-node";
import { dirKey, type LineageIndex } from "@/components/crm/pro-data-lineage-graph/store";

const btn =
  "inline-flex h-7 items-center gap-1.5 rounded-md border border-crm-border bg-crm-raised px-2 text-[11px] text-crm-soft hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none disabled:opacity-40";

export function LineageDetailsPanel({ index }: { index: LineageIndex }) {
  const { store, expand } = useLineageContext();
  const id = useLineage((s) => s.selectedId);
  const d = useLineage((s) => (s.selectedId ? s.datasets[s.selectedId] : undefined));
  const upLoading = useLineage((s) => (id ? !!s.loading[dirKey(id, "upstream")] : false));
  const downLoading = useLineage((s) => (id ? !!s.loading[dirKey(id, "downstream")] : false));
  const focusId = useLineage((s) => s.focusId);
  const column = useLineage((s) => s.selectedColumn);
  if (!id || !d) return null;
  const status = d.status ? STATUS_META[d.status] : null;
  const parents = index.parents.get(id)?.length ?? 0;
  const children = index.children.get(id)?.length ?? 0;

  return (
    <section
      aria-label={`Details for ${d.name}`}
      className="w-72 rounded-crm border border-crm-border bg-crm-popover/95 p-3 text-crm-fg shadow-crm-overlay backdrop-blur"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="crm-eyebrow text-crm-muted-fg">
            {d.kind}
            {d.schema ? ` · ${d.schema}` : ""}
          </p>
          <h3 className="truncate text-sm font-semibold" title={d.name}>
            {d.name}
          </h3>
        </div>
        <button
          type="button"
          aria-label="Close details"
          className="rounded p-1 text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
          onClick={() => store.getState().select(null)}
        >
          <X className="size-4" />
        </button>
      </header>
      {status && (
        <p className={cn("mt-1 inline-flex items-center gap-1 text-xs", status.className)}>
          <status.Icon className="size-3.5" aria-hidden /> {status.label}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {d.owner && (
          <>
            <dt className="text-crm-muted-fg">Owner</dt>
            <dd className="truncate">{d.owner}</dd>
          </>
        )}
        <dt className="text-crm-muted-fg">Parents</dt>
        <dd className="tabular-nums">
          {parents}
          {d.hasUpstream ? "+" : ""} loaded
        </dd>
        <dt className="text-crm-muted-fg">Children</dt>
        <dd className="tabular-nums">
          {children}
          {d.hasDownstream ? "+" : ""} loaded
        </dd>
        {Object.entries(d.meta ?? {}).map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-crm-muted-fg">{k}</dt>
            <dd className="truncate">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      {column?.nodeId === id && (
        <p className="mt-2 rounded-md bg-crm-primary/15 px-2 py-1 text-[11px] text-crm-fg">
          Tracing column <span className="font-mono">{column.column}</span>
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          className={btn}
          disabled={!d.hasUpstream || upLoading}
          onClick={() => expand(id, "upstream")}
        >
          <ArrowUpLeft className="size-3" /> Upstream
        </button>
        <button
          type="button"
          className={btn}
          disabled={!d.hasDownstream || downLoading}
          onClick={() => expand(id, "downstream")}
        >
          <ArrowDownRight className="size-3" /> Downstream
        </button>
        <button
          type="button"
          className={cn(btn, focusId === id && "border-crm-primary text-crm-fg")}
          aria-pressed={focusId === id}
          onClick={() => store.getState().focus(focusId === id ? null : id)}
        >
          <Crosshair className="size-3" /> Focus
        </button>
        {!!d.columns?.length && (
          <button type="button" className={btn} onClick={() => store.getState().toggleColumns(id)}>
            <Columns3 className="size-3" /> Columns
          </button>
        )}
      </div>
    </section>
  );
}
