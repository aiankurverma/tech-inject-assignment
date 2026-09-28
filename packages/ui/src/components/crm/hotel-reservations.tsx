import * as React from "react";
import { AlertTriangle, ArrowDown, ArrowUp, BedDouble, LogIn, LogOut, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export type ReservationStatus = "confirmed" | "in-house" | "checked-out" | "cancelled" | "no-show";

export interface Reservation {
  id: string;
  guest: string;
  room?: string;
  roomType: string;
  /** ISO date (YYYY-MM-DD). */
  checkIn: string;
  /** ISO date (YYYY-MM-DD), exclusive. */
  checkOut: string;
  adults: number;
  children?: number;
  /** Nightly rate in minor units (cents). */
  rate: number;
  /** Amount already paid in minor units. */
  paid: number;
  channel: string;
  status: ReservationStatus;
}

export interface HotelReservationsProps {
  reservations: Reservation[];
  /** ISO date treated as "today" for arrivals/departures. */
  today: string;
  currency?: string;
  locale?: string;
  loading?: boolean;
  error?: string;
  onCheckIn?: (r: Reservation) => void;
  onCheckOut?: (r: Reservation) => void;
  onCancel?: (r: Reservation) => void;
  onSelect?: (r: Reservation) => void;
  className?: string;
}

type View = "all" | "arrivals" | "departures" | "in-house" | "cancelled";
type SortKey = "checkIn" | "guest" | "balance";

const statusMeta: Record<ReservationStatus, { label: string; color: TagColor }> = {
  confirmed: { label: "Confirmed", color: "blue" },
  "in-house": { label: "In house", color: "green" },
  "checked-out": { label: "Checked out", color: "neutral" },
  cancelled: { label: "Cancelled", color: "red" },
  "no-show": { label: "No-show", color: "orange" },
};

const DAY = 86_400_000;
const toTime = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** Nights between two ISO dates (checkout exclusive). */
export function nightsBetween(checkIn: string, checkOut: string) {
  return Math.max(0, Math.round((toTime(checkOut) - toTime(checkIn)) / DAY));
}

export function reservationTotal(r: Reservation) {
  return nightsBetween(r.checkIn, r.checkOut) * r.rate;
}

/** Ids of active reservations that overlap another one on the same room. */
export function findRoomConflicts(list: Reservation[]) {
  const active = list.filter(
    (r) => r.room && (r.status === "confirmed" || r.status === "in-house"),
  );
  const out = new Set<string>();
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      if (
        a.room === b.room &&
        toTime(a.checkIn) < toTime(b.checkOut) &&
        toTime(b.checkIn) < toTime(a.checkOut)
      ) {
        out.add(a.id);
        out.add(b.id);
      }
    }
  return out;
}

function SortHead({
  active,
  dir,
  onSort,
  children,
  className,
}: {
  active: boolean;
  dir: 1 | -1;
  onSort: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 1 ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-2 font-medium", className)}
    >
      <button
        type="button"
        onClick={onSort}
        className="inline-flex items-center gap-1 rounded-crm hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 focus-visible:outline-none"
      >
        {children}
        {active && (dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
}

/** Front-desk reservation list: arrivals, departures, in-house, balances and double-booking detection. */
export function HotelReservations({
  reservations,
  today,
  currency = "USD",
  locale = "en-US",
  loading,
  error,
  onCheckIn,
  onCheckOut,
  onCancel,
  onSelect,
  className,
}: HotelReservationsProps) {
  const [view, setView] = React.useState<View>("all");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "checkIn",
    dir: 1,
  });
  const money = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency }),
    [locale, currency],
  );
  const fmtDate = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }),
    [locale],
  );
  const conflicts = React.useMemo(() => findRoomConflicts(reservations), [reservations]);

  const is = React.useMemo<Record<View, (r: Reservation) => boolean>>(
    () => ({
      arrivals: (r) => r.checkIn === today && r.status === "confirmed",
      departures: (r) => r.checkOut === today && r.status === "in-house",
      "in-house": (r) => r.status === "in-house",
      cancelled: (r) => r.status === "cancelled" || r.status === "no-show",
      all: () => true,
    }),
    [today],
  );

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const balance = (r: Reservation) => reservationTotal(r) - r.paid;
    return reservations
      .filter(is[view])
      .filter(
        (r) =>
          !q ||
          [r.guest, r.id, r.room ?? "", r.roomType, r.channel].some((s) =>
            s.toLowerCase().includes(q),
          ),
      )
      .sort((a, b) => {
        const d =
          sort.key === "guest"
            ? a.guest.localeCompare(b.guest)
            : sort.key === "balance"
              ? balance(a) - balance(b)
              : toTime(a.checkIn) - toTime(b.checkIn);
        return d * sort.dir;
      });
  }, [reservations, view, query, sort, is]);

  const count = (v: View) => reservations.filter(is[v]).length;
  const totals = rows.reduce(
    (acc, r) => {
      if (r.status === "cancelled" || r.status === "no-show") return acc;
      acc.revenue += reservationTotal(r);
      acc.due += Math.max(0, reservationTotal(r) - r.paid);
      acc.nights += nightsBetween(r.checkIn, r.checkOut);
      return acc;
    },
    { revenue: 0, due: 0, nights: 0 },
  );

  const sortProps = (key: SortKey) => ({
    active: sort.key === key,
    dir: sort.dir,
    onSort: () =>
      setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 })),
  });

  return (
    <section
      aria-label="Reservations"
      className={cn(
        "flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-3 font-crm text-crm-fg shadow-crm-raised",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Reservation view"
          size="sm"
          value={view}
          onValueChange={(v) => setView(v as View)}
          options={[
            { value: "all", label: "All", count: count("all") },
            { value: "arrivals", label: "Arrivals", count: count("arrivals") },
            { value: "departures", label: "Departures", count: count("departures") },
            { value: "in-house", label: "In house", count: count("in-house") },
            { value: "cancelled", label: "Cancelled", count: count("cancelled") },
          ]}
        />
        <SearchInput
          size="sm"
          className="w-full sm:ml-auto sm:w-56"
          placeholder="Guest, room, confirmation…"
          aria-label="Search reservations"
          value={query}
          onValueChange={setQuery}
        />
      </div>

      {conflicts.size > 0 && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-crm border border-tag-red-border bg-tag-red-bg px-2.5 py-1.5 text-xs text-tag-red-text"
        >
          <AlertTriangle className="size-3.5 shrink-0" />
          {conflicts.size} reservations overlap on the same room. Reassign before arrival.
        </p>
      )}

      <div className="overflow-x-auto rounded-crm border border-crm-border">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-crm-muted/40 text-crm-soft">
            <tr>
              <SortHead {...sortProps("guest")}>Guest</SortHead>
              <th scope="col" className="px-3 py-2 font-medium">
                Room
              </th>
              <SortHead {...sortProps("checkIn")}>Stay</SortHead>
              <th scope="col" className="px-3 py-2 font-medium">
                Status
              </th>
              <SortHead {...sortProps("balance")} className="text-right">
                Balance
              </SortHead>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-crm-danger" role="alert">
                  {error}
                </td>
              </tr>
            ) : loading ? (
              Array.from({ length: 4 }, (_, i) => (
                <tr key={i} className="border-t border-crm-border" aria-busy="true">
                  <td colSpan={6} className="px-3 py-3">
                    <div className="h-4 animate-pulse rounded bg-crm-muted" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-crm-soft">
                  No reservations match this view.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const nights = nightsBetween(r.checkIn, r.checkOut);
                const bal = reservationTotal(r) - r.paid;
                const meta = statusMeta[r.status];
                const conflict = conflicts.has(r.id);
                return (
                  <tr
                    key={r.id}
                    tabIndex={onSelect ? 0 : undefined}
                    onClick={() => onSelect?.(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.target === e.currentTarget) onSelect?.(r);
                    }}
                    className={cn(
                      "border-t border-crm-border align-middle",
                      onSelect &&
                        "cursor-pointer hover:bg-crm-muted/40 focus-visible:bg-crm-muted/40 focus-visible:outline-none",
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.guest}</div>
                      <div className="crm-caption text-crm-soft">
                        {r.id} · {r.channel} · {r.adults}A{r.children ? ` ${r.children}C` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          conflict && "text-crm-danger",
                        )}
                      >
                        <BedDouble className="size-3.5" />
                        {r.room ?? <span className="text-crm-warning">Unassigned</span>}
                        {conflict && (
                          <AlertTriangle aria-label="Room conflict" className="size-3" />
                        )}
                      </span>
                      <div className="crm-caption text-crm-soft">{r.roomType}</div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmtDate.format(toTime(r.checkIn))} → {fmtDate.format(toTime(r.checkOut))}
                      <div className="crm-caption text-crm-soft">
                        {nights} {nights === 1 ? "night" : "nights"} · {money.format(r.rate / 100)}
                        /nt
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Tag size="sm" color={meta.color}>
                        {meta.label}
                      </Tag>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        bal > 0 ? "text-crm-warning" : "text-crm-soft",
                      )}
                    >
                      {bal > 0
                        ? money.format(bal / 100)
                        : bal < 0
                          ? `Credit ${money.format(-bal / 100)}`
                          : "Settled"}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {r.status === "confirmed" && onCheckIn && (
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={!r.room || conflict}
                            title={
                              !r.room
                                ? "Assign a room first"
                                : conflict
                                  ? "Resolve room conflict first"
                                  : undefined
                            }
                            onClick={() => onCheckIn(r)}
                          >
                            <LogIn /> Check in
                          </Button>
                        )}
                        {r.status === "in-house" && onCheckOut && (
                          <Button
                            size="sm"
                            disabled={bal > 0}
                            title={bal > 0 ? "Settle balance first" : undefined}
                            onClick={() => onCheckOut(r)}
                          >
                            <LogOut /> Check out
                          </Button>
                        )}
                        {r.status === "confirmed" && onCancel && (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Cancel ${r.id}`}
                            onClick={() => onCancel(r)}
                          >
                            <XCircle />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <footer
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-crm-soft tabular-nums"
        aria-live="polite"
      >
        <span>{rows.length} reservations</span>
        <span>{totals.nights} room nights</span>
        <span>
          Room revenue <b className="text-crm-fg">{money.format(totals.revenue / 100)}</b>
        </span>
        <span>
          Outstanding <b className="text-crm-warning">{money.format(totals.due / 100)}</b>
        </span>
      </footer>
    </section>
  );
}
