import * as React from "react";
import { ArrowDown, ArrowUp, Minus, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";

export interface LeaderboardRep {
  id: string;
  name: string;
  avatar?: string;
  team?: string;
  /** Closed-won amount in the period. */
  revenue: number;
  /** Target for the period; enables attainment %. */
  quota?: number;
  deals: number;
  /** Rank in the previous period, for movement arrows. */
  previousRank?: number;
}

export type LeaderboardMetric = "revenue" | "attainment" | "deals";

export interface LeaderboardProps {
  reps: LeaderboardRep[];
  metric?: LeaderboardMetric;
  defaultMetric?: LeaderboardMetric;
  onMetricChange?: (m: LeaderboardMetric) => void;
  currency?: string;
  locale?: string;
  /** Highlight this rep (e.g. the viewer) and pin them below the cut if outside `limit`. */
  currentUserId?: string;
  limit?: number;
  loading?: boolean;
  onSelect?: (rep: LeaderboardRep) => void;
  className?: string;
}

const METRICS: { id: LeaderboardMetric; label: string }[] = [
  { id: "revenue", label: "Revenue" },
  { id: "attainment", label: "Attainment" },
  { id: "deals", label: "Deals" },
];

const attainment = (r: LeaderboardRep) => (r.quota ? r.revenue / r.quota : 0);
const scoreFor = (m: LeaderboardMetric, r: LeaderboardRep) =>
  m === "revenue" ? r.revenue : m === "deals" ? r.deals : attainment(r);

/**
 * Ranked sales reps by revenue, quota attainment or deal count with medal ranks, rank movement
 * vs last period, a relative bar and a pinned row for the current user when they fall outside
 * the visible top N.
 */
export function Leaderboard({
  reps,
  metric: metricProp,
  defaultMetric = "revenue",
  onMetricChange,
  currency = "USD",
  locale,
  currentUserId,
  limit = 5,
  loading,
  onSelect,
  className,
}: LeaderboardProps) {
  const [inner, setInner] = React.useState(defaultMetric);
  const metric = metricProp ?? inner;
  const setMetric = (m: LeaderboardMetric) => {
    if (metricProp === undefined) setInner(m);
    onMetricChange?.(m);
  };
  const money = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [currency, locale],
  );
  const score = (r: LeaderboardRep) => scoreFor(metric, r);
  const ranked = React.useMemo(
    () =>
      [...reps]
        .sort(
          (a, b) =>
            scoreFor(metric, b) - scoreFor(metric, a) ||
            b.revenue - a.revenue ||
            a.name.localeCompare(b.name),
        )
        .map((r, i) => ({ rep: r, rank: i + 1 })),
    [reps, metric],
  );
  const top = ranked.slice(0, limit);
  const me = currentUserId ? ranked.find((x) => x.rep.id === currentUserId) : undefined;
  const pinned = me && me.rank > limit ? me : undefined;
  const best = Math.max(1e-9, ...ranked.map((x) => score(x.rep)));
  const display = (r: LeaderboardRep) =>
    metric === "revenue"
      ? money.format(r.revenue)
      : metric === "deals"
        ? `${r.deals} deals`
        : r.quota
          ? `${Math.round(attainment(r) * 100)}%`
          : "No quota";

  const row = ({ rep, rank }: { rep: LeaderboardRep; rank: number }) => {
    const moved =
      rep.previousRank !== undefined && metric === "revenue" ? rep.previousRank - rank : 0;
    const isMe = rep.id === currentUserId;
    return (
      <li key={rep.id}>
        <button
          type="button"
          onClick={() => onSelect?.(rep)}
          aria-label={`Rank ${rank}, ${rep.name}, ${display(rep)}`}
          className={cn(
            "grid w-full cursor-pointer grid-cols-[28px_1fr_auto] items-center gap-2.5 rounded-crm px-2 py-2 text-left outline-none",
            "hover:bg-crm-muted/60 focus-visible:ring-2 focus-visible:ring-crm-ring/60",
            isMe && "bg-crm-primary/10",
          )}
        >
          <span
            className={cn(
              "grid size-6 place-items-center rounded-full text-[11px] font-medium tabular-nums",
              rank === 1
                ? "bg-tag-yellow-bg text-tag-yellow-text"
                : rank === 2
                  ? "bg-tag-neutral-bg text-crm-chip"
                  : rank === 3
                    ? "bg-tag-amber-bg text-tag-amber-text"
                    : "text-crm-muted-fg",
            )}
          >
            {rank === 1 ? <Trophy className="size-3" aria-hidden /> : rank}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={rep.name} src={rep.avatar} size="md" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 truncate text-sm text-crm-fg">
                {rep.name}
                {isMe ? <span className="text-[10px] text-crm-soft">(you)</span> : null}
              </span>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-crm-track">
                <span
                  className={cn(
                    "block h-full rounded-full transition-[width] duration-500 ease-crm",
                    metric === "attainment" && attainment(rep) >= 1
                      ? "bg-crm-success"
                      : "bg-crm-primary",
                  )}
                  style={{ width: `${Math.min(100, (score(rep) / best) * 100)}%` }}
                />
              </span>
            </span>
          </span>
          <span className="flex flex-col items-end gap-0.5">
            <span className="text-sm font-medium text-crm-fg tabular-nums">{display(rep)}</span>
            <span className="flex items-center gap-0.5 text-[10px] text-crm-muted-fg">
              {rep.team ? <span className="mr-1 hidden sm:inline">{rep.team}</span> : null}
              {metric === "revenue" && rep.previousRank !== undefined ? (
                moved > 0 ? (
                  <span className="flex items-center text-crm-success">
                    <ArrowUp className="size-3" aria-hidden />
                    {moved}
                  </span>
                ) : moved < 0 ? (
                  <span className="flex items-center text-crm-danger">
                    <ArrowDown className="size-3" aria-hidden />
                    {-moved}
                  </span>
                ) : (
                  <Minus className="size-3" aria-label="No change" />
                )
              ) : null}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <section className={cn("font-crm", className)} aria-label="Leaderboard">
      <div
        role="group"
        aria-label="Rank by"
        className="mb-2 inline-flex rounded-full bg-crm-muted p-0.5"
      >
        {METRICS.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={metric === m.id}
            onClick={() => setMetric(m.id)}
            className={cn(
              "h-6 cursor-pointer rounded-full px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
              metric === m.id
                ? "bg-crm-raised text-crm-fg shadow-crm-raised"
                : "text-crm-muted-fg hover:text-crm-fg",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      {loading ? (
        <ul className="flex animate-pulse flex-col gap-2" aria-busy>
          {Array.from({ length: limit }, (_, i) => (
            <li key={i} className="h-10 rounded-crm bg-crm-muted" />
          ))}
        </ul>
      ) : ranked.length === 0 ? (
        <p className="py-6 text-center text-sm text-crm-muted-fg">
          No closed deals in this period yet.
        </p>
      ) : (
        <ol className="flex flex-col">
          {top.map(row)}
          {pinned ? (
            <>
              <li aria-hidden className="my-1 border-t border-dashed border-crm-border" />
              {row(pinned)}
            </>
          ) : null}
        </ol>
      )}
    </section>
  );
}
