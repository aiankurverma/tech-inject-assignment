import * as React from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountBadge } from "@/components/crm/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/crm/dropdown-menu";

export interface TopNavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Unread / pending count shown as a pill. 0 hides it. */
  count?: number;
  disabled?: boolean;
  href?: string;
}

export interface TopNavProps {
  items: TopNavItem[];
  /** Controlled active item id. */
  value?: string;
  /** Uncontrolled initial active item id. */
  defaultValue?: string;
  onValueChange?: (id: string, item: TopNavItem) => void;
  /** Left-most brand block (logo + product name). */
  brand?: React.ReactNode;
  /** Centre/right slot, typically a SearchInput or ⌘K trigger. */
  search?: React.ReactNode;
  /** Right-most actions: notifications, user menu. */
  actions?: React.ReactNode;
  /** Label announced for the navigation landmark. */
  label?: string;
  sticky?: boolean;
  className?: string;
}

const MORE_WIDTH = 84;
const GAP = 4;

/**
 * Horizontal app bar. Items that do not fit collapse into a "More" menu (measured with
 * ResizeObserver, the active item is always kept visible). Arrow keys move between items,
 * Home/End jump. Below `md` the items move into a disclosure panel behind a menu button.
 */
export function TopNav({
  items,
  value,
  defaultValue,
  onValueChange,
  brand,
  search,
  actions,
  label = "Primary",
  sticky = true,
  className,
}: TopNavProps) {
  const [inner, setInner] = React.useState(defaultValue ?? items[0]?.id);
  const active = value ?? inner;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [visibleCount, setVisibleCount] = React.useState(items.length);
  const listRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();

  const select = (item: TopNavItem) => {
    if (item.disabled) return;
    if (value === undefined) setInner(item.id);
    onValueChange?.(item.id, item);
    setMobileOpen(false);
  };

  // Measure hidden clones of every item and fit as many as possible into the list width.
  React.useLayoutEffect(() => {
    const list = listRef.current;
    const measure = measureRef.current;
    if (!list || !measure) return;
    const compute = () => {
      const widths = Array.from(measure.children).map(
        (c) => (c as HTMLElement).getBoundingClientRect().width,
      );
      const available = list.getBoundingClientRect().width;
      const total = widths.reduce((s, w) => s + w + GAP, 0);
      if (total <= available) {
        setVisibleCount(items.length);
        return;
      }
      let used = MORE_WIDTH;
      let n = 0;
      for (const w of widths) {
        if (used + w + GAP > available) break;
        used += w + GAP;
        n++;
      }
      setVisibleCount(Math.max(0, n));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(list);
    return () => ro.disconnect();
  }, [items]);

  // Keep the active item visible by swapping it into the last visible slot.
  const ordered = React.useMemo(() => {
    const idx = items.findIndex((i) => i.id === active);
    if (idx < visibleCount || visibleCount === 0 || idx === -1) return items;
    const copy = items.slice();
    const [act] = copy.splice(idx, 1);
    if (act) copy.splice(visibleCount - 1, 0, act);
    return copy;
  }, [items, active, visibleCount]);
  const visible = ordered.slice(0, visibleCount);
  const overflow = ordered.slice(visibleCount);
  const overflowActive = overflow.some((i) => i.id === active);
  const overflowCount = overflow.reduce((s, i) => s + (i.count ?? 0), 0);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>("[data-topnav-item]:not([disabled])"),
    );
    const i = buttons.indexOf(document.activeElement as HTMLElement);
    if (i === -1) return;
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % buttons.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + buttons.length) % buttons.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = buttons.length - 1;
    if (next >= 0) {
      e.preventDefault();
      buttons[next]?.focus();
    }
  };

  const itemCls = (on: boolean) =>
    cn(
      "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-crm px-2.5 text-sm font-medium whitespace-nowrap outline-none",
      "transition-[background-color,color,box-shadow] duration-150 ease-crm focus-visible:ring-2 focus-visible:ring-crm-ring/60",
      "disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-3.5",
      on
        ? "bg-crm-muted text-crm-fg shadow-crm-raised"
        : "text-crm-muted-fg hover:bg-crm-raised hover:text-crm-fg",
    );

  const renderContent = (item: TopNavItem) => (
    <>
      {item.icon ? <span className="text-crm-soft">{item.icon}</span> : null}
      {item.label}
      {item.count ? (
        <CountBadge aria-label={`${item.count} pending`}>
          {item.count > 99 ? "99+" : item.count}
        </CountBadge>
      ) : null}
    </>
  );

  return (
    <header
      className={cn(
        "z-40 w-full border-b border-crm-border bg-crm-bg/95 font-crm text-crm-fg backdrop-blur",
        sticky && "sticky top-0",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-3 px-4">
        <button
          type="button"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          aria-controls={panelId}
          onClick={() => setMobileOpen((o) => !o)}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-crm-soft outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 md:hidden [&_svg]:size-4"
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
        {brand ? <div className="flex shrink-0 items-center gap-2">{brand}</div> : null}

        <nav aria-label={label} className="relative hidden min-w-0 flex-1 md:block">
          {/* Off-screen measuring row */}
          <div
            ref={measureRef}
            aria-hidden
            className="pointer-events-none invisible absolute top-0 left-0 flex gap-1"
          >
            {items.map((item) => (
              <span key={item.id} className={itemCls(false)}>
                {renderContent(item)}
              </span>
            ))}
          </div>
          <div
            ref={listRef}
            className="flex items-center gap-1 overflow-hidden"
            onKeyDown={onKeyDown}
          >
            {visible.map((item) =>
              item.href ? (
                <a
                  key={item.id}
                  href={item.href}
                  data-topnav-item=""
                  aria-current={item.id === active ? "page" : undefined}
                  aria-disabled={item.disabled || undefined}
                  onClick={(e) => {
                    if (item.disabled) e.preventDefault();
                    select(item);
                  }}
                  className={itemCls(item.id === active)}
                >
                  {renderContent(item)}
                </a>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  data-topnav-item=""
                  disabled={item.disabled}
                  aria-current={item.id === active ? "page" : undefined}
                  onClick={() => select(item)}
                  className={itemCls(item.id === active)}
                >
                  {renderContent(item)}
                </button>
              ),
            )}
            {overflow.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-topnav-item=""
                    aria-label={`More navigation, ${overflow.length} items`}
                    className={itemCls(overflowActive)}
                  >
                    More
                    {overflowCount ? <CountBadge>{overflowCount}</CountBadge> : null}
                    <ChevronDown />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {overflow.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      icon={item.icon}
                      disabled={item.disabled}
                      shortcut={item.count ? String(item.count) : undefined}
                      onSelect={() => select(item)}
                      className={item.id === active ? "bg-crm-muted" : undefined}
                    >
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2 md:ml-0">
          {search ? <div className="hidden w-64 lg:block">{search}</div> : null}
          {actions}
        </div>
      </div>

      {mobileOpen ? (
        <nav
          id={panelId}
          aria-label={label}
          className="flex flex-col gap-0.5 border-t border-crm-border p-3 md:hidden"
        >
          {search ? <div className="mb-2">{search}</div> : null}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              aria-current={item.id === active ? "page" : undefined}
              onClick={() => select(item)}
              className={cn(itemCls(item.id === active), "w-full justify-start")}
            >
              {renderContent(item)}
            </button>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
