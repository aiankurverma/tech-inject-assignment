import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { AlertTriangle, Check, ChevronDown, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CurrencyOption {
  /** ISO 4217 code, e.g. "EUR". */
  code: string;
  name: string;
  /** Units of this currency per 1 unit of the base currency. */
  rate: number;
  /** Optional flag emoji or node. */
  flag?: React.ReactNode;
}

export interface CurrencySwitcherProps {
  currencies: CurrencyOption[];
  /** Code the underlying amounts are stored in (rate 1). */
  baseCurrency: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (code: string) => void;
  /** Pinned at the top of the list. */
  favorites?: string[];
  /** Amount in the base currency, previewed per option. */
  previewAmount?: number;
  /** When rates were fetched; older than `staleAfterHours` shows a warning. */
  ratesAsOf?: Date;
  staleAfterHours?: number;
  /** Reference time for staleness (defaults to now). */
  now?: Date;
  locale?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Convert an amount stored in the base currency into `code`. */
export function convertAmount(amount: number, rate: number) {
  return Math.round(amount * rate * 100) / 100;
}

/** Locale-aware money formatting; falls back to "CODE 1,234.00" for unknown codes. */
export function formatMoney(amount: number, code: string, locale = "en-US") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

function hoursBetween(a: Date, b: Date) {
  return Math.abs(b.getTime() - a.getTime()) / 36e5;
}

/** Display-currency picker with search, favourites, live converted preview and stale-rate warning. */
export function CurrencySwitcher({
  currencies,
  baseCurrency,
  value,
  defaultValue,
  onValueChange,
  favorites = [],
  previewAmount,
  ratesAsOf,
  staleAfterHours = 24,
  now,
  locale = "en-US",
  loading,
  disabled,
  className,
}: CurrencySwitcherProps) {
  const [inner, setInner] = React.useState(defaultValue ?? baseCurrency);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);
  const listId = React.useId();
  const current = value ?? inner;
  const selected = currencies.find((c) => c.code === current);

  const list = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = currencies.filter(
      (c) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
    const fav = matches.filter((c) => favorites.includes(c.code));
    const rest = matches
      .filter((c) => !favorites.includes(c.code))
      .sort((a, b) => a.code.localeCompare(b.code));
    return [...fav, ...rest];
  }, [currencies, favorites, query]);

  React.useEffect(() => setCursor(0), [query]);

  const stale = ratesAsOf ? hoursBetween(ratesAsOf, now ?? new Date()) > staleAfterHours : false;

  const choose = (code: string) => {
    if (value === undefined) setInner(code);
    onValueChange?.(code);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && list[cursor]) {
      e.preventDefault();
      choose(list[cursor].code);
    }
  };

  React.useEffect(() => {
    document.getElementById(`${listId}-${cursor}`)?.scrollIntoView({ block: "nearest" });
  }, [cursor, listId]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        disabled={disabled || loading}
        aria-label={`Display currency: ${current}`}
        className={cn(
          "inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full bg-crm-raised px-2.5 font-crm text-xs font-medium text-crm-fg shadow-crm-raised outline-none",
          "transition-colors duration-150 ease-crm hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:opacity-50",
          className,
        )}
      >
        {loading ? (
          <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <span aria-hidden>{selected?.flag}</span>
        )}
        <span className="tabular-nums">{current}</span>
        {stale ? <AlertTriangle aria-hidden className="size-3 text-crm-warning" /> : null}
        <ChevronDown aria-hidden className="size-3 text-crm-subtle" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[300px] max-w-[calc(100vw-32px)] overflow-hidden rounded-crm border border-crm-border bg-crm-popover font-crm text-crm-fg shadow-crm-overlay data-[state=open]:animate-crm-in"
        >
          <div className="flex items-center gap-2 border-b border-crm-border px-3 py-2">
            <Search aria-hidden className="size-3.5 text-crm-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search currency or code"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={list[cursor] ? `${listId}-${cursor}` : undefined}
              className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-crm-subtle"
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-label="Currencies"
            className="max-h-72 overflow-y-auto p-1"
          >
            {list.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-crm-muted-fg">
                No currency matches “{query}”
              </li>
            ) : (
              list.map((c, i) => {
                const isSel = c.code === current;
                const fav = favorites.includes(c.code);
                const showDivider = i > 0 && favorites.includes(list[i - 1]?.code ?? "") && !fav;
                return (
                  <li
                    key={c.code}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => choose(c.code)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      i === cursor && "bg-crm-muted",
                      showDivider && "mt-1 border-t border-crm-border pt-2",
                    )}
                  >
                    <span aria-hidden className="w-5 text-center">
                      {c.flag}
                    </span>
                    <span className="w-10 font-medium tabular-nums">{c.code}</span>
                    <span className="flex-1 truncate text-xs text-crm-muted-fg">{c.name}</span>
                    {previewAmount !== undefined ? (
                      <span className="text-xs text-crm-soft tabular-nums">
                        {formatMoney(convertAmount(previewAmount, c.rate), c.code, locale)}
                      </span>
                    ) : null}
                    {fav ? (
                      <Star aria-label="Favourite" className="size-3 text-crm-warning" />
                    ) : null}
                    <Check
                      aria-hidden
                      className={cn("size-3.5 text-crm-fg", isSel ? "opacity-100" : "opacity-0")}
                    />
                  </li>
                );
              })
            )}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-crm-border px-3 py-2 text-[11px] text-crm-subtle">
            <span>Base {baseCurrency}</span>
            {ratesAsOf ? (
              <span className={cn(stale && "text-crm-warning")} role={stale ? "status" : undefined}>
                {stale ? "Rates may be stale · " : "Rates as of "}
                {ratesAsOf.toLocaleString(locale, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
