import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Pages shown either side of the current one. */
  siblings?: number;
  /** "full" = numbered pages, "compact" = "Page 3 of 12" with arrows. */
  variant?: "full" | "compact";
  /** Optional "1–25 of 312" summary on the left. */
  total?: number;
  pageSize?: number;
  className?: string;
}

/** Build the page list with gaps, e.g. [1, "gap", 4, 5, 6, "gap", 20]. */
export function pageRange(page: number, count: number, siblings = 1): (number | "gap")[] {
  if (count < 1) return [];
  const out: (number | "gap")[] = [1];
  const start = Math.max(2, page - siblings);
  const end = Math.min(count - 1, page + siblings);
  if (start > 2) out.push("gap");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < count - 1) out.push("gap");
  if (count > 1) out.push(count);
  return out;
}

const btn =
  "inline-flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-full px-2 text-xs tabular-nums outline-none transition-colors duration-150 ease-crm focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5";

/** Table/list pager with prev/next, numbered pages, ellipsis gaps and an optional range summary. */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  siblings = 1,
  variant = "full",
  total,
  pageSize,
  className,
}: PaginationProps) {
  const go = (p: number) => onPageChange(Math.min(pageCount, Math.max(1, p)));
  const hasSummary = total !== undefined && !!pageSize;
  const from = hasSummary ? Math.min(total, (page - 1) * pageSize + 1) : 0;
  const to = hasSummary ? Math.min(total, page * pageSize) : 0;
  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-between gap-4 font-crm", className)}
    >
      {hasSummary ? (
        <p className="text-xs text-crm-subtle tabular-nums">
          {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
        </p>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
          className={cn(btn, "bg-crm-raised text-crm-fg shadow-crm-raised hover:bg-crm-muted")}
        >
          <ChevronLeft />
        </button>
        {variant === "compact" ? (
          <span className="px-2 text-xs text-crm-soft tabular-nums" aria-live="polite">
            Page <span className="text-crm-fg">{page}</span> of {pageCount}
          </span>
        ) : (
          pageRange(page, pageCount, siblings).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} aria-hidden className="px-1 text-xs text-crm-faint">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                onClick={() => go(p)}
                className={cn(
                  btn,
                  p === page
                    ? "bg-crm-primary text-crm-primary-fg shadow-crm-primary"
                    : "text-crm-soft hover:bg-crm-muted hover:text-crm-fg",
                )}
              >
                {p}
              </button>
            ),
          )
        )}
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => go(page + 1)}
          className={cn(btn, "bg-crm-raised text-crm-fg shadow-crm-raised hover:bg-crm-muted")}
        >
          <ChevronRight />
        </button>
      </div>
    </nav>
  );
}
