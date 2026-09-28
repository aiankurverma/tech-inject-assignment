import * as React from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: React.ReactNode;
  href?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /** Collapse the middle into "…" when there are more items than this (min 3). */
  maxItems?: number;
  separator?: React.ReactNode;
  className?: string;
}

/** Location trail. Last item is the current page (aria-current="page"); middle items collapse behind an expandable "…". */
export function Breadcrumbs({ items, maxItems = 4, separator, className }: BreadcrumbsProps) {
  const [expanded, setExpanded] = React.useState(false);
  const limit = Math.max(3, maxItems);
  const collapse = !expanded && items.length > limit;
  const shown: (BreadcrumbItem | "ellipsis")[] = collapse
    ? [items[0]!, "ellipsis", ...items.slice(items.length - (limit - 2))]
    : items;
  const sep = separator ?? <ChevronRight className="size-3 text-crm-faint" />;
  return (
    <nav aria-label="Breadcrumb" className={cn("font-crm", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        {shown.map((item, i) => {
          const last = i === shown.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {item === "ellipsis" ? (
                <button
                  type="button"
                  aria-label="Show all breadcrumbs"
                  onClick={() => setExpanded(true)}
                  className="grid size-5 cursor-pointer place-items-center rounded text-crm-subtle outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              ) : last ? (
                <span
                  aria-current="page"
                  className="flex items-center gap-1 font-medium text-crm-fg [&_svg]:size-3.5"
                >
                  {item.icon}
                  {item.label}
                </span>
              ) : (
                <Crumb item={item} />
              )}
              {!last ? (
                <span aria-hidden className="flex">
                  {sep}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Crumb({ item }: { item: BreadcrumbItem }) {
  const cls =
    "flex items-center gap-1 rounded text-crm-soft outline-none transition-colors hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3.5";
  if (item.href)
    return (
      <a href={item.href} onClick={item.onClick} className={cls}>
        {item.icon}
        {item.label}
      </a>
    );
  return (
    <button type="button" onClick={item.onClick} className={cn(cls, "cursor-pointer")}>
      {item.icon}
      {item.label}
    </button>
  );
}
