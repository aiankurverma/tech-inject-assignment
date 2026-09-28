import * as React from "react";
import { BedDouble, DollarSign, LogIn, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { Progress } from "@/components/crm/progress";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag } from "@/components/crm/tag";

export interface HotelNight {
  /** ISO date. */
  date: string;
  roomsSold: number;
  /** Room revenue for the night in minor units. */
  revenue: number;
}

export interface HotelRoomType {
  name: string;
  total: number;
  sold: number;
  outOfOrder?: number;
}

export interface HotelMovement {
  id: string;
  guest: string;
  room?: string;
  kind: "arrival" | "departure";
  eta?: string;
  vip?: boolean;
  done?: boolean;
}

export interface HotelDashboardProps {
  propertyName: string;
  totalRooms: number;
  /** Nightly history + forecast, ordered by date. */
  nights: HotelNight[];
  /** ISO date of "tonight"; must exist in nights. */
  today: string;
  roomTypes: HotelRoomType[];
  movements: HotelMovement[];
  channels: { name: string; roomNights: number }[];
  currency?: string;
  locale?: string;
  className?: string;
}

const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

/** Revenue-manager view: occupancy / ADR / RevPAR vs last week, 14-night pace, room-type inventory, front-desk movements. */
export function HotelDashboard({
  propertyName,
  totalRooms,
  nights,
  today,
  roomTypes,
  movements,
  channels,
  currency = "USD",
  locale = "en-US",
  className,
}: HotelDashboardProps) {
  const [tab, setTab] = React.useState<"arrival" | "departure">("arrival");
  const [hover, setHover] = React.useState<number | null>(null);
  const money = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }),
    [locale, currency],
  );
  const dayFmt = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", timeZone: "UTC" }),
    [locale],
  );

  const idx = Math.max(
    0,
    nights.findIndex((n) => n.date === today),
  );
  const tonight = nights[idx] ?? { date: today, roomsSold: 0, revenue: 0 };
  const lastWeek = nights[idx - 7];
  const metrics = (n?: HotelNight) =>
    n
      ? {
          occ: pct(n.roomsSold, totalRooms),
          adr: n.roomsSold ? n.revenue / n.roomsSold / 100 : 0,
          revpar: n.revenue / totalRooms / 100,
        }
      : undefined;
  const now = metrics(tonight)!;
  const prev = metrics(lastWeek);
  const delta = (a: number, b?: number) => (b ? Math.round(((a - b) / b) * 1000) / 10 : undefined);

  const arrivals = movements.filter((m) => m.kind === "arrival");
  const pace = nights.slice(Math.max(0, idx - 3), idx + 11);
  const shown = (hover != null ? pace[hover] : undefined) ?? tonight;
  const channelTotal = channels.reduce((a, c) => a + c.roomNights, 0);

  return (
    <section
      aria-label={`${propertyName} dashboard`}
      className={cn("flex flex-col gap-4 font-crm text-crm-fg", className)}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="crm-eyebrow text-crm-soft">Night audit · {today}</p>
          <h2 className="text-lg font-medium">{propertyName}</h2>
        </div>
        <span className="text-xs text-crm-soft tabular-nums">
          {totalRooms - tonight.roomsSold} rooms left to sell tonight
        </span>
      </header>

      <KpiGrid
        items={[
          {
            label: "Occupancy",
            value: `${now.occ.toFixed(1)}%`,
            delta: delta(now.occ, prev?.occ),
            caption: "vs same night last week",
            icon: <Percent />,
            trend: pace.map((n) => n.roomsSold),
          },
          {
            label: "ADR",
            value: money.format(now.adr),
            delta: delta(now.adr, prev?.adr),
            caption: "Average daily rate",
            icon: <DollarSign />,
          },
          {
            label: "RevPAR",
            value: money.format(now.revpar),
            delta: delta(now.revpar, prev?.revpar),
            caption: "Revenue per available room",
            icon: <BedDouble />,
          },
          {
            label: "Arrivals",
            value: `${arrivals.filter((a) => a.done).length}/${arrivals.length}`,
            caption: "Checked in today",
            icon: <LogIn />,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-crm border border-crm-border bg-crm-card p-3 shadow-crm-raised">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="crm-eyebrow text-crm-soft">Occupancy pace</h3>
            <span className="text-xs tabular-nums" aria-live="polite">
              {dayFmt.format(Date.parse(`${shown.date}T00:00:00Z`))} ·{" "}
              {pct(shown.roomsSold, totalRooms).toFixed(0)}% · {money.format(shown.revenue / 100)}
            </span>
          </div>
          <div
            role="list"
            aria-label="Nightly occupancy"
            className="flex h-40 items-end gap-1"
            onMouseLeave={() => setHover(null)}
          >
            {pace.map((n, i) => {
              const o = pct(n.roomsSold, totalRooms);
              const isToday = n.date === today;
              const future = n.date > today;
              return (
                <div
                  key={n.date}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${n.date}: ${o.toFixed(0)}% occupancy`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="flex h-full flex-1 flex-col justify-end gap-1 outline-none"
                >
                  <div
                    className={cn(
                      "w-full rounded-t-sm transition-colors",
                      isToday
                        ? "bg-crm-primary"
                        : future
                          ? o > 95
                            ? "bg-crm-warning/70"
                            : "bg-crm-primary/35"
                          : "bg-crm-subtle",
                      hover === i && "ring-2 ring-crm-ring/60",
                    )}
                    style={{ height: `${Math.max(2, o)}%` }}
                  />
                  <span className="crm-caption text-center text-crm-soft">
                    {dayFmt
                      .format(Date.parse(`${n.date}T00:00:00Z`))
                      .split(" ")[0]!
                      .slice(0, 2)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="crm-caption mt-2 text-crm-soft">
            Solid = actual, light = on-the-books forecast, amber = compression night (raise rates).
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-3 shadow-crm-raised">
          <h3 className="crm-eyebrow text-crm-soft">Inventory tonight</h3>
          {roomTypes.map((t) => {
            const avail = t.total - t.sold - (t.outOfOrder ?? 0);
            return (
              <Progress
                key={t.name}
                size="sm"
                label={`${t.name} · ${avail} left${t.outOfOrder ? ` · ${t.outOfOrder} OOO` : ""}`}
                value={t.sold}
                max={t.total}
                tone={avail <= 0 ? "danger" : avail <= 2 ? "warning" : "primary"}
                showValue
              />
            );
          })}
          <h3 className="crm-eyebrow mt-1 text-crm-soft">Channel mix</h3>
          <div className="flex h-2 overflow-hidden rounded-full bg-crm-track">
            {channels.map((c, i) => (
              <span
                key={c.name}
                title={`${c.name}: ${pct(c.roomNights, channelTotal).toFixed(0)}%`}
                className={cn(
                  "h-full",
                  [
                    "bg-crm-primary",
                    "bg-crm-success",
                    "bg-crm-warning",
                    "bg-crm-danger",
                    "bg-crm-subtle",
                  ][i % 5],
                )}
                style={{ width: `${pct(c.roomNights, channelTotal)}%` }}
              />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-1 text-xs text-crm-soft tabular-nums">
            {channels.map((c) => (
              <li key={c.name} className="flex justify-between gap-2">
                <span>{c.name}</span>
                <span className="text-crm-fg">{pct(c.roomNights, channelTotal).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-crm border border-crm-border bg-crm-card p-3 shadow-crm-raised">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="crm-eyebrow text-crm-soft">Front desk today</h3>
          <SegmentedControl
            label="Movement type"
            size="sm"
            value={tab}
            onValueChange={(v) => setTab(v as typeof tab)}
            options={[
              { value: "arrival", label: "Arrivals", count: arrivals.length },
              {
                value: "departure",
                label: "Departures",
                count: movements.length - arrivals.length,
              },
            ]}
          />
        </div>
        <ul className="divide-y divide-crm-border text-xs">
          {movements.filter((m) => m.kind === tab).length === 0 && (
            <li className="py-6 text-center text-crm-soft">Nothing scheduled.</li>
          )}
          {movements
            .filter((m) => m.kind === tab)
            .sort(
              (a, b) =>
                Number(!!a.done) - Number(!!b.done) || (a.eta ?? "").localeCompare(b.eta ?? ""),
            )
            .map((m) => (
              <li key={m.id} className={cn("flex items-center gap-2 py-2", m.done && "opacity-60")}>
                <span className="w-12 text-crm-soft tabular-nums">{m.eta ?? "—"}</span>
                <span className="flex-1 truncate font-medium">{m.guest}</span>
                {m.vip && (
                  <Tag size="sm" color="amber">
                    VIP
                  </Tag>
                )}
                <span className={cn("w-16 text-right tabular-nums", !m.room && "text-crm-warning")}>
                  {m.room ?? "No room"}
                </span>
                <Tag size="sm" color={m.done ? "green" : "neutral"}>
                  {m.done ? (tab === "arrival" ? "In" : "Out") : "Pending"}
                </Tag>
              </li>
            ))}
        </ul>
      </div>
    </section>
  );
}
