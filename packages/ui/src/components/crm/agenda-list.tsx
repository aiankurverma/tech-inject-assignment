import * as React from "react";
import { MapPin, Phone, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarGroup } from "@/components/crm/avatar-group";

export interface AgendaMeeting {
  id: string;
  title: string;
  start: Date | string;
  end: Date | string;
  kind?: "video" | "call" | "in-person";
  /** Join link or address. */
  location?: string;
  /** Related account / deal, shown as a caption. */
  related?: string;
  attendees?: { name: string; avatar?: string }[];
  status?: "confirmed" | "tentative" | "cancelled";
}

export interface AgendaListProps {
  meetings: AgendaMeeting[];
  /** Defaults to now; used for Today/Tomorrow labels, "in 12 min" and the live indicator. */
  now?: Date;
  /** Hide meetings that ended before `now`. */
  hidePast?: boolean;
  /** Minutes before start when the Join button activates. */
  joinWindow?: number;
  onJoin?: (m: AgendaMeeting) => void;
  onSelect?: (m: AgendaMeeting) => void;
  loading?: boolean;
  locale?: string;
  emptyText?: string;
  className?: string;
}

const toDate = (d: Date | string) => (d instanceof Date ? d : new Date(d));
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const icons = { video: Video, call: Phone, "in-person": MapPin } as const;

/**
 * Upcoming meetings grouped by day with Today/Tomorrow headings, a live "Now" state, countdown for
 * the next meeting, overlap (double-booking) warnings and a Join button that activates shortly
 * before start.
 */
export function AgendaList({
  meetings,
  now: nowProp,
  hidePast = true,
  joinWindow = 10,
  onJoin,
  onSelect,
  loading,
  locale,
  emptyText = "Nothing scheduled. Enjoy the focus time.",
  className,
}: AgendaListProps) {
  const [tick, setTick] = React.useState(() => new Date());
  React.useEffect(() => {
    if (nowProp) return;
    const id = window.setInterval(() => setTick(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, [nowProp]);
  const now = nowProp ?? tick;
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  const dayFmt = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const sorted = meetings
    .map((m) => ({ m, s: toDate(m.start), e: toDate(m.end) }))
    .filter((x) => !hidePast || x.e > now)
    .sort((a, b) => a.s.getTime() - b.s.getTime());

  const overlaps = new Set<string>();
  const active = sorted.filter((x) => x.m.status !== "cancelled");
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a && b && b.s < a.e) {
        overlaps.add(a.m.id);
        overlaps.add(b.m.id);
      }
    }

  const nextId = active.find((x) => x.s > now)?.m.id;
  const groups: { key: string; date: Date; items: typeof sorted }[] = [];
  for (const x of sorted) {
    const k = dayKey(x.s);
    const g = groups.find((y) => y.key === k);
    if (g) g.items.push(x);
    else groups.push({ key: k, date: x.s, items: [x] });
  }
  const heading = (d: Date) => {
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round(
      (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - t.getTime()) / 86_400_000,
    );
    return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : dayFmt.format(d);
  };

  if (loading)
    return (
      <div className={cn("flex animate-pulse flex-col gap-2 font-crm", className)} aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-14 rounded-crm bg-crm-muted" />
        ))}
      </div>
    );

  if (groups.length === 0)
    return (
      <p className={cn("py-8 text-center font-crm text-sm text-crm-muted-fg", className)}>
        {emptyText}
      </p>
    );

  return (
    <div className={cn("flex flex-col gap-4 font-crm", className)}>
      {groups.map((g) => (
        <section key={g.key} aria-label={heading(g.date)}>
          <h3 className="crm-eyebrow mb-1.5 text-[11px] text-crm-muted-fg uppercase">
            {heading(g.date)}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {g.items.map(({ m, s, e }) => {
              const live = s <= now && e > now && m.status !== "cancelled";
              const mins = Math.round((s.getTime() - now.getTime()) / 60_000);
              const canJoin =
                m.kind === "video" &&
                m.status !== "cancelled" &&
                (live || (mins >= 0 && mins <= joinWindow));
              const Icon = icons[m.kind ?? "video"];
              const cancelled = m.status === "cancelled";
              return (
                <li
                  key={m.id}
                  className={cn(
                    "flex items-center gap-3 rounded-crm border border-crm-border bg-crm-card px-3 py-2",
                    live && "border-crm-success/50",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-9 w-1 shrink-0 rounded-full",
                      cancelled
                        ? "bg-crm-faint"
                        : m.status === "tentative"
                          ? "bg-crm-warning"
                          : live
                            ? "bg-crm-success"
                            : "bg-crm-primary",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => onSelect?.(m)}
                    className="min-w-0 flex-1 cursor-pointer rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                  >
                    <span
                      className={cn(
                        "block truncate text-sm text-crm-fg",
                        cancelled && "text-crm-muted-fg line-through",
                      )}
                    >
                      {m.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-crm-muted-fg">
                      <span className="tabular-nums">
                        {time.format(s)} – {time.format(e)}
                      </span>
                      <Icon className="size-3" aria-label={m.kind ?? "video"} />
                      {m.related ? <span className="truncate">{m.related}</span> : null}
                      {m.status === "tentative" ? (
                        <span className="text-crm-warning">Tentative</span>
                      ) : null}
                      {overlaps.has(m.id) ? (
                        <span className="text-crm-danger">Overlaps</span>
                      ) : null}
                    </span>
                  </button>
                  {m.attendees?.length ? (
                    <AvatarGroup
                      people={m.attendees.map((a) => ({ name: a.name, src: a.avatar }))}
                      max={3}
                      size="md"
                      className="hidden shrink-0 sm:flex"
                    />
                  ) : null}
                  <span className="w-16 shrink-0 text-right text-[11px]">
                    {live ? (
                      <span className="font-medium text-crm-success">Now</span>
                    ) : m.id === nextId && mins < 60 ? (
                      <span className="text-crm-soft">
                        {mins < 1 ? "starting" : `in ${mins} min`}
                      </span>
                    ) : null}
                  </span>
                  {m.kind === "video" ? (
                    <button
                      type="button"
                      disabled={!canJoin}
                      onClick={() => onJoin?.(m)}
                      aria-label={`Join ${m.title}`}
                      className="h-7 shrink-0 cursor-pointer rounded-full bg-crm-primary px-2.5 text-xs text-crm-primary-fg shadow-crm-primary outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60 disabled:cursor-default disabled:bg-crm-muted disabled:text-crm-muted-fg disabled:shadow-none"
                    >
                      Join
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
