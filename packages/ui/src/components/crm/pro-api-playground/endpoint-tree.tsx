import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight, Search } from "lucide-react";
import type {
  ApiOperation,
  ApiSpec,
  HttpMethod,
} from "@/components/crm/pro-api-playground/openapi";
import { cn } from "@/lib/utils";

export const methodClass: Record<HttpMethod, string> = {
  get: "text-crm-success",
  post: "text-sky-400",
  put: "text-crm-warning",
  patch: "text-violet-300",
  delete: "text-crm-danger",
  head: "text-crm-soft",
  options: "text-crm-soft",
};

export function MethodBadge({ method, className }: { method: HttpMethod; className?: string }) {
  return (
    <span
      className={cn(
        "w-12 shrink-0 font-mono text-[10px] font-semibold uppercase",
        methodClass[method],
        className,
      )}
    >
      {method === "delete" ? "DEL" : method === "options" ? "OPT" : method}
    </span>
  );
}

type Node =
  | { kind: "tag"; key: string; name: string; count: number; expanded: boolean }
  | { kind: "op"; key: string; op: ApiOperation };

export interface EndpointTreeProps {
  spec: ApiSpec;
  selectedId: string | null;
  onSelect: (op: ApiOperation) => void;
}

/** Virtualised, searchable ARIA tree of operations grouped by tag (scales to thousands of endpoints). */
export function EndpointTree({ spec, selectedId, onSelect }: EndpointTreeProps) {
  const [query, setQuery] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const [focusKey, setFocusKey] = React.useState<string | null>(null);
  const deferred = React.useDeferredValue(query);

  const nodes = React.useMemo<Node[]>(() => {
    const q = deferred.trim().toLowerCase();
    const out: Node[] = [];
    for (const tag of spec.tags) {
      const ops = q
        ? tag.operations.filter((o) =>
            `${o.method} ${o.path} ${o.summary ?? ""} ${o.operationId ?? ""}`
              .toLowerCase()
              .includes(q),
          )
        : tag.operations;
      if (!ops.length) continue;
      const expanded = q !== "" || !collapsed.has(tag.name);
      out.push({
        kind: "tag",
        key: `tag:${tag.name}`,
        name: tag.name,
        count: ops.length,
        expanded,
      });
      if (expanded) for (const op of ops) out.push({ kind: "op", key: op.id, op });
    }
    return out;
  }, [spec, deferred, collapsed]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: nodes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (nodes[i]?.kind === "tag" ? 32 : 30),
    overscan: 10,
  });

  const focusIndex = Math.max(
    0,
    nodes.findIndex((n) => n.key === (focusKey ?? selectedId)),
  );
  const toggle = (name: string, open?: boolean) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      const isOpen = !next.has(name);
      if (open ?? !isOpen) next.delete(name);
      else next.add(name);
      return next;
    });

  const focusAt = (i: number) => {
    const n = nodes[Math.max(0, Math.min(nodes.length - 1, i))];
    if (!n) return;
    setFocusKey(n.key);
    v.scrollToIndex(nodes.indexOf(n), { align: "auto" });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = nodes[focusIndex];
    if (!n) return;
    const actions: Record<string, () => void> = {
      ArrowDown: () => focusAt(focusIndex + 1),
      ArrowUp: () => focusAt(focusIndex - 1),
      Home: () => focusAt(0),
      End: () => focusAt(nodes.length - 1),
      ArrowRight: () => {
        if (n.kind !== "tag") return;
        if (n.expanded) focusAt(focusIndex + 1);
        else toggle(n.name, true);
      },
      ArrowLeft: () => {
        if (n.kind === "tag") return toggle(n.name, false);
        for (let i = focusIndex; i >= 0; i--) if (nodes[i]!.kind === "tag") return focusAt(i);
      },
      Enter: () => (n.kind === "tag" ? toggle(n.name) : onSelect(n.op)),
      " ": () => (n.kind === "tag" ? toggle(n.name) : onSelect(n.op)),
    };
    const fn = actions[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative border-b border-crm-border p-2">
        <Search
          className="pointer-events-none absolute left-4 top-4 size-3.5 text-crm-muted-fg"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Filter ${spec.operations.length} endpoints`}
          aria-label="Filter endpoints"
          className="h-8 w-full rounded-crm border border-crm-input bg-crm-bg pl-7 pr-2 text-sm text-crm-fg outline-none placeholder:text-crm-muted-fg focus:border-crm-ring"
        />
      </div>
      <div
        ref={scrollRef}
        role="tree"
        aria-label={`${spec.title} endpoints`}
        tabIndex={0}
        aria-activedescendant={
          nodes[focusIndex] ? `ep-${encodeURIComponent(nodes[focusIndex]!.key)}` : undefined
        }
        onKeyDown={onKeyDown}
        className="min-h-0 flex-1 overflow-y-auto py-1 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-crm-ring"
      >
        {nodes.length === 0 && (
          <p className="p-4 text-center text-sm text-crm-muted-fg">No endpoints match “{query}”.</p>
        )}
        <div style={{ height: v.getTotalSize(), position: "relative" }}>
          {v.getVirtualItems().map((vi) => {
            const n = nodes[vi.index]!;
            const focused = vi.index === focusIndex;
            const style: React.CSSProperties = {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: vi.size,
              transform: `translateY(${vi.start}px)`,
            };
            const id = `ep-${encodeURIComponent(n.key)}`;
            if (n.kind === "tag")
              return (
                <div
                  key={n.key}
                  id={id}
                  role="treeitem"
                  aria-level={1}
                  aria-expanded={n.expanded}
                  aria-selected={false}
                  style={style}
                  onClick={() => (setFocusKey(n.key), toggle(n.name))}
                  className={cn(
                    "flex cursor-pointer items-center gap-1 px-2 text-xs font-semibold uppercase tracking-wide text-crm-muted-fg hover:text-crm-fg",
                    focused && "bg-crm-muted/60 text-crm-fg",
                  )}
                >
                  <ChevronRight
                    className={cn("size-3.5 transition-transform", n.expanded && "rotate-90")}
                    aria-hidden
                  />
                  <span className="truncate">{n.name}</span>
                  <span className="ml-auto font-normal tabular-nums">{n.count}</span>
                </div>
              );
            const selected = n.op.id === selectedId;
            return (
              <div
                key={n.key}
                id={id}
                role="treeitem"
                aria-level={2}
                aria-selected={selected}
                title={n.op.summary ?? n.op.path}
                style={style}
                onClick={() => (setFocusKey(n.key), onSelect(n.op))}
                className={cn(
                  "flex cursor-pointer items-center gap-1 pl-6 pr-2 text-sm text-crm-soft hover:bg-crm-card hover:text-crm-fg",
                  focused && "bg-crm-muted/60",
                  selected &&
                    "bg-crm-card text-crm-fg shadow-[inset_2px_0_0_var(--color-crm-primary)]",
                  n.op.deprecated && "line-through opacity-60",
                )}
              >
                <MethodBadge method={n.op.method} />
                <span className="truncate">{n.op.summary ?? n.op.path}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
