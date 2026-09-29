import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { preview, toDisplayPath, type Change, type ChangeKind } from "@/lib/json-explorer";

const KINDS: ChangeKind[] = ["added", "removed", "modified", "moved"];
const DOT: Record<ChangeKind, string> = {
  added: "bg-crm-success",
  removed: "bg-crm-danger",
  modified: "bg-crm-warning",
  moved: "bg-crm-primary",
};

export interface DiffViewProps {
  changes: Change[];
  pending: boolean;
  onJump: (change: Change) => void;
  beforeLabel: string;
  afterLabel: string;
}

/** Virtualised, filterable change list produced from a jsondiffpatch delta. */
export function DiffView({ changes, pending, onJump, beforeLabel, afterLabel }: DiffViewProps) {
  const [hidden, setHidden] = React.useState<ReadonlySet<ChangeKind>>(new Set());
  const counts = React.useMemo(() => {
    const c: Record<ChangeKind, number> = { added: 0, removed: 0, modified: 0, moved: 0 };
    for (const ch of changes) c[ch.kind]++;
    return c;
  }, [changes]);
  const visible = React.useMemo(
    () => (hidden.size ? changes.filter((c) => !hidden.has(c.kind)) : changes),
    [changes, hidden],
  );
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border px-3 py-2 text-xs">
        <span className="text-crm-muted-fg">
          {beforeLabel} → {afterLabel}
        </span>
        <span className="mx-1 h-4 w-px bg-crm-border" aria-hidden />
        {KINDS.map((k) => {
          const off = hidden.has(k);
          return (
            <button
              key={k}
              type="button"
              aria-pressed={!off}
              onClick={() =>
                setHidden((h) => {
                  const n = new Set(h);
                  if (n.has(k)) n.delete(k);
                  else n.add(k);
                  return n;
                })
              }
              className={cn(
                "flex items-center gap-1.5 rounded-full border border-crm-border px-2 py-0.5 capitalize",
                off ? "text-crm-faint" : "text-crm-fg",
              )}
            >
              <span
                className={cn("size-1.5 rounded-full", DOT[k], off && "opacity-30")}
                aria-hidden
              />
              {k} <span className="tabular-nums text-crm-muted-fg">{counts[k]}</span>
            </button>
          );
        })}
        {pending && <span className="ml-auto text-crm-muted-fg">Computing diff…</span>}
      </div>
      {visible.length === 0 ? (
        <div className="grid flex-1 place-items-center p-8 text-sm text-crm-muted-fg">
          {changes.length === 0 ? "Payloads are identical." : "No changes match the filters."}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto"
          role="list"
          aria-label="Changes"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const c = visible[vi.index];
              if (!c) return null;
              return (
                <button
                  key={vi.key}
                  type="button"
                  role="listitem"
                  onClick={() => onJump(c)}
                  style={{ transform: `translateY(${vi.start}px)`, height: vi.size }}
                  className="absolute top-0 left-0 flex w-full flex-col justify-center gap-0.5 border-b border-crm-border px-3 text-left font-mono text-xs hover:bg-crm-raised focus-visible:bg-crm-raised focus-visible:outline-none"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn("size-1.5 shrink-0 rounded-full", DOT[c.kind])}
                      aria-hidden
                    />
                    <span className="truncate text-crm-icon">{toDisplayPath(c.path)}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-crm-muted-fg uppercase">
                      {c.kind}
                    </span>
                  </span>
                  <span className="truncate pl-3.5">
                    {c.kind === "moved" ? (
                      <span className="text-crm-primary">moved to index {c.to}</span>
                    ) : (
                      <>
                        {"before" in c && c.kind !== "added" && (
                          <span className="text-crm-danger line-through decoration-crm-danger/50">
                            {preview(c.before, 60)}
                          </span>
                        )}
                        {c.kind === "modified" && <span className="px-1.5 text-crm-faint">→</span>}
                        {c.kind !== "removed" && (
                          <span className="text-crm-success">{preview(c.after, 60)}</span>
                        )}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
