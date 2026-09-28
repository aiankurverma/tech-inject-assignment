import * as React from "react";
import { ArrowDown, ArrowUp, Mail, Phone, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { SegmentedControl } from "@/components/crm/segmented-control";

export type ActivityType = "call" | "email" | "meeting";

export interface ActivityRecord {
  /** ISO date (yyyy-mm-dd). */
  date: string;
  repId: string;
  type: ActivityType;
  count: number;
}

export interface ActivityRep {
  id: string;
  name: string;
  avatar?: string;
  /** Weekly targets per activity type. */
  weeklyTarget?: Partial<Record<ActivityType, number>>;
}

export interface ActivityDashboardProps {
  records: ActivityRecord[];
  reps: ActivityRep[];
  /** "Today" for range maths; defaults to the latest record date. */
  asOf?: string;
  range?: 7 | 14 | 30;
  defaultRange?: 7 | 14 | 30;
  onRangeChange?: (range: 7 | 14 | 30) => void;
  onRepSelect?: (repId: string) => void;
  className?: string;
}

const TYPES: { key: ActivityType; label: string; icon: React.ReactNode; cls: string }[] = [
  { key: "call", label: "Calls", icon: <Phone />, cls: "bg-crm-primary" },
  { key: "email", label: "Emails", icon: <Mail />, cls: "bg-crm-success" },
  { key: "meeting", label: "Meetings", icon: <Users />, cls: "bg-crm-warning" },
];

const DAY = 86_400_000;
const toDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY);
const fromDay = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);

/**
 * Rep activity dashboard: calls/emails/meetings KPIs with period-over-period deltas,
 * a stacked daily volume chart and a sortable leaderboard scored against weekly targets.
 */
export function ActivityDashboard({
  records,
  reps,
  asOf,
  range,
  defaultRange = 14,
  onRangeChange,
  onRepSelect,
  className,
}: ActivityDashboardProps) {
  const [innerRange, setInnerRange] = React.useState(defaultRange);
  const r = range ?? innerRange;
  const [hidden, setHidden] = React.useState<Set<ActivityType>>(new Set());
  const [sortKey, setSortKey] = React.useState<ActivityType | "total" | "attainment">("total");
  const [desc, setDesc] = React.useState(true);
  const [hover, setHover] = React.useState<number | null>(null);

  const end = React.useMemo(
    () => (asOf ? toDay(asOf) : Math.max(0, ...records.map((x) => toDay(x.date)))),
    [asOf, records],
  );
  const start = end - r + 1;
  const prevStart = start - r;

  const data = React.useMemo(() => {
    const days = Array.from({ length: r }, (_, i) => ({
      day: start + i,
      call: 0,
      email: 0,
      meeting: 0,
    }));
    const cur: Record<ActivityType, number> = { call: 0, email: 0, meeting: 0 };
    const prev: Record<ActivityType, number> = { call: 0, email: 0, meeting: 0 };
    const byRep = new Map<string, Record<ActivityType, number>>();
    for (const rec of records) {
      const d = toDay(rec.date);
      if (d >= start && d <= end) {
        cur[rec.type] += rec.count;
        const slot = days[d - start];
        if (slot) slot[rec.type] += rec.count;
        const row = byRep.get(rec.repId) ?? { call: 0, email: 0, meeting: 0 };
        row[rec.type] += rec.count;
        byRep.set(rec.repId, row);
      } else if (d >= prevStart && d < start) prev[rec.type] += rec.count;
    }
    return { days, cur, prev, byRep };
  }, [records, start, end, prevStart, r]);

  const visible = TYPES.filter((t) => !hidden.has(t.key));
  const dayTotal = (d: (typeof data.days)[number]) => visible.reduce((s, t) => s + d[t.key], 0);
  const peak = Math.max(1, ...data.days.map(dayTotal));
  const weeks = r / 7;

  const board = React.useMemo(() => {
    const rows = reps.map((rep) => {
      const c = data.byRep.get(rep.id) ?? { call: 0, email: 0, meeting: 0 };
      const total = c.call + c.email + c.meeting;
      const targets = TYPES.map((t) => (rep.weeklyTarget?.[t.key] ?? 0) * weeks);
      const tSum = targets.reduce((a, b) => a + b, 0);
      // Attainment caps each type at 100% so over-emailing can't hide missed calls.
      const attainment = tSum
        ? TYPES.reduce((s, t, i) => s + Math.min(c[t.key], targets[i] ?? 0), 0) / tSum
        : 0;
      return { rep, ...c, total, attainment };
    });
    rows.sort((a, b) => (desc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
    return rows;
  }, [reps, data.byRep, weeks, sortKey, desc]);

  const delta = (k: ActivityType) =>
    data.prev[k] ? ((data.cur[k] - data.prev[k]) / data.prev[k]) * 100 : undefined;

  const toggle = (k: ActivityType) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(k)) n.delete(k);
      else if (n.size < TYPES.length - 1) n.add(k);
      return n;
    });

  const sortBy = (k: typeof sortKey) => {
    if (k === sortKey) setDesc((d) => !d);
    else {
      setSortKey(k);
      setDesc(true);
    }
  };

  const fmtDay = (d: number) =>
    new Date(d * DAY).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  return (
    <section
      aria-label="Activity dashboard"
      className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="crm-eyebrow text-crm-subtle">Activity</p>
          <h2 className="text-lg font-semibold tracking-tight">
            {fmtDay(start)} – {fmtDay(end)}
          </h2>
        </div>
        <SegmentedControl
          label="Date range"
          size="sm"
          value={String(r)}
          onValueChange={(v) => {
            const n = Number(v) as 7 | 14 | 30;
            if (range === undefined) setInnerRange(n);
            onRangeChange?.(n);
          }}
          options={[
            { value: "7", label: "7d" },
            { value: "14", label: "14d" },
            { value: "30", label: "30d" },
          ]}
        />
      </header>

      <KpiGrid
        columns={3}
        items={TYPES.map((t) => ({
          label: t.label,
          icon: t.icon,
          value: data.cur[t.key].toLocaleString("en-US"),
          delta: delta(t.key),
          caption: `vs prior ${r}d`,
          trend: data.days.map((d) => d[t.key]),
        }))}
      />

      <div className="rounded-crm border border-crm-border bg-crm-card p-4 shadow-crm-raised">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Daily volume</h3>
          <div className="flex gap-1" role="group" aria-label="Series">
            {TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={!hidden.has(t.key)}
                onClick={() => toggle(t.key)}
                className="inline-flex h-6 items-center gap-1.5 rounded-full border border-crm-border px-2 text-xs text-crm-soft aria-[pressed=false]:opacity-45 focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
              >
                <span className={cn("size-2 rounded-sm", t.cls)} aria-hidden />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {records.length === 0 ? (
          <p className="py-10 text-center text-sm text-crm-subtle">
            No activity logged yet. Connect email and dialer to start tracking.
          </p>
        ) : (
          <div className="relative">
            <div
              className="flex h-40 items-end gap-[3px]"
              role="list"
              aria-label="Activities per day"
              onMouseLeave={() => setHover(null)}
            >
              {data.days.map((d, i) => {
                const tot = dayTotal(d);
                const weekend = [0, 6].includes(new Date(d.day * DAY).getUTCDay());
                return (
                  <div
                    key={d.day}
                    role="listitem"
                    tabIndex={0}
                    aria-label={`${fmtDay(d.day)}: ${visible.map((t) => `${d[t.key]} ${t.label.toLowerCase()}`).join(", ")}`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className={cn(
                      "flex h-full flex-1 flex-col-reverse rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
                      weekend && "bg-crm-muted/40",
                      hover === i && "bg-crm-muted",
                    )}
                  >
                    {visible.map((t) => (
                      <span
                        key={t.key}
                        className={cn("w-full first:rounded-b-sm last:rounded-t-sm", t.cls)}
                        style={{ height: `${(d[t.key] / peak) * 100}%` }}
                      />
                    ))}
                    <span className="sr-only">{tot}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-crm-faint">
              <span>{fmtDay(start)}</span>
              <span>{fmtDay(end)}</span>
            </div>
            {hover !== null && data.days[hover] ? (
              <div
                className="pointer-events-none absolute top-0 rounded-crm border border-crm-border bg-crm-popover px-2.5 py-1.5 text-xs shadow-crm-raised"
                style={{
                  left: `${Math.min(80, (hover / data.days.length) * 100)}%`,
                }}
                aria-hidden
              >
                <p className="font-medium">{fromDay(data.days[hover].day)}</p>
                {visible.map((t) => (
                  <p key={t.key} className="text-crm-soft tabular-nums">
                    {t.label}: {data.days[hover]?.[t.key]}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-crm border border-crm-border bg-crm-card shadow-crm-raised">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="px-4 pt-3 text-left text-sm font-medium">Leaderboard</caption>
          <thead>
            <tr className="border-b border-crm-border">
              <th
                scope="col"
                className="crm-caption h-9 px-4 text-left font-normal text-crm-subtle"
              >
                Rep
              </th>
              {(
                [
                  ...TYPES.map((t) => [t.key, t.label] as const),
                  ["total", "Total"] as const,
                  ["attainment", "vs target"] as const,
                ] as const
              ).map(([k, label]) => (
                <th
                  key={k}
                  scope="col"
                  aria-sort={sortKey === k ? (desc ? "descending" : "ascending") : "none"}
                  className="crm-caption h-9 px-3 text-right font-normal text-crm-subtle"
                >
                  <button
                    type="button"
                    onClick={() => sortBy(k)}
                    className="inline-flex items-center gap-1 rounded-sm hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring focus-visible:outline-none"
                  >
                    {label}
                    {sortKey === k ? (
                      desc ? (
                        <ArrowDown className="size-3" aria-hidden />
                      ) : (
                        <ArrowUp className="size-3" aria-hidden />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.map((row, i) => (
              <tr
                key={row.rep.id}
                onClick={() => onRepSelect?.(row.rep.id)}
                className={cn(
                  "border-b border-crm-border last:border-0 hover:bg-crm-muted/40",
                  onRepSelect && "cursor-pointer",
                )}
              >
                <td className="h-11 px-4">
                  <span className="flex items-center gap-2">
                    <span className="w-4 text-xs text-crm-faint tabular-nums">{i + 1}</span>
                    <Avatar name={row.rep.name} src={row.rep.avatar} />
                    {row.rep.name}
                  </span>
                </td>
                {TYPES.map((t) => (
                  <td key={t.key} className="px-3 text-right tabular-nums">
                    {row[t.key]}
                  </td>
                ))}
                <td className="px-3 text-right font-medium tabular-nums">{row.total}</td>
                <td className="px-3">
                  <span className="flex items-center justify-end gap-2">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-crm-muted">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          row.attainment >= 1
                            ? "bg-crm-success"
                            : row.attainment >= 0.7
                              ? "bg-crm-warning"
                              : "bg-crm-danger",
                        )}
                        style={{ width: `${Math.min(100, row.attainment * 100)}%` }}
                      />
                    </span>
                    <span className="w-9 text-right text-xs tabular-nums">
                      {Math.round(row.attainment * 100)}%
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
