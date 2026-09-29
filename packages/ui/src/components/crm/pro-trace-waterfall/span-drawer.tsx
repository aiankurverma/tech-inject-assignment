import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { selfTime } from "@/hooks/use-span-tree";
import type { SpanNode } from "@/components/crm/pro-trace-waterfall/types";
import { formatDuration } from "@/components/crm/pro-trace-waterfall/time-scale";

export interface SpanDrawerProps {
  node: SpanNode | null;
  traceStart: number;
  onOpenChange: (open: boolean) => void;
  onFocusSpan: (id: string) => void;
}

/** Right-hand sheet (Radix Dialog: focus trap, Esc, focus return) with span facts and attributes. */
export function SpanDrawer({ node, traceStart, onOpenChange, onFocusSpan }: SpanDrawerProps) {
  const [filter, setFilter] = useState("");
  const attrs = useMemo(() => {
    const entries = Object.entries(node?.span.attributes ?? {});
    const q = filter.trim().toLowerCase();
    return q
      ? entries.filter(
          ([k, v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q),
        )
      : entries;
  }, [node, filter]);
  const s = node?.span;
  return (
    <Dialog.Root open={!!node} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-overlay outline-none animate-crm-sheet-in"
          aria-describedby={undefined}
        >
          {node && s && (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-crm-border p-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-crm-muted-fg">
                    {s.service}
                  </p>
                  <Dialog.Title className="mt-0.5 break-words text-sm font-semibold">
                    {s.name}
                  </Dialog.Title>
                  {s.status === "error" && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-crm-danger">
                      <AlertCircle className="size-3.5" /> Span ended with an error
                    </p>
                  )}
                </div>
                <Dialog.Close
                  aria-label="Close span details"
                  className="rounded-md p-1 text-crm-muted-fg hover:bg-crm-raised hover:text-crm-fg"
                >
                  <X className="size-4" />
                </Dialog.Close>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["Duration", formatDuration(s.duration)],
                    ["Self time", formatDuration(selfTime(node))],
                    ["Starts at", `+${formatDuration(s.startTime - traceStart)}`],
                    ["Kind", s.kind ?? "internal"],
                    ["Children", `${node.children.length} direct · ${node.descendants} total`],
                    ["Depth", String(node.depth)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-md border border-crm-border bg-crm-bg p-2">
                      <dt className="text-[10px] uppercase tracking-wide text-crm-muted-fg">{k}</dt>
                      <dd className="mt-0.5 tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="font-mono text-[11px] text-crm-muted-fg">
                  span {s.spanId}
                  {node.parent && (
                    <>
                      {" · parent "}
                      <button
                        type="button"
                        onClick={() => onFocusSpan(node.parent!.span.spanId)}
                        className="text-crm-soft underline decoration-dotted hover:text-crm-fg"
                      >
                        {node.parent.span.spanId}
                      </button>
                    </>
                  )}
                </div>
                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-[11px] font-medium uppercase tracking-wide text-crm-muted-fg">
                      Attributes ({attrs.length})
                    </h3>
                    <div className="flex items-center gap-1 rounded-md border border-crm-input px-1.5 focus-within:border-crm-ring">
                      <Search className="size-3 text-crm-muted-fg" aria-hidden />
                      <input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Filter"
                        aria-label="Filter attributes"
                        className="w-28 bg-transparent py-1 text-xs outline-none placeholder:text-crm-subtle"
                      />
                    </div>
                  </div>
                  {attrs.length === 0 ? (
                    <p className="text-xs text-crm-muted-fg">No attributes.</p>
                  ) : (
                    <table className="w-full table-fixed text-[11px]">
                      <tbody>
                        {attrs.map(([k, v]) => (
                          <tr
                            key={k}
                            className="border-b border-crm-border align-top last:border-b-0"
                          >
                            <th
                              scope="row"
                              className="w-2/5 break-all py-1 pr-2 text-left font-mono font-normal text-crm-muted-fg"
                            >
                              {k}
                            </th>
                            <td
                              className={cn(
                                "break-all py-1 font-mono",
                                typeof v === "number"
                                  ? "text-tag-blue-text"
                                  : typeof v === "boolean"
                                    ? "text-tag-purple-text"
                                    : "text-crm-soft",
                              )}
                            >
                              {String(v)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
                {s.events && s.events.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-crm-muted-fg">
                      Events ({s.events.length})
                    </h3>
                    <ol className="space-y-1.5">
                      {s.events.map((ev, i) => (
                        <li
                          key={i}
                          className="rounded-md border border-crm-border bg-crm-bg p-2 text-xs"
                        >
                          <div className="flex justify-between gap-2">
                            <span
                              className={
                                ev.name === "exception" ? "text-crm-danger" : "text-crm-fg"
                              }
                            >
                              {ev.name}
                            </span>
                            <span className="tabular-nums text-crm-muted-fg">
                              +{formatDuration(ev.time - s.startTime)}
                            </span>
                          </div>
                          {ev.attributes &&
                            Object.entries(ev.attributes).map(([k, v]) => (
                              <p
                                key={k}
                                className="mt-1 break-all font-mono text-[11px] text-crm-muted-fg"
                              >
                                {k}={String(v)}
                              </p>
                            ))}
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
