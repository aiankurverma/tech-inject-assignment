import * as React from "react";
import { Bath, BedDouble, Home, LayoutGrid, List, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export type ListingStatus = "active" | "pending" | "sold" | "coming-soon" | "withdrawn";

export interface Listing {
  id: string;
  address: string;
  city: string;
  price: number;
  /** Original list price; a lower `price` shows a reduction. */
  originalPrice?: number;
  beds: number;
  baths: number;
  sqft: number;
  status: ListingStatus;
  /** ISO date listed. */
  listedAt: string;
  /** ISO date sold (sold only). */
  soldAt?: string;
  soldPrice?: number;
  type: "Single family" | "Condo" | "Townhouse" | "Multi-family";
  agent: string;
  photo?: string;
  showings?: number;
}

export interface ReListingsProps {
  listings: Listing[];
  currency?: string;
  /** Override "today" for days-on-market. */
  now?: Date;
  onOpen?: (listing: Listing) => void;
  className?: string;
}

const statusMeta: Record<ListingStatus, { label: string; color: TagColor }> = {
  active: { label: "Active", color: "green" },
  pending: { label: "Pending", color: "amber" },
  sold: { label: "Sold", color: "blue" },
  "coming-soon": { label: "Coming soon", color: "purple" },
  withdrawn: { label: "Withdrawn", color: "neutral" },
};

const DAY = 86_400_000;
/** Days on market: listed → sold (or today). */
export const daysOnMarket = (l: Listing, now: Date) =>
  Math.max(0, Math.round((+(l.soldAt ? new Date(l.soldAt) : now) - +new Date(l.listedAt)) / DAY));

type SortKey = "newest" | "price-desc" | "price-asc" | "ppsf" | "dom";

/** Real-estate listings workspace: KPIs, search, status/bed/price filters, sort, grid or table view, price-per-sqft and DOM. */
export function ReListings({
  listings,
  currency = "USD",
  now: nowProp,
  onOpen,
  className,
}: ReListingsProps) {
  const now = nowProp ?? new Date();
  const money = React.useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }),
    [currency],
  );
  const compact = React.useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [currency],
  );
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | ListingStatus>("all");
  const [minBeds, setMinBeds] = React.useState(0);
  const [maxPrice, setMaxPrice] = React.useState<number | "">("");
  const [sort, setSort] = React.useState<SortKey>("newest");
  const [view, setView] = React.useState("grid");

  const filtered = listings
    .filter((l) => status === "all" || l.status === status)
    .filter((l) => l.beds >= minBeds)
    .filter((l) => maxPrice === "" || l.price <= maxPrice)
    .filter((l) => {
      const s = q.trim().toLowerCase();
      return !s || `${l.address} ${l.city} ${l.agent} ${l.type}`.toLowerCase().includes(s);
    })
    .sort((a, b) => {
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "ppsf") return b.price / b.sqft - a.price / a.sqft;
      if (sort === "dom") return daysOnMarket(b, now) - daysOnMarket(a, now);
      return +new Date(b.listedAt) - +new Date(a.listedAt);
    });

  const active = listings.filter((l) => l.status === "active");
  const sold = listings.filter((l) => l.status === "sold");
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const saleToList = avg(sold.map((l) => (l.soldPrice ?? l.price) / (l.originalPrice ?? l.price)));
  const count = (s: ListingStatus) => listings.filter((l) => l.status === s).length;

  return (
    <section aria-label="Listings" className={cn("flex flex-col gap-3 font-crm", className)}>
      <KpiGrid
        items={[
          {
            label: "Active listings",
            value: active.length,
            caption: `${count("pending")} pending`,
            icon: <Home />,
          },
          {
            label: "Active volume",
            value: compact.format(active.reduce((s, l) => s + l.price, 0)),
            caption: "list value",
          },
          {
            label: "Avg days on market",
            value: Math.round(avg(active.map((l) => daysOnMarket(l, now)))),
            caption: "active only",
          },
          {
            label: "Sale-to-list",
            value: sold.length ? `${(saleToList * 100).toFixed(1)}%` : "—",
            caption: `${sold.length} sold`,
          },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2 rounded-crm border border-crm-border bg-crm-card p-2 shadow-crm-raised">
        <SearchInput
          size="sm"
          value={q}
          onValueChange={setQ}
          placeholder="Address, city, agent"
          className="w-full sm:w-56"
        />
        <SegmentedControl
          label="Status"
          size="sm"
          value={status}
          onValueChange={(v) => setStatus(v as typeof status)}
          options={[
            { value: "all", label: "All", count: listings.length },
            { value: "active", label: "Active", count: count("active") },
            { value: "pending", label: "Pending", count: count("pending") },
            { value: "sold", label: "Sold", count: count("sold") },
          ]}
        />
        <label className="flex items-center gap-1.5 text-xs text-crm-soft">
          Beds
          <select
            value={minBeds}
            onChange={(e) => setMinBeds(Number(e.target.value))}
            className="h-7 rounded-full border border-crm-border bg-crm-raised px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n ? `${n}+` : "Any"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-crm-soft">
          Max price
          <input
            inputMode="numeric"
            placeholder="No max"
            value={maxPrice === "" ? "" : maxPrice.toLocaleString("en-US")}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^\d]/g, ""));
              setMaxPrice(e.target.value.trim() && n ? n : "");
            }}
            className="h-7 w-28 rounded-full border border-crm-border bg-crm-raised px-2.5 text-xs text-crm-fg tabular-nums outline-none placeholder:text-crm-subtle focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-crm-soft">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-7 rounded-full border border-crm-border bg-crm-raised px-2 text-xs text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            <option value="newest">Newest</option>
            <option value="price-desc">Price: high to low</option>
            <option value="price-asc">Price: low to high</option>
            <option value="ppsf">Price / sqft</option>
            <option value="dom">Days on market</option>
          </select>
        </label>
        <SegmentedControl
          label="View"
          size="sm"
          className="ml-auto"
          value={view}
          onValueChange={setView}
          options={[
            { value: "grid", label: "Grid", icon: <LayoutGrid /> },
            { value: "table", label: "Table", icon: <List /> },
          ]}
        />
      </div>
      <p className="text-xs text-crm-subtle" aria-live="polite">
        {filtered.length} of {listings.length} listings ·{" "}
        {money.format(filtered.reduce((s, l) => s + l.price, 0))} total
      </p>

      {!filtered.length ? (
        <div className="rounded-crm border border-dashed border-crm-border p-10 text-center text-sm text-crm-subtle">
          No listings match these filters.
        </div>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((l) => {
            const dom = daysOnMarket(l, now);
            const cut =
              l.originalPrice && l.originalPrice > l.price ? l.originalPrice - l.price : 0;
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onOpen?.(l)}
                  className="flex w-full cursor-pointer flex-col overflow-hidden rounded-crm border border-crm-border bg-crm-card text-left shadow-crm-raised outline-none hover:border-crm-input focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                >
                  <span className="relative block aspect-[16/9] bg-crm-muted">
                    {l.photo ? (
                      <img src={l.photo} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <Home
                        className="absolute inset-0 m-auto size-8 text-crm-subtle"
                        aria-hidden
                      />
                    )}
                    <Tag
                      color={statusMeta[l.status].color}
                      size="sm"
                      className="absolute top-2 left-2"
                    >
                      {statusMeta[l.status].label}
                    </Tag>
                    {dom > 60 && l.status === "active" ? (
                      <Tag color="red" size="sm" className="absolute top-2 right-2">
                        Stale
                      </Tag>
                    ) : null}
                  </span>
                  <span className="flex flex-col gap-1.5 p-3">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-lg font-semibold text-crm-fg tabular-nums">
                        {money.format(l.status === "sold" && l.soldPrice ? l.soldPrice : l.price)}
                      </span>
                      {cut ? (
                        <span className="text-xs text-crm-danger tabular-nums">
                          −{compact.format(cut)}
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-sm text-crm-fg">{l.address}</span>
                    <span className="text-xs text-crm-subtle">
                      {l.city} · {l.type}
                    </span>
                    <span className="flex flex-wrap items-center gap-3 text-xs text-crm-soft [&_svg]:size-3.5">
                      <span className="flex items-center gap-1">
                        <BedDouble aria-hidden /> {l.beds} bd
                      </span>
                      <span className="flex items-center gap-1">
                        <Bath aria-hidden /> {l.baths} ba
                      </span>
                      <span className="flex items-center gap-1 tabular-nums">
                        <Ruler aria-hidden /> {l.sqft.toLocaleString("en-US")} sqft
                      </span>
                    </span>
                    <span className="flex justify-between border-t border-crm-border pt-1.5 text-[11px] text-crm-subtle tabular-nums">
                      <span>{money.format(Math.round(l.price / l.sqft))}/sqft</span>
                      <span>
                        {dom} DOM · {l.agent}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-crm border border-crm-border bg-crm-card shadow-crm-raised">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="text-crm-subtle">
              <tr className="border-b border-crm-border">
                {[
                  "Address",
                  "Status",
                  "Price",
                  "$/sqft",
                  "Bd/Ba",
                  "Sqft",
                  "DOM",
                  "Showings",
                  "Agent",
                ].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  tabIndex={0}
                  onClick={() => onOpen?.(l)}
                  onKeyDown={(e) => e.key === "Enter" && onOpen?.(l)}
                  className="cursor-pointer border-b border-crm-border text-crm-fg outline-none last:border-0 hover:bg-crm-raised focus-visible:bg-crm-raised"
                >
                  <td className="px-3 py-2">
                    <span className="block">{l.address}</span>
                    <span className="text-crm-subtle">{l.city}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Tag color={statusMeta[l.status].color} size="sm">
                      {statusMeta[l.status].label}
                    </Tag>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{money.format(l.price)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {money.format(Math.round(l.price / l.sqft))}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {l.beds}/{l.baths}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{l.sqft.toLocaleString("en-US")}</td>
                  <td className="px-3 py-2 tabular-nums">{daysOnMarket(l, now)}</td>
                  <td className="px-3 py-2 tabular-nums">{l.showings ?? 0}</td>
                  <td className="px-3 py-2 text-crm-soft">{l.agent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
