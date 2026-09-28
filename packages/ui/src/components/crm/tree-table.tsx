import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TreeRow {
  id: string;
  children?: TreeRow[];
  [key: string]: unknown;
}

export interface TreeColumn<T extends TreeRow> {
  key: string;
  header: string;
  /** Render a cell. Defaults to String(row[key]). */
  cell?: (row: T, depth: number) => React.ReactNode;
  /** Roll-up for parent rows: summed over leaf descendants. Cell receives the aggregate. */
  aggregate?: "sum";
  format?: (value: number) => string;
  align?: "left" | "right";
  width?: string;
}

export interface TreeTableProps<T extends TreeRow> {
  rows: T[];
  columns: TreeColumn<T>[];
  /** Controlled expanded ids. */
  expanded?: string[];
  defaultExpanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  /** Case-insensitive search; ancestors of matches stay visible and auto-expand. */
  filter?: string;
  filterKey?: string;
  onRowClick?: (row: T) => void;
  label?: string;
  emptyText?: string;
  className?: string;
}

function leafSum<T extends TreeRow>(row: T, key: string): number {
  if (!row.children?.length) {
    const v = row[key];
    return typeof v === "number" ? v : 0;
  }
  return (row.children as T[]).reduce((s, c) => s + leafSum(c, key), 0);
}

/**
 * Hierarchical table (account hierarchies, territory roll-ups, cost centres) with expand/collapse,
 * parent roll-up totals, search that keeps ancestors, and WAI-ARIA treegrid keyboard support
 * (Up/Down move, Right expands or enters, Left collapses or goes to parent).
 */
export function TreeTable<T extends TreeRow>({
  rows,
  columns,
  expanded: expandedProp,
  defaultExpanded = [],
  onExpandedChange,
  filter = "",
  filterKey = "name",
  onRowClick,
  label = "Hierarchy",
  emptyText = "No rows match.",
  className,
}: TreeTableProps<T>) {
  const [inner, setInner] = React.useState<string[]>(defaultExpanded);
  const expanded = new Set(expandedProp ?? inner);
  const setExpanded = (next: Set<string>) => {
    const arr = [...next];
    if (expandedProp === undefined) setInner(arr);
    onExpandedChange?.(arr);
  };
  const q = filter.trim().toLowerCase();

  type Flat = {
    row: T;
    depth: number;
    parentId: string | null;
    hasKids: boolean;
    pos: number;
    size: number;
  };
  const flat: Flat[] = [];
  const matches = (r: T): boolean =>
    String(r[filterKey] ?? "")
      .toLowerCase()
      .includes(q) || ((r.children as T[] | undefined) ?? []).some(matches);
  const walk = (list: T[], depth: number, parentId: string | null) => {
    const visible = q ? list.filter(matches) : list;
    visible.forEach((r, i) => {
      const kids = (r.children as T[] | undefined) ?? [];
      flat.push({
        row: r,
        depth,
        parentId,
        hasKids: kids.length > 0,
        pos: i + 1,
        size: visible.length,
      });
      if (kids.length && (expanded.has(r.id) || q)) walk(kids, depth + 1, r.id);
    });
  };
  walk(rows, 0, null);

  const [focusId, setFocusId] = React.useState<string | null>(null);
  const activeId = flat.some((f) => f.row.id === focusId) ? focusId : (flat[0]?.row.id ?? null);
  const refs = React.useRef(new Map<string, HTMLTableRowElement>());
  const focusRow = (id: string) => {
    setFocusId(id);
    refs.current.get(id)?.focus();
  };
  const toggle = (id: string) => {
    const n = new Set(expanded);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setExpanded(n);
  };
  const allParents: string[] = [];
  const collect = (list: T[]) =>
    list.forEach((r) => {
      if (r.children?.length) {
        allParents.push(r.id);
        collect(r.children as T[]);
      }
    });
  collect(rows);

  const onKey = (e: React.KeyboardEvent, f: Flat, idx: number) => {
    const next = flat[idx + 1];
    const prev = flat[idx - 1];
    switch (e.key) {
      case "ArrowDown":
        if (next) focusRow(next.row.id);
        break;
      case "ArrowUp":
        if (prev) focusRow(prev.row.id);
        break;
      case "ArrowRight":
        if (f.hasKids && !expanded.has(f.row.id) && !q) toggle(f.row.id);
        else if (f.hasKids && next) focusRow(next.row.id);
        break;
      case "ArrowLeft":
        if (f.hasKids && expanded.has(f.row.id) && !q) toggle(f.row.id);
        else if (f.parentId) focusRow(f.parentId);
        break;
      case "Home":
        if (flat[0]) focusRow(flat[0].row.id);
        break;
      case "End": {
        const last = flat[flat.length - 1];
        if (last) focusRow(last.row.id);
        break;
      }
      case "Enter":
        onRowClick?.(f.row);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <div className={cn("font-crm", className)}>
      <div className="mb-1.5 flex justify-end gap-1">
        <button
          type="button"
          disabled={!!q}
          onClick={() => setExpanded(new Set(allParents))}
          className="h-6 cursor-pointer rounded-full px-2 text-xs text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg disabled:opacity-50"
        >
          Expand all
        </button>
        <button
          type="button"
          disabled={!!q}
          onClick={() => setExpanded(new Set())}
          className="h-6 cursor-pointer rounded-full px-2 text-xs text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg disabled:opacity-50"
        >
          Collapse all
        </button>
      </div>
      <div className="overflow-x-auto rounded-crm border border-crm-border bg-crm-card">
        <table
          role="treegrid"
          aria-label={label}
          className="w-full min-w-[520px] border-collapse text-sm"
        >
          <thead>
            <tr className="border-b border-crm-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  style={{ width: c.width }}
                  className={cn(
                    "px-3 py-2 text-xs font-normal text-crm-muted-fg",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flat.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-crm-muted-fg">
                  {emptyText}
                </td>
              </tr>
            ) : (
              flat.map((f, idx) => {
                const isOpen = f.hasKids && (expanded.has(f.row.id) || !!q);
                return (
                  <tr
                    key={f.row.id}
                    ref={(el) => {
                      if (el) refs.current.set(f.row.id, el);
                      else refs.current.delete(f.row.id);
                    }}
                    tabIndex={activeId === f.row.id ? 0 : -1}
                    aria-level={f.depth + 1}
                    aria-posinset={f.pos}
                    aria-setsize={f.size}
                    aria-expanded={f.hasKids ? isOpen : undefined}
                    onKeyDown={(e) => onKey(e, f, idx)}
                    onFocus={() => setFocusId(f.row.id)}
                    onClick={() => onRowClick?.(f.row)}
                    className={cn(
                      "border-b border-crm-border outline-none last:border-b-0 hover:bg-crm-muted/40",
                      "focus-visible:bg-crm-muted/60 focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:ring-inset",
                      onRowClick && "cursor-pointer",
                      f.depth === 0 && f.hasKids && "font-medium",
                    )}
                  >
                    {columns.map((c, ci) => {
                      const agg = c.aggregate === "sum" ? leafSum(f.row, c.key) : undefined;
                      const content = c.cell
                        ? c.cell(f.row, f.depth)
                        : agg !== undefined
                          ? c.format
                            ? c.format(agg)
                            : agg.toLocaleString()
                          : String(f.row[c.key] ?? "");
                      return (
                        <td
                          key={c.key}
                          role="gridcell"
                          className={cn(
                            "px-3 py-1.5 text-crm-chip",
                            c.align === "right" && "text-right tabular-nums",
                            f.hasKids && agg !== undefined && "text-crm-fg",
                          )}
                        >
                          {ci === 0 ? (
                            <span
                              className="flex items-center gap-1"
                              style={{ paddingLeft: f.depth * 18 }}
                            >
                              {f.hasKids ? (
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  aria-label={isOpen ? "Collapse" : "Expand"}
                                  disabled={!!q}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggle(f.row.id);
                                  }}
                                  className="grid size-5 cursor-pointer place-items-center rounded text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg"
                                >
                                  <ChevronRight
                                    className={cn(
                                      "size-3.5 transition-transform duration-150 ease-crm",
                                      isOpen && "rotate-90",
                                    )}
                                    aria-hidden
                                  />
                                </button>
                              ) : (
                                <span className="w-5" aria-hidden />
                              )}
                              <span className="truncate">{content}</span>
                            </span>
                          ) : (
                            content
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
