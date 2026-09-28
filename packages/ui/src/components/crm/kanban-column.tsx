import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountBadge } from "@/components/crm/badge";
import { DealCard, type Deal } from "@/components/crm/deal-card";

export interface KanbanColumnProps {
  title: string;
  deals: Deal[];
  /** Colour dot before the title (any CSS colour). */
  color?: string;
  /** Shown under the title; defaults to the summed deal amount. */
  subtitle?: React.ReactNode;
  onAdd?: () => void;
  onOpenDeal?: (deal: Deal) => void;
  /** Called with the dropped deal id when a card is dropped on this column. */
  onDropDeal?: (dealId: string) => void;
  /** Soft cap; header turns amber when exceeded. */
  limit?: number;
  className?: string;
}

const DRAG_TYPE = "application/x-kitbase-deal";

/**
 * One pipeline column: header with count and total, scrollable DealCards, add button.
 * Uses native HTML drag and drop between columns (no extra dependency).
 */
export function KanbanColumn({
  title,
  deals,
  color = "#6346ff",
  subtitle,
  onAdd,
  onOpenDeal,
  onDropDeal,
  limit,
  className,
}: KanbanColumnProps) {
  const [over, setOver] = React.useState(false);
  const total = deals.reduce((sum, d) => sum + d.amount, 0);
  const overLimit = limit !== undefined && deals.length > limit;
  const headingId = React.useId();
  return (
    <section
      aria-labelledby={headingId}
      onDragOver={
        onDropDeal
          ? (e) => {
              if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
              e.preventDefault();
              setOver(true);
            }
          : undefined
      }
      onDragLeave={() => setOver(false)}
      onDrop={
        onDropDeal
          ? (e) => {
              e.preventDefault();
              setOver(false);
              const id = e.dataTransfer.getData(DRAG_TYPE);
              if (id) onDropDeal(id);
            }
          : undefined
      }
      className={cn(
        "flex max-h-full w-[280px] shrink-0 flex-col rounded-xl border bg-crm-sidebar font-crm transition-colors duration-150",
        over ? "border-crm-primary bg-crm-primary/5" : "border-crm-border",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="min-w-0">
          <h3 id={headingId} className="flex items-center gap-2 text-sm font-medium text-crm-fg">
            <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
            <span className="truncate">{title}</span>
            <CountBadge className={overLimit ? "bg-crm-warning text-[#161616]" : undefined}>
              {deals.length}
              {limit !== undefined ? `/${limit}` : ""}
            </CountBadge>
          </h3>
          <p className="mt-1 text-xs text-crm-subtle tabular-nums">
            {subtitle ?? `$${total.toLocaleString("en-US")}`}
          </p>
        </div>
        {onAdd ? (
          <button
            type="button"
            aria-label={`Add deal to ${title}`}
            onClick={onAdd}
            className="grid size-6 cursor-pointer place-items-center rounded-full text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            <Plus className="size-3.5" />
          </button>
        ) : null}
      </header>
      <ul className="flex min-h-16 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {deals.map((d) => (
          <li key={d.id}>
            <DealCard
              deal={d}
              onOpen={onOpenDeal}
              draggable={!!onDropDeal}
              onDragStart={(e, deal) => {
                e.dataTransfer.setData(DRAG_TYPE, deal.id);
                e.dataTransfer.effectAllowed = "move";
              }}
            />
          </li>
        ))}
        {!deals.length ? (
          <li className="grid h-16 place-items-center rounded-crm border border-dashed border-crm-border text-xs text-crm-subtle">
            No deals
          </li>
        ) : null}
      </ul>
    </section>
  );
}
