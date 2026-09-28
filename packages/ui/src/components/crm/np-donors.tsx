import * as React from "react";
import { ArrowDown, ArrowUp, HeartHandshake, Receipt, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export interface DonorGift {
  /** ISO date. */
  date: string;
  amount: number;
  fund: string;
  recurring?: boolean;
}

export interface Donor {
  id: string;
  name: string;
  email: string;
  gifts: DonorGift[];
  /** Tax receipt sent for the current year. */
  receiptSent?: boolean;
}

export type DonorSegment = "major" | "recurring" | "lybunt" | "lapsed" | "new" | "active";

export interface NpDonorsProps {
  donors: Donor[];
  now?: Date;
  /** Lifetime giving threshold for major donors. */
  majorThreshold?: number;
  currency?: string;
  locale?: string;
  onSelect?: (donor: Donor) => void;
  className?: string;
}

const segmentMeta: Record<DonorSegment, { label: string; color: TagColor; hint: string }> = {
  major: { label: "Major", color: "purple", hint: "Lifetime giving above threshold" },
  recurring: { label: "Recurring", color: "teal", hint: "Active monthly gift" },
  lybunt: { label: "LYBUNT", color: "amber", hint: "Gave last year but not this year" },
  lapsed: { label: "Lapsed", color: "red", hint: "No gift for over 18 months" },
  new: { label: "New", color: "green", hint: "First gift within 90 days" },
  active: { label: "Active", color: "blue", hint: "Gave this year" },
};

const DAY = 86_400_000;

/** Derives giving metrics and segments for a donor, relative to `now`. */
export function donorProfile(d: Donor, now: Date, majorThreshold: number) {
  const gifts = [...d.gifts].sort((a, b) => b.date.localeCompare(a.date));
  const year = now.getFullYear();
  const lifetime = gifts.reduce((s, g) => s + g.amount, 0);
  const ytd = gifts
    .filter((g) => new Date(g.date).getFullYear() === year)
    .reduce((s, g) => s + g.amount, 0);
  const lastYear = gifts
    .filter((g) => new Date(g.date).getFullYear() === year - 1)
    .reduce((s, g) => s + g.amount, 0);
  const last = gifts[0];
  const first = gifts[gifts.length - 1];
  const sinceLast = last ? (now.getTime() - new Date(last.date).getTime()) / DAY : Infinity;
  const segments: DonorSegment[] = [];
  if (lifetime >= majorThreshold) segments.push("major");
  if (last?.recurring && sinceLast < 45) segments.push("recurring");
  if (first && (now.getTime() - new Date(first.date).getTime()) / DAY <= 90) segments.push("new");
  if (lastYear > 0 && ytd === 0) segments.push("lybunt");
  if (sinceLast > 548) segments.push("lapsed");
  else if (ytd > 0 && !segments.includes("new")) segments.push("active");
  return { gifts, lifetime, ytd, lastYear, last, sinceLast, count: gifts.length, segments };
}

type SortKey = "lifetime" | "ytd" | "last";

/** Donor list with RFM-style segments (major, recurring, LYBUNT, lapsed, new), sorting and gift history. */
export function NpDonors({
  donors,
  now,
  majorThreshold = 10_000,
  currency = "USD",
  locale = "en-US",
  onSelect,
  className,
}: NpDonorsProps) {
  const ref = React.useMemo(() => now ?? new Date(), [now]);
  const [segment, setSegment] = React.useState<"all" | DonorSegment>("all");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; desc: boolean }>({
    key: "lifetime",
    desc: true,
  });
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const money = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }),
    [locale, currency],
  );

  const profiles = React.useMemo(
    () => donors.map((d) => ({ donor: d, p: donorProfile(d, ref, majorThreshold) })),
    [donors, ref, majorThreshold],
  );

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: profiles.length };
    for (const { p } of profiles) for (const s of p.segments) c[s] = (c[s] ?? 0) + 1;
    return c;
  }, [profiles]);

  const lybuntValue = profiles
    .filter(({ p }) => p.segments.includes("lybunt"))
    .reduce((s, { p }) => s + p.lastYear, 0);

  const rows = profiles
    .filter(({ p }) => segment === "all" || p.segments.includes(segment))
    .filter(({ donor }) => {
      const q = query.trim().toLowerCase();
      return !q || donor.name.toLowerCase().includes(q) || donor.email.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const v =
        sort.key === "lifetime"
          ? a.p.lifetime - b.p.lifetime
          : sort.key === "ytd"
            ? a.p.ytd - b.p.ytd
            : b.p.sinceLast - a.p.sinceLast;
      return sort.desc ? -v : v;
    });

  const selected = profiles.find(({ donor }) => donor.id === selectedId) ?? null;

  const th = (key: SortKey, label: string) => (
    <th
      scope="col"
      aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}
      className="py-1.5 text-right font-normal"
    >
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))}
        className="inline-flex items-center gap-1 rounded-sm text-crm-subtle outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary"
      >
        {label}
        {sort.key === key ? (
          sort.desc ? (
            <ArrowDown className="size-3" aria-hidden />
          ) : (
            <ArrowUp className="size-3" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );

  return (
    <section
      aria-label="Donors"
      className={cn(
        "flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 font-crm shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="crm-eyebrow">Donors</span>
          <span className="text-xs text-crm-subtle">
            {counts.lybunt ?? 0} LYBUNT donors · {money.format(lybuntValue)} at risk from last year
          </span>
        </div>
        <SearchInput
          size="sm"
          className="w-full sm:w-56"
          placeholder="Name or email"
          aria-label="Search donors"
          value={query}
          onValueChange={setQuery}
        />
      </header>
      <div className="overflow-x-auto">
        <SegmentedControl
          size="sm"
          label="Donor segment"
          value={segment}
          onValueChange={(v) => setSegment(v as "all" | DonorSegment)}
          options={[
            { value: "all", label: "All", count: counts.all },
            ...(Object.keys(segmentMeta) as DonorSegment[]).map((s) => ({
              value: s,
              label: segmentMeta[s].label,
              count: counts[s] ?? 0,
            })),
          ]}
        />
      </div>
      {segment !== "all" ? (
        <p className="text-xs text-crm-subtle">{segmentMeta[segment].hint}.</p>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-crm border border-dashed border-crm-border py-10 text-center">
            <HeartHandshake className="size-5 text-crm-subtle" aria-hidden />
            <p className="text-xs text-crm-subtle">No donors in this segment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr>
                  <th scope="col" className="py-1.5 text-left font-normal text-crm-subtle">
                    Donor
                  </th>
                  {th("lifetime", "Lifetime")}
                  {th("ytd", "This year")}
                  {th("last", "Last gift")}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ donor, p }) => (
                  <tr
                    key={donor.id}
                    tabIndex={0}
                    aria-selected={selectedId === donor.id}
                    onClick={() => {
                      setSelectedId(donor.id);
                      onSelect?.(donor);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setSelectedId(donor.id);
                        onSelect?.(donor);
                      }
                    }}
                    className={cn(
                      "cursor-pointer border-t border-crm-border outline-none hover:bg-crm-raised focus-visible:bg-crm-raised",
                      selectedId === donor.id && "bg-crm-raised",
                    )}
                  >
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={donor.name} size="md" />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-sm text-crm-fg">{donor.name}</span>
                          <span className="flex flex-wrap gap-1">
                            {p.segments.slice(0, 3).map((s) => (
                              <Tag key={s} size="sm" color={segmentMeta[s].color}>
                                {segmentMeta[s].label}
                              </Tag>
                            ))}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 text-right text-crm-fg tabular-nums">
                      {money.format(p.lifetime)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      <span className={p.ytd === 0 ? "text-crm-subtle" : "text-crm-fg"}>
                        {money.format(p.ytd)}
                      </span>
                      {p.lastYear > 0 ? (
                        <div
                          className={cn(
                            "text-[11px]",
                            p.ytd >= p.lastYear ? "text-crm-success" : "text-crm-subtle",
                          )}
                        >
                          LY {money.format(p.lastYear)}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 text-right tabular-nums text-crm-soft">
                      {p.last ? p.last.date : "—"}
                      <div
                        className={cn(
                          "text-[11px]",
                          p.sinceLast > 365 ? "text-crm-danger" : "text-crm-subtle",
                        )}
                      >
                        {Number.isFinite(p.sinceLast) ? `${Math.floor(p.sinceLast)}d ago` : ""}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <aside
          aria-label="Donor detail"
          className="flex flex-col gap-2 rounded-crm border border-crm-border bg-crm-raised p-3 text-xs"
        >
          {selected ? (
            <>
              <div className="flex items-center gap-2">
                <Avatar name={selected.donor.name} size="lg" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-crm-fg">{selected.donor.name}</span>
                  <span className="text-crm-subtle">{selected.donor.email}</span>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-crm bg-crm-card p-2">
                  <dt className="text-crm-subtle">Gifts</dt>
                  <dd className="text-sm text-crm-fg tabular-nums">{selected.p.count}</dd>
                </div>
                <div className="rounded-crm bg-crm-card p-2">
                  <dt className="text-crm-subtle">Average</dt>
                  <dd className="text-sm text-crm-fg tabular-nums">
                    {money.format(selected.p.count ? selected.p.lifetime / selected.p.count : 0)}
                  </dd>
                </div>
                <div className="rounded-crm bg-crm-card p-2">
                  <dt className="text-crm-subtle">Largest</dt>
                  <dd className="text-sm text-crm-fg tabular-nums">
                    {money.format(Math.max(0, ...selected.p.gifts.map((g) => g.amount)))}
                  </dd>
                </div>
              </dl>
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  selected.donor.receiptSent ? "text-crm-success" : "text-crm-warning",
                )}
              >
                <Receipt className="size-3.5" aria-hidden />
                {selected.donor.receiptSent
                  ? "Tax receipt sent for this year"
                  : "Tax receipt not yet sent"}
              </span>
              <span className="crm-caption pt-1 text-crm-soft">Gift history</span>
              <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                {selected.p.gifts.map((g, i) => (
                  <li
                    key={`${g.date}-${i}`}
                    className="flex items-center gap-2 border-t border-crm-border py-1"
                  >
                    <span className="w-20 text-crm-subtle tabular-nums">{g.date}</span>
                    <span className="flex-1 truncate text-crm-soft">{g.fund}</span>
                    {g.recurring ? (
                      <Repeat className="size-3 text-crm-subtle" aria-label="Recurring" />
                    ) : null}
                    <span className="text-crm-fg tabular-nums">{money.format(g.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="py-8 text-center text-crm-subtle">
              Select a donor to see giving history.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
