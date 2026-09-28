import * as React from "react";
import { CalendarClock, Megaphone, TrendingDown, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/crm/progress";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag, type TagColor } from "@/components/crm/tag";

export type CampaignChannel = "online" | "event" | "mail" | "peer_to_peer" | "major_gift";

export interface Campaign {
  id: string;
  name: string;
  fund: string;
  goal: number;
  /** ISO dates. */
  start: string;
  end: string;
  /** Raised amount by channel. */
  raisedBy: Partial<Record<CampaignChannel, number>>;
  donors: number;
  /** Money spent running the campaign. */
  expenses: number;
  /** Optional matching-gift pledge applied up to this cap. */
  matchCap?: number;
}

export interface NpCampaignsProps {
  campaigns: Campaign[];
  now?: Date;
  currency?: string;
  locale?: string;
  onSelect?: (campaign: Campaign) => void;
  className?: string;
}

const channelLabel: Record<CampaignChannel, string> = {
  online: "Online",
  event: "Events",
  mail: "Direct mail",
  peer_to_peer: "Peer-to-peer",
  major_gift: "Major gifts",
};
const channelColor: Record<CampaignChannel, string> = {
  online: "bg-crm-primary",
  event: "bg-crm-success",
  mail: "bg-crm-warning",
  peer_to_peer: "bg-crm-danger",
  major_gift: "bg-crm-soft",
};

const DAY = 86_400_000;
type Phase = "upcoming" | "live" | "ended";

/** Campaign pacing: raised vs goal, straight-line projection and cost-per-dollar. */
export function campaignPace(c: Campaign, now: Date) {
  const s = new Date(c.start).getTime();
  const e = new Date(c.end).getTime();
  const t = now.getTime();
  const raised = Object.values(c.raisedBy).reduce<number>((a, b) => a + (b ?? 0), 0);
  const match = Math.min(c.matchCap ?? 0, raised);
  const total = raised + match;
  const phase: Phase = t < s ? "upcoming" : t > e ? "ended" : "live";
  const elapsed = Math.min(1, Math.max(0, (t - s) / Math.max(1, e - s)));
  const projected = phase === "live" && elapsed > 0.05 ? total / elapsed : total;
  return {
    raised,
    match,
    total,
    phase,
    elapsed,
    daysLeft: Math.max(0, Math.ceil((e - t) / DAY)),
    projected,
    onTrack: projected >= c.goal,
    costPerDollar: total ? c.expenses / total : 0,
    avgGift: c.donors ? raised / c.donors : 0,
  };
}

const phaseTag: Record<Phase, { label: string; color: TagColor }> = {
  upcoming: { label: "Upcoming", color: "neutral" },
  live: { label: "Live", color: "green" },
  ended: { label: "Ended", color: "blue" },
};

/** Fundraising campaign board with goal progress, pace projection, match tracking and channel mix. */
export function NpCampaigns({
  campaigns,
  now,
  currency = "USD",
  locale = "en-US",
  onSelect,
  className,
}: NpCampaignsProps) {
  const ref = React.useMemo(() => now ?? new Date(), [now]);
  const [phase, setPhase] = React.useState<"all" | Phase>("live");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const money = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }),
    [locale, currency],
  );
  const compact = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency, notation: "compact" }),
    [locale, currency],
  );

  const all = campaigns.map((c) => ({ c, p: campaignPace(c, ref) }));
  const counts: Record<string, number> = { all: all.length };
  for (const { p } of all) counts[p.phase] = (counts[p.phase] ?? 0) + 1;
  const list = all.filter(({ p }) => phase === "all" || p.phase === phase);
  const selected = all.find(({ c }) => c.id === selectedId) ?? list[0] ?? null;

  return (
    <section aria-label="Campaigns" className={cn("flex flex-col gap-3 font-crm", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="crm-eyebrow">Campaigns</span>
          <span className="text-xs text-crm-subtle">
            {compact.format(all.reduce((s, { p }) => s + p.total, 0))} raised of{" "}
            {compact.format(all.reduce((s, { c }) => s + c.goal, 0))} across {all.length} campaigns
          </span>
        </div>
        <SegmentedControl
          size="sm"
          label="Campaign phase"
          value={phase}
          onValueChange={(v) => setPhase(v as "all" | Phase)}
          options={[
            { value: "live", label: "Live", count: counts.live ?? 0 },
            { value: "upcoming", label: "Upcoming", count: counts.upcoming ?? 0 },
            { value: "ended", label: "Ended", count: counts.ended ?? 0 },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
      </header>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-crm border border-dashed border-crm-border py-10 text-center">
          <Megaphone className="size-5 text-crm-subtle" aria-hidden />
          <p className="text-xs text-crm-subtle">No campaigns in this phase.</p>
        </div>
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <ul className="grid content-start gap-2 sm:grid-cols-2" aria-label="Campaign list">
            {list.map(({ c, p }) => {
              const active = selected?.c.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSelectedId(c.id);
                      onSelect?.(c);
                    }}
                    className={cn(
                      "flex h-full w-full flex-col gap-2 rounded-crm border bg-crm-card p-3 text-left shadow-crm-raised outline-none focus-visible:ring-2 focus-visible:ring-crm-primary",
                      active ? "border-crm-primary/60" : "border-crm-border hover:bg-crm-raised",
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-crm-fg">{c.name}</span>
                        <span className="text-xs text-crm-subtle">{c.fund}</span>
                      </span>
                      <Tag size="sm" color={phaseTag[p.phase].color}>
                        {phaseTag[p.phase].label}
                      </Tag>
                    </span>
                    <Progress
                      value={p.total}
                      max={c.goal}
                      size="sm"
                      tone={p.total >= c.goal ? "success" : p.onTrack ? "primary" : "warning"}
                      label={`${money.format(p.total)} of ${money.format(c.goal)}`}
                      showValue
                    />
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-crm-soft">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" aria-hidden />
                        {c.donors.toLocaleString(locale)}
                      </span>
                      {p.phase === "live" ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="size-3" aria-hidden />
                          {p.daysLeft}d left
                        </span>
                      ) : null}
                      {p.phase === "live" ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            p.onTrack ? "text-crm-success" : "text-crm-warning",
                          )}
                        >
                          {p.onTrack ? (
                            <TrendingUp className="size-3" aria-hidden />
                          ) : (
                            <TrendingDown className="size-3" aria-hidden />
                          )}
                          {p.onTrack ? "On pace" : "Behind pace"}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected ? (
            <article
              aria-label={`${selected.c.name} detail`}
              className="flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-crm-fg">{selected.c.name}</span>
                <span className="text-xs text-crm-subtle">
                  {selected.c.start} → {selected.c.end} · {Math.round(selected.p.elapsed * 100)}% of
                  time elapsed
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <Stat label="Projected finish" value={money.format(selected.p.projected)}>
                  <span className={selected.p.onTrack ? "text-crm-success" : "text-crm-warning"}>
                    {selected.p.projected >= selected.c.goal
                      ? `+${money.format(selected.p.projected - selected.c.goal)} over goal`
                      : `${money.format(selected.c.goal - selected.p.projected)} short`}
                  </span>
                </Stat>
                <Stat
                  label="Needed per day"
                  value={
                    selected.p.daysLeft > 0
                      ? money.format(
                          Math.max(0, selected.c.goal - selected.p.total) / selected.p.daysLeft,
                        )
                      : "—"
                  }
                />
                <Stat label="Average gift" value={money.format(selected.p.avgGift)} />
                <Stat label="Cost per $1 raised" value={`$${selected.p.costPerDollar.toFixed(2)}`}>
                  <span
                    className={
                      selected.p.costPerDollar > 0.25 ? "text-crm-danger" : "text-crm-subtle"
                    }
                  >
                    {selected.p.costPerDollar > 0.25 ? "above $0.25 benchmark" : "healthy"}
                  </span>
                </Stat>
              </dl>
              {selected.c.matchCap ? (
                <Progress
                  value={selected.p.match}
                  max={selected.c.matchCap}
                  size="sm"
                  tone="success"
                  label={`Matching gift unlocked: ${money.format(selected.p.match)} of ${money.format(selected.c.matchCap)}`}
                />
              ) : null}
              <div className="flex flex-col gap-2">
                <span className="crm-caption text-crm-soft">Raised by channel</span>
                <div
                  className="flex h-2.5 overflow-hidden rounded-full bg-crm-muted"
                  role="img"
                  aria-label="Channel share of raised amount"
                >
                  {(Object.keys(channelLabel) as CampaignChannel[]).map((ch) => (
                    <span
                      key={ch}
                      className={channelColor[ch]}
                      style={{
                        width: `${selected.p.raised ? ((selected.c.raisedBy[ch] ?? 0) / selected.p.raised) * 100 : 0}%`,
                      }}
                    />
                  ))}
                </div>
                <ul className="grid grid-cols-2 gap-1 text-xs">
                  {(Object.keys(channelLabel) as CampaignChannel[])
                    .filter((ch) => (selected.c.raisedBy[ch] ?? 0) > 0)
                    .map((ch) => (
                      <li key={ch} className="flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-full", channelColor[ch])} aria-hidden />
                        <span className="flex-1 text-crm-soft">{channelLabel[ch]}</span>
                        <span className="text-crm-fg tabular-nums">
                          {money.format(selected.c.raisedBy[ch] ?? 0)}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-crm bg-crm-raised p-2">
      <dt className="text-crm-subtle">{label}</dt>
      <dd className="text-sm text-crm-fg tabular-nums">{value}</dd>
      {children ? <dd>{children}</dd> : null}
    </div>
  );
}
