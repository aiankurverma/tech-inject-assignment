import * as React from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { CheckCircle2, Search, Trash2, XCircle } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { HistoryEntry } from "@/components/crm/pro-sql-console/types";

export interface QueryHistoryProps {
  entries: HistoryEntry[];
  /** Loads a past query into the editor (Shift opens it in a new tab). */
  onSelect: (entry: HistoryEntry, newTab: boolean) => void;
  onClear?: () => void;
}

const num = new Intl.NumberFormat("en-US");

/** Virtualised, searchable run history (holds thousands of entries cheaply). */
export function QueryHistory({ entries, onSelect, onClear }: QueryHistoryProps) {
  const [query, setQuery] = React.useState("");
  const q = React.useDeferredValue(query.trim().toLowerCase());
  const list = React.useMemo(
    () => (q ? entries.filter((e) => e.sql.toLowerCase().includes(q)) : entries),
    [entries, q],
  );
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: list.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 58,
    overscan: 8,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="m-2 flex items-center gap-1">
        <label className="flex flex-1 items-center gap-1.5 rounded-crm border border-crm-border bg-crm-input px-2 focus-within:ring-1 focus-within:ring-crm-ring">
          <Search className="size-3.5 text-crm-subtle" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search history"
            aria-label="Search query history"
            className="h-7 w-full bg-transparent text-xs text-crm-fg outline-none placeholder:text-crm-subtle"
          />
        </label>
        {onClear && entries.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear history"
            title="Clear history"
            className="rounded-crm p-1.5 text-crm-subtle hover:bg-crm-muted hover:text-crm-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crm-ring"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      {!list.length ? (
        <p className="px-3 py-4 text-xs text-crm-subtle">
          {entries.length ? "No matching queries" : "Queries you run appear here"}
        </p>
      ) : (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto"
          role="list"
          aria-label="Query history"
        >
          <div style={{ height: v.getTotalSize(), position: "relative" }}>
            {v.getVirtualItems().map((item) => {
              const e = list[item.index];
              if (!e) return null;
              return (
                <div
                  key={e.id}
                  role="listitem"
                  className="absolute inset-x-0 px-1"
                  style={{ height: item.size, transform: `translateY(${item.start}px)` }}
                >
                  <button
                    type="button"
                    onClick={(ev) => onSelect(e, ev.shiftKey)}
                    title={`${e.sql}\n\nClick to load, Shift+click for a new tab`}
                    className="flex h-[54px] w-full flex-col gap-1 rounded-crm px-2 py-1.5 text-left hover:bg-crm-muted/60 focus-visible:bg-crm-muted focus-visible:outline-none"
                  >
                    <code className="line-clamp-1 w-full break-all font-mono text-[11px] text-crm-fg">
                      {e.sql.replace(/\s+/g, " ")}
                    </code>
                    <span className="flex items-center gap-1.5 text-[10px] text-crm-subtle">
                      {e.ok ? (
                        <CheckCircle2 className="size-3 text-crm-success" aria-label="Succeeded" />
                      ) : (
                        <XCircle className="size-3 text-crm-danger" aria-label="Failed" />
                      )}
                      {formatDistanceToNowStrict(e.at, { addSuffix: true })}
                      {e.durationMs != null && <span>· {num.format(e.durationMs)} ms</span>}
                      {e.rowCount != null && <span>· {num.format(e.rowCount)} rows</span>}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
