import * as React from "react";
import { ChevronLeft, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/crm/button";

export interface MobileTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** Unread count; 100+ shows "99+". */
  badge?: number;
}

export interface ShellMobileProps {
  tabs: MobileTab[];
  activeTab?: string;
  defaultActiveTab?: string;
  onTabChange?: (id: string) => void;
  title: React.ReactNode;
  /** Shows a back button in the app bar. */
  onBack?: () => void;
  /** Right side of the app bar. */
  actions?: React.ReactNode;
  /** Content under the title (search, segmented control). Collapses with the bars on scroll. */
  toolbar?: React.ReactNode;
  /** Floating action button, e.g. "Log call". */
  fab?: { label: string; icon: React.ReactNode; onClick: () => void };
  /** Shows an offline strip. */
  offline?: boolean;
  /** Hide the bottom bar while scrolling down, reveal on scroll up. */
  hideOnScroll?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Phone-first app shell: sticky app bar with large-title collapse, bottom tab bar with badges
 * and arrow-key navigation, auto-hiding bars on scroll, floating action button, offline strip
 * and safe-area padding.
 */
export function ShellMobile({
  tabs,
  activeTab,
  defaultActiveTab,
  onTabChange,
  title,
  onBack,
  actions,
  toolbar,
  fab,
  offline,
  hideOnScroll = true,
  children,
  className,
}: ShellMobileProps) {
  const [inner, setInner] = React.useState(defaultActiveTab ?? tabs[0]?.id);
  const [hidden, setHidden] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const last = React.useRef(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const active = activeTab ?? inner;

  const select = (id: string) => {
    if (activeTab === undefined) setInner(id);
    onTabChange?.(id);
    setHidden(false);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop;
    setScrolled(y > 8);
    if (hideOnScroll) {
      if (y > last.current + 6 && y > 56) setHidden(true);
      else if (y < last.current - 6) setHidden(false);
    }
    last.current = y;
  };

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const n = tabs.length;
    const next =
      e.key === "ArrowRight"
        ? (i + 1) % n
        : e.key === "ArrowLeft"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    tabRefs.current[next]?.focus();
    const t = tabs[next];
    if (t) select(t.id);
  };

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-crm-bg font-crm text-crm-fg",
        className,
      )}
    >
      <header
        className={cn(
          "z-10 shrink-0 border-b bg-crm-sidebar/95 pt-[env(safe-area-inset-top)] backdrop-blur transition-colors",
          scrolled ? "border-crm-border" : "border-transparent",
        )}
      >
        <div className="flex h-12 items-center gap-1 px-2">
          {onBack ? (
            <IconButton label="Back" onClick={onBack} className="bg-transparent shadow-none">
              <ChevronLeft />
            </IconButton>
          ) : (
            <span className="w-2" />
          )}
          <h1
            className={cn(
              "min-w-0 flex-1 truncate text-center text-sm font-medium transition-opacity",
              scrolled || onBack ? "opacity-100" : "opacity-0",
            )}
            aria-hidden={!(scrolled || onBack) || undefined}
          >
            {title}
          </h1>
          <div className="flex min-w-[30px] items-center justify-end gap-1">{actions}</div>
        </div>
        {offline ? (
          <p
            role="status"
            className="flex items-center justify-center gap-1.5 bg-tag-amber-bg py-1 text-[11px] text-tag-amber-text"
          >
            <WifiOff className="size-3" aria-hidden /> Offline — changes will sync when you
            reconnect
          </p>
        ) : null}
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {!onBack ? (
          <p className="px-4 pt-2 pb-1 text-2xl font-semibold tracking-[-0.02em]">{title}</p>
        ) : null}
        {toolbar ? <div className="sticky top-0 z-[1] bg-crm-bg px-4 py-2">{toolbar}</div> : null}
        <div className="pb-24">{children}</div>
      </div>

      {fab ? (
        <button
          type="button"
          onClick={fab.onClick}
          aria-label={fab.label}
          className={cn(
            "absolute right-4 z-20 grid size-12 place-items-center rounded-full bg-crm-primary text-crm-primary-fg shadow-crm-primary outline-none",
            "transition-[bottom,transform] duration-200 ease-crm focus-visible:ring-2 focus-visible:ring-crm-ring/60 active:scale-95 [&_svg]:size-5",
            hidden
              ? "bottom-[calc(16px+env(safe-area-inset-bottom))]"
              : "bottom-[calc(76px+env(safe-area-inset-bottom))]",
          )}
        >
          {fab.icon}
        </button>
      ) : null}

      <nav
        aria-label="Primary"
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 border-t border-crm-border bg-crm-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-200 ease-crm",
          hidden && "translate-y-full",
        )}
      >
        <div role="tablist" aria-label="Sections" className="flex h-[60px]">
          {tabs.map((t, i) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                onClick={() => select(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium outline-none",
                  "focus-visible:bg-crm-muted [&_svg]:size-5",
                  on ? "text-crm-fg" : "text-crm-subtle",
                )}
              >
                <span className="relative">
                  {t.icon}
                  {t.badge ? (
                    <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-crm-danger px-1 text-center text-[9px] leading-4 text-white tabular-nums">
                      {t.badge > 99 ? "99+" : t.badge}
                      <span className="sr-only"> unread</span>
                    </span>
                  ) : null}
                </span>
                {t.label}
                {on ? (
                  <span
                    aria-hidden
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-crm-primary"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
