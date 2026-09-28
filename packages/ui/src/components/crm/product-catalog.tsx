import * as React from "react";
import { LayoutGrid, List, Minus, PackageSearch, Plus, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { SearchInput } from "@/components/crm/search-input";
import { Tag } from "@/components/crm/tag";

export type BillingInterval = "one_time" | "month" | "year";

export interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  /** Unit price in major units (e.g. 49.5). */
  price: number;
  interval?: BillingInterval;
  /** Units in stock; undefined means not stock-tracked (services, licenses). */
  stock?: number;
  /** Stock at or below this is flagged "Low". Default 10. */
  lowStockAt?: number;
  archived?: boolean;
}

export interface CatalogSelection {
  productId: string;
  quantity: number;
}

export interface ProductCatalogProps {
  products: CatalogProduct[];
  /** ISO 4217 code used for price formatting. Default "USD". */
  currency?: string;
  locale?: string;
  selection?: CatalogSelection[];
  defaultSelection?: CatalogSelection[];
  onSelectionChange?: (selection: CatalogSelection[]) => void;
  /** Primary action for the selection, e.g. "Add to quote". */
  onAddToQuote?: (selection: CatalogSelection[]) => void;
  addLabel?: string;
  loading?: boolean;
  className?: string;
}

type Sort = "name" | "price_asc" | "price_desc" | "stock";

const intervalSuffix: Record<BillingInterval, string> = { one_time: "", month: "/mo", year: "/yr" };

function stockState(p: CatalogProduct) {
  if (p.stock === undefined)
    return { label: "Unlimited", color: "neutral" as const, max: Infinity };
  if (p.stock <= 0) return { label: "Out of stock", color: "red" as const, max: 0 };
  if (p.stock <= (p.lowStockAt ?? 10))
    return { label: `Low · ${p.stock}`, color: "amber" as const, max: p.stock };
  return { label: `${p.stock} in stock`, color: "green" as const, max: p.stock };
}

/** Searchable product/price catalog with category, sort, grid/list views, stock state and a quantity cart. */
export function ProductCatalog({
  products,
  currency = "USD",
  locale = "en-US",
  selection: selProp,
  defaultSelection = [],
  onSelectionChange,
  onAddToQuote,
  addLabel = "Add to quote",
  loading,
  className,
}: ProductCatalogProps) {
  const [innerSel, setInnerSel] = React.useState(defaultSelection);
  const selection = selProp ?? innerSel;
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("All");
  const [sort, setSort] = React.useState<Sort>("name");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [showArchived, setShowArchived] = React.useState(false);

  const fmt = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency }),
    [locale, currency],
  );

  const categories = React.useMemo(
    () => ["All", ...[...new Set(products.map((p) => p.category))].sort()],
    [products],
  );

  const q = query.trim().toLowerCase();
  const list = products
    .filter(
      (p) =>
        (showArchived || !p.archived) &&
        (category === "All" || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      if (sort === "stock") return (a.stock ?? Infinity) - (b.stock ?? Infinity);
      return a.name.localeCompare(b.name);
    });

  const qty = (id: string) => selection.find((s) => s.productId === id)?.quantity ?? 0;
  const setQty = (p: CatalogProduct, n: number) => {
    const max = stockState(p).max;
    const clamped = Math.max(0, Math.min(max, Math.floor(n) || 0));
    const rest = selection.filter((s) => s.productId !== p.id);
    const next = clamped ? [...rest, { productId: p.id, quantity: clamped }] : rest;
    if (selProp === undefined) setInnerSel(next);
    onSelectionChange?.(next);
  };

  const byId = new Map(products.map((p) => [p.id, p]));
  const cartTotal = selection.reduce(
    (s, x) => s + (byId.get(x.productId)?.price ?? 0) * x.quantity,
    0,
  );
  const cartUnits = selection.reduce((s, x) => s + x.quantity, 0);

  const stepper = (p: CatalogProduct) => {
    const st = stockState(p);
    const n = qty(p.id);
    const disabled = st.max === 0 || p.archived;
    return n === 0 ? (
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => setQty(p, 1)}>
        <Plus className="size-3" aria-hidden /> Add
      </Button>
    ) : (
      <div
        className="flex items-center rounded-crm border border-crm-border"
        role="group"
        aria-label={`${p.name} quantity`}
      >
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => setQty(p, n - 1)}
          className="p-1.5 text-crm-soft hover:text-crm-fg"
        >
          <Minus className="size-3" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={Number.isFinite(st.max) ? st.max : undefined}
          value={n}
          onChange={(e) => setQty(p, Number(e.target.value))}
          aria-label={`${p.name} quantity`}
          className="w-10 bg-transparent text-center text-xs tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label="Increase"
          disabled={n >= st.max}
          onClick={() => setQty(p, n + 1)}
          className="p-1.5 text-crm-soft hover:text-crm-fg disabled:opacity-40"
        >
          <Plus className="size-3" />
        </button>
      </div>
    );
  };

  return (
    <section
      aria-label="Product catalog"
      className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          className="w-full sm:w-64"
          size="sm"
          placeholder="Search name or SKU"
          value={query}
          onValueChange={setQuery}
        />
        <select
          aria-label="Sort products"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-7 rounded-crm border border-crm-border bg-crm-card px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          <option value="name">Name A–Z</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="stock">Lowest stock first</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-crm-soft">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
        <div
          className="ml-auto flex rounded-crm border border-crm-border"
          role="group"
          aria-label="Layout"
        >
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              aria-label={v === "grid" ? "Grid view" : "List view"}
              onClick={() => setView(v)}
              className={cn("p-1.5 text-crm-soft", view === v && "bg-crm-muted text-crm-fg")}
            >
              {v === "grid" ? <LayoutGrid className="size-3.5" /> : <List className="size-3.5" />}
            </button>
          ))}
        </div>
      </div>

      <div role="tablist" aria-label="Categories" className="flex gap-1 overflow-x-auto">
        {categories.map((c) => (
          <button
            key={c}
            role="tab"
            type="button"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "shrink-0 rounded-full border border-crm-border px-2.5 py-1 text-xs",
              category === c
                ? "border-crm-primary bg-crm-primary/15 text-crm-fg"
                : "text-crm-soft hover:text-crm-fg",
            )}
          >
            {c}
            <span className="ml-1 text-crm-subtle tabular-nums">
              {c === "All"
                ? products.filter((p) => showArchived || !p.archived).length
                : products.filter((p) => p.category === c && (showArchived || !p.archived)).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-crm bg-crm-muted" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-crm border border-dashed border-crm-border p-10 text-center">
          <PackageSearch className="size-6 text-crm-faint" aria-hidden />
          <p className="text-sm">No products match</p>
          <button
            type="button"
            className="text-xs text-crm-soft underline"
            onClick={() => {
              setQuery("");
              setCategory("All");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const st = stockState(p);
            return (
              <li
                key={p.id}
                className={cn(
                  "flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-card p-3 shadow-crm-raised",
                  qty(p.id) > 0 && "border-crm-primary",
                  p.archived && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">{p.name}</h3>
                    <p className="crm-caption text-crm-subtle">{p.sku}</p>
                  </div>
                  {p.archived ? (
                    <Tag size="sm">Archived</Tag>
                  ) : (
                    <Tag size="sm" color={st.color}>
                      {st.label}
                    </Tag>
                  )}
                </div>
                {p.description ? (
                  <p className="line-clamp-2 text-xs text-crm-soft">{p.description}</p>
                ) : null}
                <div className="mt-auto flex items-center justify-between pt-1">
                  <span className="text-sm tabular-nums">
                    {fmt.format(p.price)}
                    <span className="text-xs text-crm-subtle">
                      {intervalSuffix[p.interval ?? "one_time"]}
                    </span>
                  </span>
                  {stepper(p)}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-crm border border-crm-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-crm-bg text-left text-xs text-crm-soft">
              <tr>
                <th className="px-3 py-2 font-normal">Product</th>
                <th className="px-3 py-2 font-normal">Category</th>
                <th className="px-3 py-2 font-normal">Stock</th>
                <th className="px-3 py-2 text-right font-normal">Price</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Quantity</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const st = stockState(p);
                return (
                  <tr key={p.id} className="border-t border-crm-border">
                    <td className="px-3 py-2">
                      {p.name}
                      <span className="block text-xs text-crm-subtle">{p.sku}</span>
                    </td>
                    <td className="px-3 py-2 text-crm-soft">{p.category}</td>
                    <td className="px-3 py-2">
                      <Tag size="sm" color={st.color}>
                        {st.label}
                      </Tag>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmt.format(p.price)}
                      <span className="text-xs text-crm-subtle">
                        {intervalSuffix[p.interval ?? "one_time"]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{stepper(p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {cartUnits > 0 ? (
        <div
          aria-live="polite"
          className="sticky bottom-0 flex items-center gap-3 rounded-crm border border-crm-border bg-crm-raised p-2.5 shadow-crm-raised"
        >
          <ShoppingCart className="size-4 text-crm-soft" aria-hidden />
          <span className="text-sm">
            {selection.length} product{selection.length === 1 ? "" : "s"} · {cartUnits} unit
            {cartUnits === 1 ? "" : "s"}
          </span>
          <span className="ml-auto text-sm font-medium tabular-nums">{fmt.format(cartTotal)}</span>
          {onAddToQuote ? (
            <Button size="sm" onClick={() => onAddToQuote(selection)}>
              {addLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
