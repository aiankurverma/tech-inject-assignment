import * as React from "react";
import { CalendarClock, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { MoneyValue } from "@/components/crm/data-cells";
import { Tag, type TagColor } from "@/components/crm/tag";

export interface Deal {
  id: string;
  title: string;
  company: string;
  amount: number;
  currency?: string;
  /** Win probability 0–100. */
  probability?: number;
  closeDate?: string;
  owner?: { name: string; avatar?: string };
  tag?: { label: string; color: TagColor };
  /** Highlights the date in red. */
  overdue?: boolean;
}

export interface DealCardProps {
  deal: Deal;
  onOpen?: (deal: Deal) => void;
  /** Shows a grip handle and sets draggable; wire onDragStart yourself. */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, deal: Deal) => void;
  selected?: boolean;
  className?: string;
}

const probTone = (p: number) =>
  p >= 70 ? "bg-crm-success" : p >= 40 ? "bg-crm-warning" : "bg-crm-danger";

/** Compact deal tile for boards and lists: title, company, amount, probability, close date, owner. */
export function DealCard({
  deal,
  onOpen,
  draggable,
  onDragStart,
  selected,
  className,
}: DealCardProps) {
  const { title, company, amount, currency, probability, closeDate, owner, tag, overdue } = deal;
  return (
    <article
      aria-label={`${title}, ${company}`}
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart?.(e, deal) : undefined}
      data-selected={selected || undefined}
      className={cn(
        "group relative flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-3 font-crm shadow-crm-raised",
        "transition-[border-color,background-color] duration-150 ease-crm hover:border-crm-input",
        selected && "border-crm-primary",
        draggable && "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        {draggable ? (
          <GripVertical
            aria-hidden
            className="mt-0.5 size-3.5 shrink-0 text-crm-faint opacity-0 transition-opacity group-hover:opacity-100"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          {onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(deal)}
              className="block w-full truncate text-left text-sm font-medium text-crm-fg outline-none after:absolute after:inset-0 after:rounded-crm focus-visible:after:ring-2 focus-visible:after:ring-crm-ring/60"
            >
              {title}
            </button>
          ) : (
            <h4 className="truncate text-sm font-medium text-crm-fg">{title}</h4>
          )}
          <p className="mt-1 truncate text-xs text-crm-soft">{company}</p>
        </div>
        {tag ? (
          <Tag color={tag.color} size="sm">
            {tag.label}
          </Tag>
        ) : null}
      </div>
      <div className="flex items-center justify-between">
        <MoneyValue amount={amount} currency={currency} />
        {probability !== undefined ? (
          <span className="flex items-center gap-1.5 text-xs text-crm-soft tabular-nums">
            <span
              role="meter"
              aria-label="Win probability"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={probability}
              className="h-1 w-10 overflow-hidden rounded-full bg-crm-track"
            >
              <span
                className={cn("block h-full rounded-full", probTone(probability))}
                style={{ width: `${Math.min(100, Math.max(0, probability))}%` }}
              />
            </span>
            {probability}%
          </span>
        ) : null}
      </div>
      {closeDate || owner ? (
        <div className="flex items-center justify-between border-t border-crm-border pt-2.5">
          {closeDate ? (
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                overdue ? "text-crm-danger" : "text-crm-subtle",
              )}
            >
              <CalendarClock className="size-3" aria-hidden />
              {overdue ? <span className="sr-only">Overdue:</span> : null}
              {closeDate}
            </span>
          ) : (
            <span />
          )}
          {owner ? <Avatar name={owner.name} src={owner.avatar} size="sm" /> : null}
        </div>
      ) : null}
    </article>
  );
}
