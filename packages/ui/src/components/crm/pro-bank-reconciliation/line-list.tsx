import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { ReconSide } from "@/components/crm/pro-bank-reconciliation/store";

export interface LineRow {
  id: string;
  date: string;
  description: string;
  reference?: string;
  account?: string;
  amount: number;
}

export interface LineListProps {
  side: ReconSide;
  title: string;
  rows: LineRow[];
  selected: ReadonlySet<string>;
  /** id -> match id for rows already reconciled. */
  matched: ReadonlyMap<string, string>;
  /** Best suggestion confidence per row (0..1), shown as a chip. */
  confidence?: ReadonlyMap<string, number>;
  /** Rows highlighted as suggestions for the current selection on the other side. */
  hinted?: ReadonlySet<string>;
  formatMoney: (minor: number) => string;
  onToggle: (id: string, additive: boolean) => void;
  onRange: (ids: string[]) => void;
  onCommit: () => void;
  /** Rows dragged from the other pane were dropped on `targetId`. */
  onDropFromOther: (targetId: string, ids: string[]) => void;
  loading?: boolean;
  emptyText?: string;
  total: number;
  className?: string;
}

const ROW = 52;
const DND_MIME = "application/x-kitbase-recon";

function LineListImpl({
  side,
  title,
  rows,
  selected,
  matched,
  confidence,
  hinted,
  formatMoney,
  onToggle,
  onRange,
  onCommit,
  onDropFromOther,
  loading,
  emptyText = "Nothing here",
  total,
  className,
}: LineListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(0);
  const anchor = React.useRef<number | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);
  const listId = React.useId();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW,
    overscan: 12,
  });

  React.useEffect(() => {
    if (active >= rows.length) setActive(Math.max(0, rows.length - 1));
  }, [rows.length, active]);

  const selectRange = (to: number) => {
    const from = anchor.current ?? to;
    const [a, b] = from < to ? [from, to] : [to, from];
    onRange(rows.slice(a, b + 1).map((r) => r.id));
  };

  const move = (next: number, shift: boolean) => {
    const i = Math.max(0, Math.min(rows.length - 1, next));
    setActive(i);
    virtualizer.scrollToIndex(i, { align: "auto" });
    if (shift) selectRange(i);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!rows.length) return;
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? ROW * 10) / ROW));
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (anchor.current === null || !e.shiftKey) anchor.current = active;
        move(active + 1, e.shiftKey);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (anchor.current === null || !e.shiftKey) anchor.current = active;
        move(active - 1, e.shiftKey);
        break;
      case "PageDown":
        e.preventDefault();
        move(active + page, false);
        break;
      case "PageUp":
        e.preventDefault();
        move(active - page, false);
        break;
      case "Home":
        e.preventDefault();
        move(0, false);
        break;
      case "End":
        e.preventDefault();
        move(rows.length - 1, false);
        break;
      case " ": {
        e.preventDefault();
        const r = rows[active];
        if (r && !matched.has(r.id)) {
          anchor.current = active;
          onToggle(r.id, true);
        }
        break;
      }
      case "Enter":
        e.preventDefault();
        onCommit();
        break;
    }
  };

  const activeRow = rows[active];
  const selectedTotal = React.useMemo(() => {
    let sum = 0;
    for (const r of rows) if (selected.has(r.id)) sum += r.amount;
    return sum;
  }, [rows, selected]);

  return (
    <section
      className={cn("flex h-full min-h-0 flex-col bg-crm-card", className)}
      aria-label={title}
    >
      <header className="flex items-center justify-between gap-2 border-b border-crm-border px-3 py-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-crm-fg">{title}</h3>
          <p className="text-xs text-crm-muted-fg">
            {rows.length.toLocaleString()} shown of {total.toLocaleString()}
            {selected.size > 0 && (
              <>
                {" · "}
                <span className="text-crm-fg">
                  {selected.size} selected ({formatMoney(selectedTotal)})
                </span>
              </>
            )}
          </p>
        </div>
      </header>
      <div
        ref={scrollRef}
        role="listbox"
        id={listId}
        tabIndex={0}
        aria-label={`${title} lines`}
        aria-multiselectable="true"
        aria-busy={loading || undefined}
        aria-activedescendant={activeRow ? `${listId}-${activeRow.id}` : undefined}
        onKeyDown={onKeyDown}
        className="relative min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:ring-inset"
      >
        {loading ? (
          <div className="space-y-2 p-3" aria-hidden>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-crm bg-crm-muted" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="grid h-full place-items-center p-6 text-center text-sm text-crm-muted-fg">
            {emptyText}
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((v) => {
              const r = rows[v.index]!;
              const isSel = selected.has(r.id);
              const isMatched = matched.has(r.id);
              const conf = confidence?.get(r.id);
              const isHint = hinted?.has(r.id);
              return (
                <div
                  key={r.id}
                  id={`${listId}-${r.id}`}
                  role="option"
                  aria-selected={isSel}
                  aria-disabled={isMatched || undefined}
                  draggable={!isMatched}
                  onDragStart={(e) => {
                    const ids = isSel ? [...selected] : [r.id];
                    e.dataTransfer.setData(DND_MIME, JSON.stringify({ side, ids }));
                    e.dataTransfer.effectAllowed = "link";
                  }}
                  onDragOver={(e) => {
                    if (isMatched || !e.dataTransfer.types.includes(DND_MIME)) return;
                    e.preventDefault();
                    setDropTarget(r.id);
                  }}
                  onDragLeave={() => setDropTarget((t) => (t === r.id ? null : t))}
                  onDrop={(e) => {
                    setDropTarget(null);
                    try {
                      const data = JSON.parse(e.dataTransfer.getData(DND_MIME)) as {
                        side: ReconSide;
                        ids: string[];
                      };
                      if (data.side !== side) onDropFromOther(r.id, data.ids);
                    } catch {
                      /* foreign drag payload */
                    }
                  }}
                  onClick={(e) => {
                    if (isMatched) return;
                    setActive(v.index);
                    if (e.shiftKey) {
                      selectRange(v.index);
                      return;
                    }
                    anchor.current = v.index;
                    onToggle(r.id, true);
                  }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: v.size,
                    transform: `translateY(${v.start}px)`,
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 border-b border-crm-border px-3 text-xs select-none",
                    v.index === active && "bg-crm-raised",
                    isSel && "bg-crm-primary/15",
                    isHint && !isSel && "bg-crm-success/10",
                    isMatched && "cursor-default opacity-50",
                    dropTarget === r.id && "ring-2 ring-crm-primary ring-inset",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded border border-crm-input",
                      isSel && "border-crm-primary bg-crm-primary text-crm-primary-fg",
                    )}
                  >
                    {isSel ? "✓" : ""}
                  </span>
                  <span className="w-14 shrink-0 text-crm-muted-fg tabular-nums">
                    {format(parseISO(r.date), "dd MMM")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-crm-fg">{r.description}</span>
                    <span className="block truncate text-crm-muted-fg">
                      {[r.reference, r.account].filter(Boolean).join(" · ") || " "}
                    </span>
                  </span>
                  {isMatched ? (
                    <span className="rounded-full bg-crm-success/15 px-1.5 py-0.5 text-[10px] text-crm-success">
                      Matched
                    </span>
                  ) : conf !== undefined ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                        conf >= 0.85
                          ? "bg-crm-success/15 text-crm-success"
                          : conf >= 0.6
                            ? "bg-crm-warning/15 text-crm-warning"
                            : "bg-crm-muted text-crm-muted-fg",
                      )}
                      title="Best auto-match confidence"
                    >
                      {Math.round(conf * 100)}%
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "w-24 shrink-0 text-right font-medium tabular-nums",
                      r.amount < 0 ? "text-crm-danger" : "text-crm-fg",
                    )}
                  >
                    {formatMoney(r.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/** Virtualised, keyboard-driven, drag-enabled list of statement or ledger lines. */
export const LineList = React.memo(LineListImpl);
