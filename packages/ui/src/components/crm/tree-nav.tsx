import * as React from "react";
import { AlertCircle, ChevronRight, Folder, FolderOpen, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TreeNode {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Record count shown at the right. */
  count?: number;
  children?: TreeNode[];
  /** True when children exist but are fetched on expand via `loadChildren`. */
  hasChildren?: boolean;
  disabled?: boolean;
}

export interface TreeNavProps {
  nodes: TreeNode[];
  selectedId?: string;
  defaultSelectedId?: string;
  onSelect?: (node: TreeNode) => void;
  expanded?: string[];
  defaultExpanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  /** Async loader for `hasChildren` nodes. Errors are shown inline with a retry. */
  loadChildren?: (node: TreeNode) => Promise<TreeNode[]>;
  /** Show a filter box; matching nodes keep their ancestors visible. */
  searchable?: boolean;
  label?: string;
  emptyMessage?: string;
  className?: string;
}

interface FlatRow {
  node: TreeNode;
  depth: number;
  parentId?: string;
  setSize: number;
  pos: number;
  expandable: boolean;
}

function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
  const out: TreeNode[] = [];
  for (const n of nodes) {
    const kids = n.children ? filterTree(n.children, q) : [];
    if (n.label.toLowerCase().includes(q) || kids.length)
      out.push({ ...n, children: kids.length ? kids : n.children });
  }
  return out;
}

function collectIds(nodes: TreeNode[], acc: string[] = []) {
  for (const n of nodes) {
    if (n.children?.length) {
      acc.push(n.id);
      collectIds(n.children, acc);
    }
  }
  return acc;
}

function highlight(label: string, q: string) {
  if (!q) return label;
  const i = label.toLowerCase().indexOf(q);
  if (i === -1) return label;
  return (
    <>
      {label.slice(0, i)}
      <mark className="rounded-sm bg-crm-primary/30 text-crm-fg">
        {label.slice(i, i + q.length)}
      </mark>
      {label.slice(i + q.length)}
    </>
  );
}

/**
 * Accessible nested navigation (WAI-ARIA tree): roving focus, Up/Down/Home/End, Right to
 * expand or enter, Left to collapse or go to parent, `*` expands siblings, type-ahead,
 * lazy-loaded children with loading/error states and a search filter.
 */
export function TreeNav({
  nodes,
  selectedId,
  defaultSelectedId,
  onSelect,
  expanded,
  defaultExpanded = [],
  onExpandedChange,
  loadChildren,
  searchable,
  label = "Folders",
  emptyMessage = "Nothing here yet.",
  className,
}: TreeNavProps) {
  const [innerSel, setInnerSel] = React.useState(defaultSelectedId);
  const sel = selectedId ?? innerSel;
  const [innerExp, setInnerExp] = React.useState<string[]>(defaultExpanded);
  const exp = expanded ?? innerExp;
  const [loaded, setLoaded] = React.useState<Record<string, TreeNode[]>>({});
  const [loading, setLoading] = React.useState<Record<string, "loading" | "error">>({});
  const [query, setQuery] = React.useState("");
  const [focusId, setFocusId] = React.useState<string | undefined>(sel ?? nodes[0]?.id);
  const typeahead = React.useRef({ text: "", t: 0 });
  const treeRef = React.useRef<HTMLUListElement>(null);

  const q = query.trim().toLowerCase();
  const withLoaded = React.useCallback(
    (list: TreeNode[]): TreeNode[] =>
      list.map((n) => ({
        ...n,
        children: n.children
          ? withLoaded(n.children)
          : loaded[n.id]
            ? withLoaded(loaded[n.id] ?? [])
            : undefined,
      })),
    [loaded],
  );
  const source = React.useMemo(() => {
    const full = withLoaded(nodes);
    return q ? filterTree(full, q) : full;
  }, [nodes, withLoaded, q]);
  const openSet = React.useMemo(() => new Set(q ? collectIds(source) : exp), [q, source, exp]);

  const rows = React.useMemo(() => {
    const out: FlatRow[] = [];
    const walk = (list: TreeNode[], depth: number, parentId?: string) => {
      list.forEach((node, i) => {
        const expandable = Boolean(node.children?.length || node.hasChildren);
        out.push({ node, depth, parentId, setSize: list.length, pos: i + 1, expandable });
        if (expandable && openSet.has(node.id) && node.children)
          walk(node.children, depth + 1, node.id);
      });
    };
    walk(source, 0);
    return out;
  }, [source, openSet]);

  const setExp = (next: string[]) => {
    if (expanded === undefined) setInnerExp(next);
    onExpandedChange?.(next);
  };

  const load = async (node: TreeNode) => {
    if (!loadChildren || loaded[node.id] || node.children) return;
    setLoading((l) => ({ ...l, [node.id]: "loading" }));
    try {
      const kids = await loadChildren(node);
      setLoaded((m) => ({ ...m, [node.id]: kids }));
      setLoading(({ [node.id]: _omit, ...rest }) => rest);
    } catch {
      setLoading((l) => ({ ...l, [node.id]: "error" }));
    }
  };

  const toggle = (row: FlatRow, force?: boolean) => {
    if (!row.expandable || q) return;
    const isOpen = exp.includes(row.node.id);
    const open = force ?? !isOpen;
    if (open === isOpen) return;
    setExp(open ? [...exp, row.node.id] : exp.filter((id) => id !== row.node.id));
    if (open) void load(row.node);
  };

  const choose = (node: TreeNode) => {
    if (node.disabled) return;
    if (selectedId === undefined) setInnerSel(node.id);
    setFocusId(node.id);
    onSelect?.(node);
  };

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    setFocusId(id);
    treeRef.current?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = rows.findIndex((r) => r.node.id === focusId);
    const row = rows[i];
    if (!row) return;
    const key = e.key;
    if (key === "ArrowDown") focusRow(rows[Math.min(rows.length - 1, i + 1)]?.node.id);
    else if (key === "ArrowUp") focusRow(rows[Math.max(0, i - 1)]?.node.id);
    else if (key === "Home") focusRow(rows[0]?.node.id);
    else if (key === "End") focusRow(rows[rows.length - 1]?.node.id);
    else if (key === "ArrowRight") {
      if (row.expandable && !openSet.has(row.node.id)) toggle(row, true);
      else if (row.expandable) focusRow(rows[i + 1]?.node.id);
    } else if (key === "ArrowLeft") {
      if (row.expandable && openSet.has(row.node.id)) toggle(row, false);
      else focusRow(row.parentId);
    } else if (key === "Enter" || key === " ") choose(row.node);
    else if (key === "*") {
      const sibs = rows
        .filter((r) => r.parentId === row.parentId && r.expandable)
        .map((r) => r.node.id);
      setExp(Array.from(new Set([...exp, ...sibs])));
    } else if (key.length === 1 && /\S/.test(key)) {
      const now = Date.now();
      const ta = typeahead.current;
      ta.text = now - ta.t > 600 ? key.toLowerCase() : ta.text + key.toLowerCase();
      ta.t = now;
      const order = [...rows.slice(i + 1), ...rows.slice(0, i + 1)];
      const hit = order.find((r) => r.node.label.toLowerCase().startsWith(ta.text));
      if (hit) focusRow(hit.node.id);
    } else return;
    e.preventDefault();
  };

  const tabStop = rows.some((r) => r.node.id === focusId) ? focusId : rows[0]?.node.id;

  return (
    <div className={cn("flex flex-col gap-2 font-crm", className)}>
      {searchable ? (
        <label className="relative block">
          <span className="sr-only">Filter {label}</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-crm-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${label.toLowerCase()}`}
            className="h-8 w-full rounded-crm border border-crm-input/60 bg-crm-raised pr-2 pl-8 text-sm text-crm-fg outline-none placeholder:text-crm-subtle focus-visible:border-crm-ring focus-visible:ring-2 focus-visible:ring-crm-ring/40 [color-scheme:dark]"
          />
        </label>
      ) : null}
      {rows.length === 0 ? (
        <p className="px-2 py-4 text-center text-xs text-crm-subtle" role="status">
          {q ? `No matches for “${query}”.` : emptyMessage}
        </p>
      ) : (
        <ul
          ref={treeRef}
          role="tree"
          aria-label={label}
          onKeyDown={onKeyDown}
          className="flex flex-col"
        >
          {rows.map((row) => {
            const { node, depth } = row;
            const open = openSet.has(node.id);
            const status = loading[node.id];
            const selected = node.id === sel;
            return (
              <li
                key={node.id}
                role="treeitem"
                data-tree-id={node.id}
                aria-level={depth + 1}
                aria-setsize={row.setSize}
                aria-posinset={row.pos}
                aria-expanded={row.expandable ? open : undefined}
                aria-selected={selected}
                aria-disabled={node.disabled || undefined}
                aria-busy={status === "loading" || undefined}
                tabIndex={node.id === tabStop ? 0 : -1}
                onFocus={() => setFocusId(node.id)}
                onClick={() => choose(node)}
                className={cn(
                  "group flex h-8 cursor-pointer items-center gap-1.5 rounded-crm pr-2 text-sm outline-none select-none",
                  "focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                  selected
                    ? "bg-crm-muted text-crm-fg shadow-crm-raised"
                    : "text-crm-muted-fg hover:bg-crm-raised hover:text-crm-fg",
                  node.disabled && "cursor-not-allowed opacity-40",
                )}
                style={{ paddingLeft: 4 + depth * 16 }}
              >
                <span
                  aria-hidden
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(row);
                  }}
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded text-crm-subtle hover:text-crm-fg",
                    !row.expandable && "invisible",
                  )}
                >
                  {status === "loading" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ChevronRight
                      className={cn(
                        "size-3.5 transition-transform duration-150",
                        open && "rotate-90",
                      )}
                    />
                  )}
                </span>
                <span className="text-crm-soft [&_svg]:size-3.5">
                  {node.icon ?? (row.expandable ? open ? <FolderOpen /> : <Folder /> : <Folder />)}
                </span>
                <span className="min-w-0 flex-1 truncate">{highlight(node.label, q)}</span>
                {status === "error" ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      void load(node);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-crm-danger hover:underline"
                  >
                    <AlertCircle className="size-3" /> Retry
                  </button>
                ) : node.count !== undefined ? (
                  <span className="crm-caption shrink-0 text-crm-subtle tabular-nums">
                    {node.count.toLocaleString()}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
