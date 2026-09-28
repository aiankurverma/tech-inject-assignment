import * as React from "react";
import { Check, Minus, Package, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/crm/search-input";

export interface CatalogProduct {
  id: string;
  name: string;
  sku: string;
  /** Unit price in major units. */
  price: number;
  /** Billing unit, e.g. "seat / mo", "one-time". */
  unit?: string;
  category?: string;
  /** Units in stock; undefined = not tracked (services, licences). */
  stock?: number;
  /** Archived products are visible but cannot be added. */
  archived?: boolean;
}

export interface ProductPickerProps {
  products: CatalogProduct[];
  /** Selected quantities keyed by product id. */
  value?: Record<string, number>;
  defaultValue?: Record<string, number>;
  onValueChange?: (value: Record<string, number>) => void;
  currency?: string;
  locale?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Called with the selection when the user confirms. */
  onConfirm?: (selection: { product: CatalogProduct; quantity: number }[]) => void;
  confirmLabel?: string;
  className?: string;
}

const matches = (p: CatalogProduct, q: string) => {
  if (!q) return true;
  const hay = `${p.name} ${p.sku} ${p.category ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
};

/** Catalog search + add: fuzzy word search over name/SKU/category, category filter, stock-aware quantity steppers, keyboard navigation and a running selection total. */
export function ProductPicker({
  products,
  value,
  defaultValue = {},
  onValueChange,
  currency = "USD",
  locale,
  loading,
  error,
  onRetry,
  onConfirm,
  confirmLabel = "Add to quote",
  className,
}: ProductPickerProps) {
  const [inner, setInner] = React.useState(defaultValue);
  const sel = value ?? inner;
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<string>("all");
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const money = new Intl.NumberFormat(locale, { style: "currency", currency });

  const categories = React.useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[],
    [products],
  );
  const visible = React.useMemo(
    () =>
      products
        .filter((p) => (cat === "all" || p.category === cat) && matches(p, q))
        .sort((a, b) => Number(!!a.archived) - Number(!!b.archived)),
    [products, cat, q],
  );
  const activeIdx = Math.min(active, Math.max(0, visible.length - 1));

  const setQty = (p: CatalogProduct, n: number) => {
    const max = p.stock ?? Infinity;
    const qty = Math.max(0, Math.min(max, n));
    const next = { ...sel };
    if (qty === 0) delete next[p.id];
    else next[p.id] = qty;
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };

  const chosen = products
    .filter((p) => (sel[p.id] ?? 0) > 0)
    .map((p) => ({ product: p, quantity: sel[p.id] ?? 0 }));
  const total = chosen.reduce((s, c) => s + c.product.price * c.quantity, 0);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const p = visible[activeIdx];
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(visible.length - 1, activeIdx + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(0, activeIdx - 1));
    } else if (e.key === "Enter" && p && !p.archived) {
      e.preventDefault();
      setQty(p, (sel[p.id] ?? 0) + 1);
    } else if (e.key === "Backspace" && e.altKey && p) {
      e.preventDefault();
      setQty(p, (sel[p.id] ?? 0) - 1);
    }
  };

  const stepBtn =
    "inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-crm-raised text-crm-fg shadow-crm-raised outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card font-crm text-xs text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-crm-border p-3">
        <SearchInput
          value={q}
          onValueChange={(v) => {
            setQ(v);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search name, SKU or category"
          aria-label="Search products"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={
            visible[activeIdx] ? `${listId}-${visible[activeIdx].id}` : undefined
          }
          loading={loading}
        />
        {categories.length > 1 ? (
          <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Filter by category">
            {["all", ...categories].map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cat === c}
                onClick={() => {
                  setCat(c);
                  setActive(0);
                }}
                className={cn(
                  "h-6 shrink-0 cursor-pointer rounded-full px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
                  cat === c
                    ? "bg-crm-muted text-crm-fg shadow-crm-raised"
                    : "text-crm-soft hover:text-crm-fg",
                )}
              >
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label="Products"
        aria-multiselectable
        className="max-h-72 overflow-y-auto p-1"
      >
        {error ? (
          <li className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <span className="text-crm-danger">{error}</span>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="cursor-pointer rounded text-crm-soft underline outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
              >
                Retry
              </button>
            ) : null}
          </li>
        ) : loading && products.length === 0 ? (
          Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 px-2 py-2.5" aria-hidden>
              <span className="size-7 animate-pulse rounded-md bg-crm-muted" />
              <span className="h-3 flex-1 animate-pulse rounded bg-crm-muted" />
            </li>
          ))
        ) : visible.length === 0 ? (
          <li className="px-3 py-8 text-center text-crm-soft">
            {q ? `No products match "${q}".` : "The catalog is empty."}
          </li>
        ) : (
          visible.map((p, i) => {
            const qty = sel[p.id] ?? 0;
            const out = p.stock !== undefined && p.stock <= 0;
            const blocked = p.archived || out;
            return (
              <li
                key={p.id}
                id={`${listId}-${p.id}`}
                role="option"
                aria-selected={qty > 0}
                aria-disabled={blocked || undefined}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-2",
                  i === activeIdx && "bg-crm-raised",
                  blocked && "opacity-50",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-crm-muted text-crm-icon">
                  {qty > 0 ? (
                    <Check className="size-3.5 text-crm-success" aria-hidden />
                  ) : (
                    <Package className="size-3.5" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-[11px] text-crm-soft">
                    {p.sku}
                    {p.archived
                      ? " · Archived"
                      : out
                        ? " · Out of stock"
                        : p.stock !== undefined && p.stock < 10
                          ? ` · ${p.stock} left`
                          : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  {money.format(p.price)}
                  {p.unit ? (
                    <span className="block text-[11px] text-crm-soft">{p.unit}</span>
                  ) : null}
                </span>
                <span className="flex w-[76px] shrink-0 items-center justify-end gap-1">
                  {qty > 0 ? (
                    <>
                      <button
                        type="button"
                        tabIndex={-1}
                        className={stepBtn}
                        onClick={() => setQty(p, qty - 1)}
                        aria-label={`Decrease ${p.name}`}
                      >
                        <Minus aria-hidden />
                      </button>
                      <span className="w-5 text-center tabular-nums" aria-label={`${qty} selected`}>
                        {qty}
                      </span>
                      <button
                        type="button"
                        tabIndex={-1}
                        className={stepBtn}
                        disabled={p.stock !== undefined && qty >= p.stock}
                        onClick={() => setQty(p, qty + 1)}
                        aria-label={`Increase ${p.name}`}
                      >
                        <Plus aria-hidden />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      tabIndex={-1}
                      className={stepBtn}
                      disabled={blocked}
                      onClick={() => setQty(p, 1)}
                      aria-label={`Add ${p.name}`}
                    >
                      <Plus aria-hidden />
                    </button>
                  )}
                </span>
              </li>
            );
          })
        )}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-crm-border px-3 py-2.5">
        <span className="text-crm-soft" aria-live="polite">
          {chosen.length ? (
            <>
              {chosen.length} product{chosen.length === 1 ? "" : "s"} ·{" "}
              <span className="text-crm-fg tabular-nums">{money.format(total)}</span>
            </>
          ) : (
            "Enter adds the highlighted product"
          )}
        </span>
        {onConfirm ? (
          <button
            type="button"
            disabled={!chosen.length}
            onClick={() => onConfirm(chosen)}
            className="inline-flex h-[30px] cursor-pointer items-center rounded-full bg-crm-primary px-3 text-xs font-medium text-crm-primary-fg shadow-crm-primary outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:pointer-events-none disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
