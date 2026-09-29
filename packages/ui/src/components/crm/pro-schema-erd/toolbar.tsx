import * as React from "react";
import { cn } from "@/lib/utils";
import { useErd } from "@/hooks/use-erd-store";
import type { ErdTable, LineageMode } from "@/components/crm/pro-schema-erd/types";

interface Hit {
  table: ErdTable;
  column?: string;
}

const btn =
  "inline-flex h-8 items-center gap-1 rounded-[6px] px-2.5 text-xs text-crm-muted-fg transition-colors hover:bg-crm-soft hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring disabled:opacity-50 aria-pressed:bg-crm-card aria-pressed:text-crm-fg aria-pressed:shadow-crm-raised";

interface ToolbarProps {
  tables: ErdTable[];
  onFocus: (id: string | null) => void;
  onRelayout: () => void;
  onFit: () => void;
  onExport: () => void;
  disabled?: boolean;
}

/** Search combobox (tables and columns) plus lineage mode, depth, layout and export actions. */
export function ErdToolbar({
  tables,
  onFocus,
  onRelayout,
  onFit,
  onExport,
  disabled,
}: ToolbarProps) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const mode = useErd((s) => s.mode);
  const depth = useErd((s) => s.depth);
  const focusedId = useErd((s) => s.focusedId);
  const setMode = useErd((s) => s.setMode);
  const setDepth = useErd((s) => s.setDepth);
  const setMatches = useErd((s) => s.setMatches);

  const hits = React.useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Hit[] = [];
    for (const t of tables) {
      if (t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
        out.push({ table: t });
    }
    for (const t of tables) {
      for (const c of t.columns) {
        if (out.length >= 60) break;
        if (c.name.toLowerCase().includes(q)) out.push({ table: t, column: c.name });
      }
    }
    return out.slice(0, 60);
  }, [query, tables]);

  React.useEffect(() => {
    setMatches(new Set(hits.map((h) => h.table.id)));
    setActive(0);
  }, [hits, setMatches]);

  const choose = (h: Hit | undefined) => {
    if (!h) return;
    onFocus(h.table.id);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      setOpen(true);
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
    else if (e.key === "Enter") choose(hits[active]);
    else if (e.key === "Escape") {
      if (open) setOpen(false);
      else setQuery("");
    } else return;
    e.preventDefault();
  };

  const focused = focusedId ? tables.find((t) => t.id === focusedId) : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-crm-border bg-crm-card px-3 py-2">
      <div className="relative w-64 max-w-full">
        <input
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && hits[active] ? `${listId}-${active}` : undefined}
          aria-label="Search tables and columns"
          placeholder="Search tables or columns…"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="h-8 w-full rounded-crm border border-crm-border bg-crm-input px-2.5 text-xs text-crm-fg placeholder:text-crm-muted-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
        />
        {open && hits.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Matches"
            className="absolute left-0 top-9 z-50 max-h-72 w-full overflow-auto rounded-crm border border-crm-border bg-crm-popover p-1 shadow-crm-overlay"
          >
            {hits.map((h, i) => (
              <li
                key={`${h.table.id}:${h.column ?? ""}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(h);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-xs",
                  i === active ? "bg-crm-soft text-crm-fg" : "text-crm-muted-fg",
                )}
              >
                <span className="truncate font-medium text-crm-fg">{h.table.name}</span>
                {h.column && <span className="truncate font-mono">.{h.column}</span>}
                {h.table.schema && <span className="ml-auto text-[10px]">{h.table.schema}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div
        role="group"
        aria-label="Lineage direction"
        className="inline-flex rounded-crm bg-crm-soft p-0.5"
      >
        {(["both", "upstream", "downstream"] as LineageMode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={btn}
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            disabled={disabled}
          >
            {m === "both" ? "Both" : m === "upstream" ? "References" : "Referenced by"}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-crm-muted-fg">
        Depth
        <select
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
          disabled={disabled}
          className="h-8 rounded-crm border border-crm-border bg-crm-input px-1.5 text-xs text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
        >
          {[1, 2, 3, 99].map((d) => (
            <option key={d} value={d}>
              {d === 99 ? "All" : d}
            </option>
          ))}
        </select>
      </label>
      {focused && (
        <span className="inline-flex items-center gap-1 rounded-full bg-crm-primary/10 py-0.5 pl-2.5 pr-1 text-xs text-crm-primary">
          {focused.name}
          <button
            type="button"
            aria-label="Clear focus"
            onClick={() => onFocus(null)}
            className="rounded-full px-1.5 hover:bg-crm-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
          >
            ×
          </button>
        </span>
      )}
      <div className="ml-auto flex gap-1">
        <button type="button" className={btn} onClick={onFit} disabled={disabled}>
          Fit
        </button>
        <button type="button" className={btn} onClick={onRelayout} disabled={disabled}>
          Auto-layout
        </button>
        <button
          type="button"
          className={cn(btn, "border border-crm-border")}
          onClick={onExport}
          disabled={disabled}
        >
          Export SVG
        </button>
      </div>
    </div>
  );
}
