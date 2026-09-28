import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { MoreHorizontal, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** Badge count; values over 99 show "99+". */
  badge?: number;
  /** Show a dot instead of a number (e.g. "something changed"). */
  dot?: boolean;
  disabled?: boolean;
}

export interface MobileNavProps {
  items: MobileNavItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /**
   * Max tabs in the bar (including "More"). Extra items go into the More drawer.
   * Defaults to 5 which is the platform guideline.
   */
  maxTabs?: number;
  /** Optional centre floating action, e.g. "New deal". */
  primaryAction?: { label: string; icon?: React.ReactNode; onClick: () => void };
  /** Extra content at the bottom of the More drawer (account, sign out). */
  drawerFooter?: React.ReactNode;
  /** Pin to viewport bottom. Turn off for previews inside a frame. */
  fixed?: boolean;
  className?: string;
}

function badgeText(n: number) {
  return n > 99 ? "99+" : String(n);
}

/**
 * Bottom tab bar for phones with an overflow "More" drawer, optional centre action,
 * badges, safe-area padding and arrow-key navigation. Hidden from md up by default
 * (override with className).
 */
export function MobileNav({
  items,
  value,
  defaultValue,
  onValueChange,
  maxTabs = 5,
  primaryAction,
  drawerFooter,
  fixed = true,
  className,
}: MobileNavProps) {
  const [inner, setInner] = React.useState(defaultValue ?? items[0]?.id);
  const active = value ?? inner;
  const [drawer, setDrawer] = React.useState(false);

  const slots = Math.max(2, maxTabs - (primaryAction ? 1 : 0));
  const needsMore = items.length > slots;
  const barItems = needsMore ? items.slice(0, slots - 1) : items;
  const moreItems = needsMore ? items.slice(slots - 1) : [];
  const moreActive = moreItems.some((i) => i.id === active);
  const moreBadge = moreItems.reduce((s, i) => s + (i.badge ?? 0), 0);
  const moreDot = moreItems.some((i) => i.dot);

  const select = (item: MobileNavItem) => {
    if (item.disabled) return;
    if (value === undefined) setInner(item.id);
    onValueChange?.(item.id);
    setDrawer(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const btns = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>("[data-mnav]:not([disabled])"),
    );
    const i = btns.indexOf(document.activeElement as HTMLElement);
    if (i === -1) return;
    e.preventDefault();
    btns[(i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length]?.focus();
  };

  const indicator = (badge?: number, dot?: boolean) =>
    badge ? (
      <span className="absolute -top-1 left-[calc(50%+4px)] inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-crm-danger px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-crm-sidebar">
        {badgeText(badge)}
      </span>
    ) : dot ? (
      <span className="absolute -top-0.5 left-[calc(50%+6px)] size-2 rounded-full bg-crm-danger ring-2 ring-crm-sidebar" />
    ) : null;

  const tab = (item: MobileNavItem) => {
    const on = item.id === active;
    return (
      <button
        key={item.id}
        type="button"
        data-mnav=""
        disabled={item.disabled}
        aria-current={on ? "page" : undefined}
        aria-label={item.badge ? `${item.label}, ${item.badge} new` : item.label}
        onClick={() => select(item)}
        className={cn(
          "relative flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-crm py-1.5 outline-none",
          "focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-40",
          on ? "text-crm-fg" : "text-crm-muted-fg",
        )}
      >
        <span className="relative [&_svg]:size-5">
          {item.icon}
          {indicator(item.badge, item.dot)}
        </span>
        <span className="max-w-full truncate text-[11px] font-medium">{item.label}</span>
        {on ? (
          <span className="absolute top-0 h-0.5 w-6 rounded-full bg-crm-primary" aria-hidden />
        ) : null}
      </button>
    );
  };

  const half = Math.ceil(barItems.length / 2);

  return (
    <DialogPrimitive.Root open={drawer} onOpenChange={setDrawer}>
      <nav
        aria-label="Primary"
        onKeyDown={onKeyDown}
        className={cn(
          "z-40 flex w-full items-stretch gap-1 border-t border-crm-border bg-crm-sidebar/95 px-2 pt-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] font-crm backdrop-blur md:hidden",
          fixed && "fixed inset-x-0 bottom-0",
          className,
        )}
      >
        {primaryAction ? barItems.slice(0, half).map(tab) : barItems.map(tab)}
        {primaryAction ? (
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              data-mnav=""
              aria-label={primaryAction.label}
              onClick={primaryAction.onClick}
              className="-mt-5 inline-flex size-12 cursor-pointer items-center justify-center rounded-full bg-crm-primary text-crm-primary-fg shadow-crm-primary outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-5"
            >
              {primaryAction.icon ?? <Plus />}
            </button>
          </div>
        ) : null}
        {primaryAction ? barItems.slice(half).map(tab) : null}
        {needsMore ? (
          <DialogPrimitive.Trigger asChild>
            <button
              type="button"
              data-mnav=""
              aria-current={moreActive ? "page" : undefined}
              className={cn(
                "relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-crm py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                moreActive ? "text-crm-fg" : "text-crm-muted-fg",
              )}
            >
              <span className="relative [&_svg]:size-5">
                <MoreHorizontal />
                {indicator(moreBadge, moreDot)}
              </span>
              <span className="text-[11px] font-medium">More</span>
              {moreActive ? (
                <span
                  className="absolute top-0 h-0.5 w-6 rounded-full bg-crm-primary"
                  aria-hidden
                />
              ) : null}
            </button>
          </DialogPrimitive.Trigger>
        ) : null}
      </nav>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-crm-in" />
        <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-crm-border bg-crm-sidebar px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] font-crm text-crm-fg shadow-crm-overlay outline-none data-[state=open]:animate-crm-in">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-crm-track" aria-hidden />
          <div className="mb-2 flex items-center justify-between px-1">
            <DialogPrimitive.Title className="text-sm font-semibold">More</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close"
              className="rounded-full p-1.5 text-crm-soft outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">
            Additional destinations
          </DialogPrimitive.Description>
          <ul className="grid grid-cols-3 gap-2">
            {moreItems.map((item) => {
              const on = item.id === active;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={item.disabled}
                    aria-current={on ? "page" : undefined}
                    onClick={() => select(item)}
                    className={cn(
                      "relative flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-40 [&_svg]:size-5",
                      on
                        ? "border-crm-primary/60 bg-crm-muted text-crm-fg"
                        : "border-crm-border bg-crm-raised text-crm-soft",
                    )}
                  >
                    <span className="relative">
                      {item.icon}
                      {indicator(item.badge, item.dot)}
                    </span>
                    <span className="max-w-full truncate">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {drawerFooter ? (
            <div className="mt-3 border-t border-crm-border pt-3">{drawerFooter}</div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
