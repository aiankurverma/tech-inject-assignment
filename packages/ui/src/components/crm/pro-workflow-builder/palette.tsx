import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeDefinition } from "@/components/crm/pro-workflow-builder/types";

export const DND_MIME = "application/x-kitbase-workflow-node";

/**
 * Searchable step catalogue. Items can be dragged onto the canvas, or added at
 * the viewport centre with Enter / click for keyboard and touch users.
 */
export function Palette({
  definitions,
  disabled,
  onAdd,
}: {
  definitions: NodeDefinition[];
  disabled?: boolean;
  onAdd: (def: NodeDefinition) => void;
}) {
  const [q, setQ] = React.useState("");
  const groups = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const map = new Map<string, NodeDefinition[]>();
    for (const d of definitions) {
      if (
        needle &&
        !d.label.toLowerCase().includes(needle) &&
        !d.description?.toLowerCase().includes(needle) &&
        !d.category.toLowerCase().includes(needle)
      )
        continue;
      const list = map.get(d.category);
      if (list) list.push(d);
      else map.set(d.category, [d]);
    }
    return [...map];
  }, [definitions, q]);

  return (
    <div className="flex h-full flex-col bg-crm-sidebar">
      <div className="border-b border-crm-border p-2">
        <label className="flex items-center gap-2 rounded-crm border border-crm-input bg-crm-bg px-2">
          <Search className="h-3.5 w-3.5 text-crm-subtle" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search steps"
            aria-label="Search steps"
            className="h-8 w-full bg-transparent text-sm text-crm-fg placeholder:text-crm-subtle focus:outline-none"
          />
        </label>
      </div>
      <div className="flex-1 overflow-auto p-2" role="list" aria-label="Workflow steps">
        {groups.length === 0 && (
          <p className="p-2 text-xs text-crm-subtle">No steps match “{q}”.</p>
        )}
        {groups.map(([cat, defs]) => (
          <div key={cat} className="mb-3" role="group" aria-label={cat}>
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-crm-subtle">
              {cat}
            </p>
            {defs.map((d) => (
              <button
                key={d.type}
                type="button"
                role="listitem"
                draggable={!disabled}
                disabled={disabled}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DND_MIME, d.type);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => onAdd(d)}
                title={`${d.description ?? d.label} — drag onto the canvas or press Enter`}
                className={cn(
                  "mb-1 flex w-full items-center gap-2 rounded-crm border border-transparent px-2 py-1.5 text-left text-sm text-crm-chip",
                  "cursor-grab hover:border-crm-border hover:bg-crm-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-crm-muted text-crm-icon [&_svg]:h-3.5 [&_svg]:w-3.5">
                  {d.icon}
                </span>
                <span className="min-w-0 truncate">{d.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
