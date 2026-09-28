import * as React from "react";
import { AlertTriangle, CreditCard, Landmark, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "rupay" | "unknown";

export interface PaymentMethodData {
  id: string;
  type: "card" | "bank";
  brand?: CardBrand;
  /** Last four digits only; never pass a full number. */
  last4: string;
  /** Card expiry month 1-12. */
  expMonth?: number;
  /** Card expiry 4-digit year. */
  expYear?: number;
  holder?: string;
  /** Bank name for bank accounts. */
  bankName?: string;
  isDefault?: boolean;
}

export interface PaymentMethodProps {
  method: PaymentMethodData;
  now?: Date;
  /** Days before expiry that trigger the "expires soon" warning. */
  expiringWithinDays?: number;
  /** Radio-selectable, e.g. inside checkout. */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onSetDefault?: (id: string) => void;
  onRemove?: (id: string) => void;
  onUpdate?: (id: string) => void;
  /** Disable removing the default method (common billing rule). */
  protectDefault?: boolean;
  disabled?: boolean;
  className?: string;
}

const brandLabel: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  rupay: "RuPay",
  unknown: "Card",
};

const brandMark: Record<CardBrand, string> = {
  visa: "bg-[#1a1f71] text-white",
  mastercard: "bg-[#2b2b2b] text-[#f79e1b]",
  amex: "bg-[#2e77bc] text-white",
  discover: "bg-[#ff6000] text-white",
  rupay: "bg-[#097a44] text-white",
  unknown: "bg-crm-muted text-crm-fg",
};

/** Months until card expiry (end of expiry month). Negative when expired. */
export function cardExpiryState(
  expMonth: number,
  expYear: number,
  now = new Date(),
  soonDays = 45,
) {
  const endOfMonth = new Date(expYear, expMonth, 0, 23, 59, 59);
  const ms = endOfMonth.getTime() - now.getTime();
  const days = Math.floor(ms / 86_400_000);
  return { expired: ms < 0, soon: ms >= 0 && days <= soonDays, days };
}

/** Card or bank account on file: brand mark, masked number, expiry with expired/expiring warnings, default flag and management actions. */
export function PaymentMethod({
  method,
  now,
  expiringWithinDays = 45,
  selectable,
  selected,
  onSelect,
  onSetDefault,
  onRemove,
  onUpdate,
  protectDefault = true,
  disabled,
  className,
}: PaymentMethodProps) {
  const [menu, setMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const brand = method.brand ?? "unknown";
  const exp =
    method.type === "card" && method.expMonth && method.expYear
      ? cardExpiryState(method.expMonth, method.expYear, now, expiringWithinDays)
      : null;
  const name =
    method.type === "bank"
      ? `${method.bankName ?? "Bank account"} ending ${method.last4}`
      : `${brandLabel[brand]} ending ${method.last4}`;

  React.useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    listRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus();
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const actions = [
    onUpdate && { key: "update", label: exp?.expired ? "Update card" : "Edit", run: onUpdate },
    onSetDefault && !method.isDefault && !exp?.expired
      ? { key: "default", label: "Make default", run: onSetDefault }
      : null,
    onRemove && { key: "remove", label: "Remove", run: onRemove, danger: true },
  ].filter(Boolean) as {
    key: string;
    label: string;
    run: (id: string) => void;
    danger?: boolean;
  }[];

  const removeBlocked = protectDefault && method.isDefault;

  return (
    <div
      role={selectable ? "radio" : undefined}
      aria-checked={selectable ? !!selected : undefined}
      aria-disabled={disabled || exp?.expired || undefined}
      tabIndex={selectable ? (disabled ? -1 : 0) : undefined}
      onClick={() => selectable && !disabled && !exp?.expired && onSelect?.(method.id)}
      onKeyDown={(e) => {
        if (selectable && (e.key === " " || e.key === "Enter") && e.target === e.currentTarget) {
          e.preventDefault();
          if (!disabled && !exp?.expired) onSelect?.(method.id);
        }
      }}
      className={cn(
        "relative flex min-w-0 items-center gap-3 rounded-crm border bg-crm-card px-3 py-2.5 font-crm text-crm-fg shadow-crm-raised outline-none",
        selected ? "border-crm-primary ring-1 ring-crm-primary/40" : "border-crm-border",
        selectable &&
          !disabled &&
          "cursor-pointer hover:bg-crm-raised focus-visible:ring-2 focus-visible:ring-crm-ring/60",
        (disabled || (selectable && exp?.expired)) && "opacity-60",
        className,
      )}
    >
      {selectable ? (
        <span
          aria-hidden
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-crm-primary" : "border-crm-subtle",
          )}
        >
          {selected ? <span className="size-2 rounded-full bg-crm-primary" /> : null}
        </span>
      ) : null}
      <span
        aria-hidden
        className={cn(
          "flex h-7 w-10 shrink-0 items-center justify-center rounded-md text-[9px] font-bold tracking-wide uppercase",
          method.type === "bank" ? "bg-crm-muted text-crm-fg" : brandMark[brand],
        )}
      >
        {method.type === "bank" ? (
          <Landmark className="size-3.5" />
        ) : brand === "unknown" ? (
          <CreditCard className="size-3.5" />
        ) : (
          brand.slice(0, 4)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span className="sr-only">{name}</span>
          <span aria-hidden className="truncate">
            {method.type === "bank" ? (method.bankName ?? "Bank account") : brandLabel[brand]}{" "}
            <span className="tracking-widest text-crm-soft">••••</span> {method.last4}
          </span>
          {method.isDefault ? (
            <span className="shrink-0 rounded-full bg-crm-muted px-1.5 text-[10px] leading-4 text-crm-chip">
              Default
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-crm-soft">
          {exp?.expired ? (
            <span className="flex items-center gap-1 text-crm-danger">
              <AlertTriangle className="size-3" aria-hidden />
              Expired {String(method.expMonth).padStart(2, "0")}/{method.expYear}
            </span>
          ) : exp?.soon ? (
            <span className="flex items-center gap-1 text-crm-warning">
              <AlertTriangle className="size-3" aria-hidden />
              Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear} (in {exp.days}d)
            </span>
          ) : method.type === "card" && method.expMonth ? (
            `Expires ${String(method.expMonth).padStart(2, "0")}/${method.expYear}`
          ) : (
            "ACH debit"
          )}
          {method.holder ? <span className="truncate">· {method.holder}</span> : null}
        </span>
      </span>
      {actions.length ? (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            ref={triggerRef}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={`Actions for ${name}`}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              setMenu((v) => !v);
            }}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-crm-muted-fg outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-50"
          >
            <MoreHorizontal className="size-3.5" aria-hidden />
          </button>
          {menu ? (
            <div
              ref={listRef}
              role="menu"
              aria-label={`Actions for ${name}`}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape" || e.key === "Tab") {
                  if (e.key === "Escape") e.preventDefault();
                  setMenu(false);
                  triggerRef.current?.focus();
                  return;
                }
                if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
                e.preventDefault();
                const items = Array.from(
                  listRef.current?.querySelectorAll<HTMLButtonElement>(
                    "[role=menuitem]:not(:disabled)",
                  ) ?? [],
                );
                if (!items.length) return;
                const at = items.indexOf(document.activeElement as HTMLButtonElement);
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? items.length - 1
                      : (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
                items[next]?.focus();
              }}
              className="absolute top-8 right-0 z-20 min-w-36 rounded-crm border border-crm-border bg-crm-popover p-1 shadow-crm-raised"
            >
              {actions.map((a) => {
                const blocked = a.key === "remove" && removeBlocked;
                return (
                  <button
                    key={a.key}
                    type="button"
                    role="menuitem"
                    disabled={blocked}
                    title={blocked ? "Set another default before removing" : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenu(false);
                      triggerRef.current?.focus();
                      a.run(method.id);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-xs outline-none hover:bg-crm-muted focus-visible:bg-crm-muted disabled:cursor-not-allowed disabled:opacity-40",
                      a.danger ? "text-crm-danger" : "text-crm-fg",
                    )}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
