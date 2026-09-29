import * as React from "react";
import { useReactFlow } from "@xyflow/react";
import { Crosshair, Eraser, Maximize2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLineage, useLineageContext } from "@/components/crm/pro-data-lineage-graph/context";
import { NODE_WIDTH, HEADER_HEIGHT } from "@/components/crm/pro-data-lineage-graph/layout";
import type { Positioned } from "@/components/crm/pro-data-lineage-graph/layout";

const iconBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-crm-border bg-crm-raised px-2.5 text-xs text-crm-soft transition-colors hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40";

export interface LineageToolbarProps {
  positions: Map<string, Positioned>;
  depth: number;
  onDepthChange: (depth: number) => void;
  maxDepth: number;
}

export function LineageToolbar({ positions, depth, onDepthChange, maxDepth }: LineageToolbarProps) {
  const { store } = useLineageContext();
  const flow = useReactFlow();
  const datasets = useLineage((s) => s.datasets);
  const edgeCount = useLineage((s) => Object.keys(s.edges).length);
  const selectedId = useLineage((s) => s.selectedId);
  const focusId = useLineage((s) => s.focusId);
  const hasTrace = useLineage((s) => !!s.selectedColumn || !!s.focusId);
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listId = React.useId();

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    for (const d of Object.values(datasets)) {
      if (d.name.toLowerCase().includes(q) || d.schema?.toLowerCase().includes(q)) {
        out.push(d);
        if (out.length === 8) break;
      }
    }
    return out;
  }, [datasets, query]);

  const jump = (id: string) => {
    const p = positions.get(id);
    store.getState().select(id);
    setOpen(false);
    setQuery("");
    if (p) {
      void flow.setCenter(p.x + NODE_WIDTH / 2, p.y + HEADER_HEIGHT / 2, {
        zoom: 1.1,
        duration: 400,
      });
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Lineage controls"
      className="flex flex-wrap items-center gap-2 rounded-crm border border-crm-border bg-crm-popover/95 p-2 shadow-crm-raised backdrop-blur"
    >
      <div className="relative">
        <Search className="pointer-events-none absolute top-2 left-2 size-4 text-crm-muted-fg" />
        <input
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          aria-label="Find dataset"
          placeholder="Find dataset…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              jump(results[active]!.id);
            } else if (e.key === "Escape") setOpen(false);
          }}
          className="h-8 w-56 rounded-md border border-crm-input bg-crm-bg pr-2 pl-8 text-xs text-crm-fg placeholder:text-crm-muted-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
        />
        {open && results.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute top-9 left-0 z-20 w-72 overflow-hidden rounded-crm border border-crm-border bg-crm-popover py-1 shadow-crm-overlay"
          >
            {results.map((d, i) => (
              <li
                key={d.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  jump(d.id);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-xs",
                  i === active ? "bg-crm-muted text-crm-fg" : "text-crm-soft",
                )}
              >
                <span className="truncate">{d.name}</span>
                <span className="shrink-0 text-crm-muted-fg">{d.schema ?? d.kind}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="flex items-center gap-1.5 text-xs text-crm-muted-fg">
        Expand
        <select
          value={depth}
          onChange={(e) => onDepthChange(Number(e.target.value))}
          className="h-8 rounded-md border border-crm-input bg-crm-bg px-1.5 text-xs text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
        >
          {[1, 2, 3, 5].map((n) => (
            <option key={n} value={n}>
              {n} level{n > 1 ? "s" : ""}
            </option>
          ))}
          <option value={maxDepth}>All levels</option>
        </select>
      </label>

      <button
        type="button"
        className={cn(iconBtn, focusId && "border-crm-primary text-crm-fg")}
        disabled={!selectedId && !focusId}
        aria-pressed={!!focusId}
        onClick={() => {
          const s = store.getState();
          s.focus(s.focusId ? null : s.selectedId);
        }}
      >
        <Crosshair className="size-3.5" /> Focus
      </button>
      <button
        type="button"
        className={iconBtn}
        disabled={!hasTrace}
        onClick={() => {
          const s = store.getState();
          s.focus(null);
          s.selectColumn(null);
        }}
      >
        <Eraser className="size-3.5" /> Clear
      </button>
      <button
        type="button"
        className={iconBtn}
        aria-label="Fit graph to view"
        onClick={() => void flow.fitView({ duration: 300 })}
      >
        <Maximize2 className="size-3.5" />
      </button>
      <span className="px-1 text-[11px] text-crm-muted-fg tabular-nums" aria-live="polite">
        {Object.keys(datasets).length.toLocaleString()} datasets · {edgeCount.toLocaleString()}{" "}
        edges
      </span>
    </div>
  );
}
