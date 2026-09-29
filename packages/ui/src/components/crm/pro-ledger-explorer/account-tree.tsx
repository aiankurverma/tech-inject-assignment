import * as React from "react";
import { Tree, type NodeRendererProps } from "react-arborist";
import { ChevronRight, Folder, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LedgerAccount } from "@/components/crm/pro-ledger-explorer/ledger-model";

interface TreeNode {
  id: string;
  name: string;
  code: string;
  children?: TreeNode[];
}

function buildTree(accounts: LedgerAccount[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  for (const a of accounts) nodes.set(a.id, { id: a.id, name: a.name, code: a.code });
  const roots: TreeNode[] = [];
  for (const a of accounts) {
    const node = nodes.get(a.id)!;
    const parent = a.parentId ? nodes.get(a.parentId) : undefined;
    if (parent) (parent.children ??= []).push(node);
    else roots.push(node);
  }
  const sort = (list: TreeNode[]) => {
    list.sort((x, y) => x.code.localeCompare(y.code));
    for (const n of list) if (n.children) sort(n.children);
  };
  sort(roots);
  return roots;
}

export interface AccountTreeProps {
  accounts: LedgerAccount[];
  selected: ReadonlySet<string>;
  onSelectedChange: (ids: Set<string>) => void;
  height: number;
  className?: string;
}

/** Virtualised, keyboard-navigable chart of accounts (react-arborist). Multi-select with Ctrl/Shift. */
export function AccountTree({
  accounts,
  selected,
  onSelectedChange,
  height,
  className,
}: AccountTreeProps) {
  const data = React.useMemo(() => buildTree(accounts), [accounts]);
  const [search, setSearch] = React.useState("");
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(240);
  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((es) =>
      setWidth(Math.max(160, Math.floor(es[0]?.contentRect.width ?? 240))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter accounts"
          aria-label="Filter accounts"
          className="h-8 w-full rounded-crm border border-crm-border bg-crm-input px-2.5 text-xs text-crm-fg placeholder:text-crm-muted-fg focus:outline-none focus:ring-2 focus:ring-crm-ring"
        />
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => onSelectedChange(new Set())}
            className="shrink-0 text-xs text-crm-primary hover:underline"
          >
            Clear
          </button>
        )}
      </div>
      <div ref={wrapRef} className="min-w-0" role="presentation">
        <Tree<TreeNode>
          data={data}
          openByDefault
          width={width}
          height={height}
          rowHeight={28}
          indent={14}
          searchTerm={search}
          searchMatch={(node, term) =>
            `${node.data.code} ${node.data.name}`.toLowerCase().includes(term.toLowerCase())
          }
          disableDrag
          disableDrop
          disableEdit
          selection={selected.size === 1 ? [...selected][0] : undefined}
          onSelect={(nodes) => {
            const ids = new Set(nodes.map((n) => n.id));
            const same = ids.size === selected.size && [...ids].every((i) => selected.has(i));
            if (!same) onSelectedChange(ids);
          }}
        >
          {TreeRow}
        </Tree>
      </div>
    </div>
  );
}

function TreeRow({ node, style, dragHandle }: NodeRendererProps<TreeNode>) {
  const leaf = node.isLeaf;
  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        "flex h-full cursor-pointer items-center gap-1.5 rounded-md pr-2 text-xs",
        node.isSelected ? "bg-crm-primary/15 text-crm-fg" : "text-crm-muted-fg hover:bg-crm-muted",
        node.isFocused && "ring-1 ring-inset ring-crm-ring",
      )}
    >
      <span
        className="grid size-4 place-items-center"
        onClick={(e) => {
          e.stopPropagation();
          node.toggle();
        }}
      >
        {!leaf && (
          <ChevronRight className={cn("size-3 transition-transform", node.isOpen && "rotate-90")} />
        )}
      </span>
      {leaf ? <FileText className="size-3.5 shrink-0" /> : <Folder className="size-3.5 shrink-0" />}
      <span className="font-mono text-[11px] text-crm-faint">{node.data.code}</span>
      <span className="truncate">{node.data.name}</span>
    </div>
  );
}
