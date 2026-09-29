import * as React from "react";
import { ChevronRight, KeyRound, Search, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SqlTable } from "@/components/crm/pro-sql-console/types";

export interface SchemaTreeProps {
  tables: SqlTable[];
  /** Inserts a table or column name at the editor cursor. */
  onInsert: (text: string) => void;
  loading?: boolean;
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact" });

/**
 * Searchable schema browser (WAI-ARIA tree). Up/Down move, Right/Left expand/collapse,
 * Enter inserts the focused table or column into the editor.
 */
export function SchemaTree({ tables, onInsert, loading }: SchemaTreeProps) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState<Set<string>>(() => new Set());
  const deferred = React.useDeferredValue(query.trim().toLowerCase());

  // Flat list of visible nodes: filtering matches table or column names and auto-expands.
  const nodes = React.useMemo(() => {
    const out: { key: string; table: SqlTable; column?: SqlTable["columns"][number] }[] = [];
    for (const t of tables) {
      const key = t.schema ? `${t.schema}.${t.name}` : t.name;
      const tableHit = !deferred || key.toLowerCase().includes(deferred);
      const cols =
        deferred && !tableHit
          ? t.columns.filter((c) => c.name.toLowerCase().includes(deferred))
          : t.columns;
      if (!tableHit && !cols.length) continue;
      out.push({ key, table: t });
      if (open.has(key) || (deferred && !tableHit))
        for (const c of cols) out.push({ key: `${key}.${c.name}`, table: t, column: c });
    }
    return out;
  }, [tables, deferred, open]);

  const [focus, setFocus] = React.useState(0);
  const refs = React.useRef<(HTMLDivElement | null)[]>([]);
  const move = (i: number) => {
    const n = Math.max(0, Math.min(nodes.length - 1, i));
    setFocus(n);
    refs.current[n]?.focus();
  };
  const toggle = (key: string, force?: boolean) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (force ?? !next.has(key)) next.add(key);
      else next.delete(key);
      return next;
    });

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const node = nodes[i];
    if (!node) return;
    const tableKey = node.table.schema
      ? `${node.table.schema}.${node.table.name}`
      : node.table.name;
    if (e.key === "ArrowDown") move(i + 1);
    else if (e.key === "ArrowUp") move(i - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(nodes.length - 1);
    else if (e.key === "ArrowRight" && !node.column) toggle(tableKey, true);
    else if (e.key === "ArrowLeft") {
      if (node.column) move(nodes.findIndex((n) => !n.column && n.table === node.table));
      else toggle(tableKey, false);
    } else if (e.key === "Enter") onInsert(node.column ? node.column.name : node.table.name);
    else return;
    e.preventDefault();
  };

  return (
    <div className="flex h-full flex-col">
      <label className="m-2 flex items-center gap-1.5 rounded-crm border border-crm-border bg-crm-input px-2 focus-within:ring-1 focus-within:ring-crm-ring">
        <Search className="size-3.5 text-crm-subtle" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              move(0);
            }
          }}
          placeholder="Search tables and columns"
          aria-label="Search schema"
          className="h-7 w-full bg-transparent text-xs text-crm-fg outline-none placeholder:text-crm-subtle"
        />
      </label>
      {loading ? (
        <div className="space-y-2 px-3 py-2" aria-busy>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-4 animate-pulse rounded bg-crm-muted"
              style={{ width: `${60 + ((i * 17) % 35)}%` }}
            />
          ))}
        </div>
      ) : !nodes.length ? (
        <p className="px-3 py-4 text-xs text-crm-subtle">
          {tables.length ? "No matches" : "No tables in schema"}
        </p>
      ) : (
        <div role="tree" aria-label="Database schema" className="min-h-0 flex-1 overflow-auto pb-2">
          {nodes.map((n, i) => {
            const expanded = !n.column && (open.has(n.key) || !!deferred);
            return (
              <div
                key={n.key}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                role="treeitem"
                aria-level={n.column ? 2 : 1}
                aria-expanded={n.column ? undefined : expanded}
                aria-selected={focus === i}
                tabIndex={focus === i ? 0 : -1}
                onKeyDown={(e) => onKeyDown(e, i)}
                onFocus={() => setFocus(i)}
                onClick={() => (n.column ? undefined : toggle(n.key))}
                onDoubleClick={() => onInsert(n.column ? n.column.name : n.table.name)}
                title={(n.column ?? n.table).description ?? "Double-click or Enter to insert"}
                className={cn(
                  "group flex h-7 cursor-default items-center gap-1.5 pr-2 text-xs outline-none hover:bg-crm-muted/60 focus-visible:bg-crm-muted",
                  n.column ? "pl-8 text-crm-soft" : "pl-2 text-crm-fg",
                )}
              >
                {n.column ? (
                  n.column.primaryKey ? (
                    <KeyRound
                      className="size-3 shrink-0 text-crm-warning"
                      aria-label="Primary key"
                    />
                  ) : (
                    <span className="size-3 shrink-0" />
                  )
                ) : (
                  <>
                    <ChevronRight
                      className={cn(
                        "size-3.5 shrink-0 text-crm-subtle transition-transform",
                        expanded && "rotate-90",
                      )}
                      aria-hidden
                    />
                    <Table2 className="size-3.5 shrink-0 text-crm-subtle" aria-hidden />
                  </>
                )}
                <span className="truncate font-mono">
                  {n.column ? n.column.name : n.table.name}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-crm-faint">
                  {n.column
                    ? `${n.column.type}${n.column.nullable === false ? "" : "?"}`
                    : n.table.rowCount != null
                      ? compact.format(n.table.rowCount)
                      : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
