import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format, formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";
import type {
  FlagAuditEntry,
  FlagEnvironment,
} from "@/components/crm/pro-feature-flag-console/types";

const ACTION_STYLE: Record<FlagAuditEntry["action"], string> = {
  enabled: "bg-crm-success/15 text-crm-success",
  disabled: "bg-crm-danger/15 text-crm-danger",
  updated: "bg-crm-primary/20 text-crm-fg",
  created: "bg-crm-muted text-crm-soft",
};

/** Virtualised, newest-first audit log with dynamic row heights (measureElement). */
export function AuditTrail({
  entries,
  environments,
}: {
  entries: FlagAuditEntry[];
  environments: FlagEnvironment[];
}) {
  const envName = React.useMemo(
    () => new Map(environments.map((e) => [e.key, e.name])),
    [environments],
  );
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    getItemKey: (i) => entries[i]?.id ?? i,
    overscan: 6,
  });

  if (!entries.length) {
    return (
      <p className="p-4 text-center text-xs text-crm-muted-fg">
        No changes recorded for this flag yet.
      </p>
    );
  }
  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto"
      role="feed"
      aria-label="Audit trail"
      aria-busy="false"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const e = entries[vi.index]!;
          return (
            <article
              key={vi.key}
              ref={virtualizer.measureElement}
              data-index={vi.index}
              aria-posinset={vi.index + 1}
              aria-setsize={entries.length}
              className="absolute inset-x-0 border-b border-crm-border px-4 py-2.5 text-xs"
              style={{ transform: `translateY(${vi.start}px)` }}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-crm-fg">{e.actor}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-px text-[10px] font-medium uppercase",
                    ACTION_STYLE[e.action],
                  )}
                >
                  {e.action}
                </span>
                <span className="text-crm-muted-fg">
                  in {envName.get(e.environment) ?? e.environment}
                </span>
                <time
                  dateTime={e.at}
                  title={format(Date.parse(e.at), "PPpp")}
                  className="ml-auto tabular-nums text-crm-subtle"
                >
                  {formatDistanceToNowStrict(Date.parse(e.at), { addSuffix: true })}
                </time>
              </div>
              {e.comment ? <p className="mt-1 text-crm-soft">“{e.comment}”</p> : null}
              {e.changes?.length ? (
                <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-crm-muted-fg">
                  {e.changes.slice(0, 4).map((c, i) => (
                    <li key={i} className="truncate" title={c}>
                      {c}
                    </li>
                  ))}
                  {e.changes.length > 4 ? <li>+{e.changes.length - 4} more</li> : null}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
