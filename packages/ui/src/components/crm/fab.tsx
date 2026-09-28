import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const positions = {
  "bottom-right": "right-4 bottom-4 items-end sm:right-6 sm:bottom-6",
  "bottom-left": "left-4 bottom-4 items-start sm:left-6 sm:bottom-6",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center sm:bottom-6",
} as const;

export interface FabAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** Optional keyboard hint shown next to the label, e.g. "N". */
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export interface FabProps {
  /** Accessible name and extended label (e.g. "New deal"). */
  label: string;
  icon?: React.ReactNode;
  /** Primary click handler. Ignored when `actions` are given (the FAB opens a speed dial). */
  onClick?: () => void;
  /** Speed-dial actions revealed above the button. */
  actions?: FabAction[];
  position?: keyof typeof positions;
  /**
   * "fixed" pins to the viewport; "absolute" pins inside the nearest positioned parent
   * (useful for a panel or a device frame).
   */
  strategy?: "fixed" | "absolute";
  /** Show the text label next to the icon. "auto" collapses it while the user scrolls down. */
  extended?: boolean | "auto";
  /** Element whose scroll drives "auto" collapse; defaults to window. */
  scrollContainer?: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
  className?: string;
}

/**
 * Floating action button. Can be extended (icon + label), auto-collapse on scroll down, or open
 * a speed dial of actions: menu semantics, arrow-key navigation, Escape/outside click to close and
 * focus return to the trigger.
 */
export function Fab({
  label,
  icon = <Plus />,
  onClick,
  actions,
  position = "bottom-right",
  strategy = "fixed",
  extended = false,
  scrollContainer,
  disabled,
  className,
}: FabProps) {
  const [open, setOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = React.useId();
  const hasMenu = !!actions?.length;

  React.useEffect(() => {
    if (extended !== "auto") return;
    const el: HTMLElement | Window = scrollContainer?.current ?? window;
    const read = () => (el instanceof Window ? el.scrollY : el.scrollTop);
    let last = read();
    const onScroll = () => {
      const y = read();
      if (Math.abs(y - last) < 6) return;
      setCollapsed(y > last && y > 24);
      last = y;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [extended, scrollContainer]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    const first = itemRefs.current.find((b) => b && !b.disabled);
    first?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = itemRefs.current.filter((b): b is HTMLButtonElement => !!b && !b.disabled);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const go = (n: number) => {
      e.preventDefault();
      items[(n + items.length) % items.length]?.focus();
    };
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Tab") setOpen(false);
  };

  const showLabel = extended === true || (extended === "auto" && !collapsed);

  return (
    <div
      ref={rootRef}
      className={cn(
        "z-40 flex flex-col gap-3 font-crm",
        strategy === "fixed" ? "fixed" : "absolute",
        positions[position],
        className,
      )}
    >
      {hasMenu && open ? (
        <ul
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="flex flex-col gap-2 data-[state=open]:animate-crm-in"
          data-state="open"
        >
          {actions!.map((a, i) => (
            <li key={a.id} role="none" className="flex justify-end">
              <button
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitem"
                disabled={a.disabled}
                onClick={() => {
                  a.onSelect();
                  close();
                }}
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-2 rounded-full border border-crm-border bg-crm-popover pr-1.5 pl-3 text-xs text-crm-fg shadow-crm-overlay outline-none",
                  "hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <span>{a.label}</span>
                {a.shortcut ? (
                  <kbd className="rounded bg-crm-muted px-1 font-sans text-[10px] text-crm-soft">
                    {a.shortcut}
                  </kbd>
                ) : null}
                <span
                  aria-hidden
                  className="grid size-6 place-items-center rounded-full bg-crm-muted text-crm-fg [&_svg]:size-3.5"
                >
                  {a.icon}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={showLabel ? undefined : label}
        aria-haspopup={hasMenu ? "menu" : undefined}
        aria-expanded={hasMenu ? open : undefined}
        aria-controls={hasMenu && open ? menuId : undefined}
        onClick={() => (hasMenu ? setOpen((o) => !o) : onClick?.())}
        onKeyDown={(e) => {
          if (hasMenu && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-crm-primary text-sm font-medium text-crm-primary-fg shadow-crm-primary outline-none",
          "transition-[width,padding,background-color] duration-200 ease-crm hover:bg-[#5237ff]",
          "focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-crm-bg",
          "disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-5",
          showLabel ? "px-5" : "w-12",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "inline-flex transition-transform duration-200 ease-crm",
            hasMenu && open && "rotate-45",
          )}
        >
          {icon}
        </span>
        {showLabel ? <span>{label}</span> : null}
      </button>
    </div>
  );
}
