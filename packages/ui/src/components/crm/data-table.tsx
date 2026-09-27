import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Scroll container + table. Rows are 42px, headers 38px, borders between rows. */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full min-w-max border-collapse font-crm text-sm text-crm-fg", className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
}

export function TableRow({ selected, className, ...props }: TableRowProps) {
  return (
    <tr
      data-selected={selected || undefined}
      aria-selected={selected || undefined}
      className={cn(
        "border-b border-crm-border transition-colors duration-150 ease-crm hover:bg-crm-card/60 data-[selected]:bg-crm-card",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  align = "left",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "crm-caption h-[38px] px-3 font-normal whitespace-nowrap text-crm-subtle",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  align = "left",
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "h-[42px] px-3 whitespace-nowrap",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

export interface AggregateCell {
  label: string;
  value?: React.ReactNode;
  /** When set, the cell becomes a "+ label" button (e.g. add a calculation). */
  onAdd?: () => void;
}

/** Sticky footer bar with totals and "+ Add calculation" cells. */
export function TableFooterBar({
  cells,
  className,
}: {
  cells: AggregateCell[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid border-t border-crm-border font-crm text-xs text-crm-muted-fg",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
    >
      {cells.map((c) =>
        c.onAdd ? (
          <button
            key={c.label}
            type="button"
            onClick={c.onAdd}
            className="flex cursor-pointer items-center gap-2 border-r border-crm-border p-3 text-left last:border-r-0 hover:bg-crm-card hover:text-crm-fg focus-visible:bg-crm-card focus-visible:outline-none"
          >
            <Plus className="size-3" aria-hidden />
            {c.label}
          </button>
        ) : (
          <div
            key={c.label}
            className="flex items-center gap-2 border-r border-crm-border p-3 last:border-r-0"
          >
            {c.value !== undefined ? (
              <span className="text-crm-fg tabular-nums">{c.value}</span>
            ) : null}
            {c.label}
          </div>
        ),
      )}
    </div>
  );
}
