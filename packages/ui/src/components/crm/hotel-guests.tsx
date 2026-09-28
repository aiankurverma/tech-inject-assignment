import * as React from "react";
import { Crown, Mail, Phone, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export type LoyaltyTier = "none" | "silver" | "gold" | "platinum";

export interface GuestStay {
  checkIn: string;
  nights: number;
  room: string;
  /** Folio total in minor units. */
  spend: number;
}

export interface HotelGuest {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  tier: LoyaltyTier;
  vip?: boolean;
  preferences?: string[];
  /** Allergies / accessibility notes surfaced prominently to staff. */
  alerts?: string[];
  stays: GuestStay[];
  /** Currently in house? */
  inHouse?: boolean;
}

export interface HotelGuestsProps {
  guests: HotelGuest[];
  selectedId?: string;
  defaultSelectedId?: string;
  onSelectedChange?: (id: string) => void;
  currency?: string;
  locale?: string;
  loading?: boolean;
  className?: string;
}

const tierMeta: Record<LoyaltyTier, { label: string; color: TagColor }> = {
  none: { label: "Member", color: "neutral" },
  silver: { label: "Silver", color: "blue" },
  gold: { label: "Gold", color: "amber" },
  platinum: { label: "Platinum", color: "purple" },
};

type Filter = "all" | "in-house" | "vip" | "loyalty";

export function guestLifetime(g: HotelGuest) {
  return g.stays.reduce((a, s) => ({ nights: a.nights + s.nights, spend: a.spend + s.spend }), {
    nights: 0,
    spend: 0,
  });
}

/** Guest directory with loyalty, lifetime value, preferences and stay history. */
export function HotelGuests({
  guests,
  selectedId,
  defaultSelectedId,
  onSelectedChange,
  currency = "USD",
  locale = "en-US",
  loading,
  className,
}: HotelGuestsProps) {
  const [inner, setInner] = React.useState(defaultSelectedId ?? guests[0]?.id);
  const current = selectedId ?? inner;
  const select = (id: string) => {
    setInner(id);
    onSelectedChange?.(id);
  };
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");
  const listRef = React.useRef<HTMLUListElement>(null);
  const money = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }),
    [locale, currency],
  );
  const fmtDate = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }),
    [locale],
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests
      .filter((g) =>
        filter === "in-house"
          ? g.inHouse
          : filter === "vip"
            ? g.vip
            : filter === "loyalty"
              ? g.tier !== "none"
              : true,
      )
      .filter(
        (g) =>
          !q ||
          [g.name, g.email ?? "", g.phone ?? "", g.country ?? ""].some((s) =>
            s.toLowerCase().includes(q),
          ),
      )
      .sort((a, b) => guestLifetime(b).spend - guestLifetime(a).spend);
  }, [guests, filter, query]);

  const guest = guests.find((g) => g.id === current);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = visible.findIndex((g) => g.id === current);
    const next =
      visible[Math.min(visible.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))];
    if (next) {
      select(next.id);
      listRef.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus();
    }
  };

  const life = guest ? guestLifetime(guest) : { nights: 0, spend: 0 };
  const lastStay = guest?.stays.slice().sort((a, b) => b.checkIn.localeCompare(a.checkIn));

  return (
    <section
      aria-label="Guests"
      className={cn(
        "grid gap-3 rounded-crm border border-crm-border bg-crm-card p-3 font-crm text-crm-fg shadow-crm-raised md:grid-cols-[minmax(0,300px)_1fr]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <SearchInput
          size="sm"
          placeholder="Name, email, phone…"
          aria-label="Search guests"
          value={query}
          onValueChange={setQuery}
        />
        <SegmentedControl
          label="Guest filter"
          size="sm"
          fullWidth
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          options={[
            { value: "all", label: "All" },
            { value: "in-house", label: "In house", count: guests.filter((g) => g.inHouse).length },
            { value: "vip", label: "VIP", count: guests.filter((g) => g.vip).length },
            { value: "loyalty", label: "Loyalty" },
          ]}
        />
        {loading ? (
          <div className="flex flex-col gap-1" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-crm bg-crm-muted" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-xs text-crm-soft">No guests found.</p>
        ) : (
          <ul
            ref={listRef}
            role="listbox"
            aria-label="Guest list"
            onKeyDown={onKey}
            className="flex max-h-[420px] flex-col gap-0.5 overflow-y-auto"
          >
            {visible.map((g) => {
              const lt = guestLifetime(g);
              const active = g.id === current;
              return (
                <li
                  key={g.id}
                  data-id={g.id}
                  role="option"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => select(g.id)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-crm px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:outline-none",
                    active ? "bg-crm-muted" : "hover:bg-crm-muted/50",
                  )}
                >
                  <Avatar name={g.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate font-medium">
                      {g.name}
                      {g.vip && <Crown aria-label="VIP" className="size-3 text-crm-warning" />}
                    </div>
                    <div className="crm-caption text-crm-soft">
                      {g.stays.length} stays · {money.format(lt.spend / 100)}
                    </div>
                  </div>
                  {g.inHouse && (
                    <Tag size="sm" color="green">
                      In house
                    </Tag>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="min-w-0 rounded-crm border border-crm-border p-3" aria-live="polite">
        {!guest ? (
          <p className="py-12 text-center text-xs text-crm-soft">
            Select a guest to view the profile.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <header className="flex flex-wrap items-start gap-3">
              <Avatar name={guest.name} size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium">{guest.name}</h3>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-crm-soft">
                  {guest.email && (
                    <a
                      href={`mailto:${guest.email}`}
                      className="inline-flex items-center gap-1 hover:text-crm-fg"
                    >
                      <Mail className="size-3" />
                      {guest.email}
                    </a>
                  )}
                  {guest.phone && (
                    <a
                      href={`tel:${guest.phone}`}
                      className="inline-flex items-center gap-1 hover:text-crm-fg"
                    >
                      <Phone className="size-3" />
                      {guest.phone}
                    </a>
                  )}
                  {guest.country && <span>{guest.country}</span>}
                </div>
              </div>
              <Tag color={tierMeta[guest.tier].color}>
                <Star className="size-3" /> {tierMeta[guest.tier].label}
              </Tag>
            </header>

            {guest.alerts && guest.alerts.length > 0 && (
              <ul
                role="alert"
                className="flex flex-wrap gap-1 rounded-crm border border-tag-red-border bg-tag-red-bg p-2 text-xs text-tag-red-text"
              >
                {guest.alerts.map((a) => (
                  <li key={a}>• {a}</li>
                ))}
              </ul>
            )}

            <dl className="grid grid-cols-3 gap-2">
              {[
                ["Lifetime value", money.format(life.spend / 100)],
                ["Room nights", String(life.nights)],
                [
                  "Avg. per night",
                  life.nights ? money.format(life.spend / 100 / life.nights) : "—",
                ],
              ].map(([k, v]) => (
                <div key={k} className="rounded-crm border border-crm-input/70 p-2">
                  <dt className="crm-caption text-crm-soft">{k}</dt>
                  <dd className="text-sm font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>

            {guest.preferences && guest.preferences.length > 0 && (
              <div>
                <h4 className="crm-eyebrow mb-1.5 text-crm-soft">Preferences</h4>
                <div className="flex flex-wrap gap-1">
                  {guest.preferences.map((p) => (
                    <Tag key={p} size="sm" color="teal">
                      {p}
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="crm-eyebrow mb-1.5 text-crm-soft">Stay history</h4>
              {lastStay && lastStay.length ? (
                <table className="w-full text-left text-xs">
                  <thead className="text-crm-soft">
                    <tr>
                      <th scope="col" className="py-1 font-medium">
                        Arrival
                      </th>
                      <th scope="col" className="py-1 font-medium">
                        Room
                      </th>
                      <th scope="col" className="py-1 font-medium">
                        Nights
                      </th>
                      <th scope="col" className="py-1 text-right font-medium">
                        Folio
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {lastStay.map((s) => (
                      <tr key={s.checkIn + s.room} className="border-t border-crm-border">
                        <td className="py-1.5">
                          {fmtDate.format(Date.parse(`${s.checkIn}T00:00:00Z`))}
                        </td>
                        <td className="py-1.5">{s.room}</td>
                        <td className="py-1.5">{s.nights}</td>
                        <td className="py-1.5 text-right">{money.format(s.spend / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-crm-soft">First-time guest.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
