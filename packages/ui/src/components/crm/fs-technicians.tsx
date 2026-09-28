import * as React from "react";
import { ArrowDown, ArrowUp, BadgeCheck, ChevronDown, ShieldAlert, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Progress } from "@/components/crm/progress";
import { SearchInput } from "@/components/crm/search-input";
import { StatusDot, type PresenceStatus } from "@/components/crm/status-dot";
import { Tag } from "@/components/crm/tag";

export interface TechCertification {
  name: string;
  /** ISO expiry date. */
  expires: string;
}

export interface FieldTechnician {
  id: string;
  name: string;
  region: string;
  status: PresenceStatus;
  skills: string[];
  certifications: TechCertification[];
  /** Booked vs available minutes today. */
  bookedMin: number;
  capacityMin: number;
  jobsCompleted30d: number;
  /** Jobs fixed on the first visit in the last 30 days. */
  firstTimeFixes30d: number;
  /** Average customer rating (1–5). */
  rating: number;
  callbacks30d: number;
}

export interface FsTechniciansProps {
  technicians: FieldTechnician[];
  now?: Date;
  /** Days before expiry to flag certifications. */
  expiryWarnDays?: number;
  onSelect?: (tech: FieldTechnician) => void;
  className?: string;
}

type SortKey = "name" | "utilization" | "ftf" | "rating";
const DAY = 86_400_000;

const ftf = (t: FieldTechnician) =>
  t.jobsCompleted30d ? (t.firstTimeFixes30d / t.jobsCompleted30d) * 100 : 0;
const util = (t: FieldTechnician) => (t.capacityMin ? (t.bookedMin / t.capacityMin) * 100 : 0);

/** Technician roster with skill filtering, utilization, first-time-fix rate and certification expiry alerts. */
export function FsTechnicians({
  technicians,
  now,
  expiryWarnDays = 30,
  onSelect,
  className,
}: FsTechniciansProps) {
  const today = (now ?? new Date()).getTime();
  const [query, setQuery] = React.useState("");
  const [skills, setSkills] = React.useState<string[]>([]);
  const [sort, setSort] = React.useState<{ key: SortKey; desc: boolean }>({
    key: "utilization",
    desc: false,
  });
  const [open, setOpen] = React.useState<string | null>(null);

  const allSkills = React.useMemo(
    () => [...new Set(technicians.flatMap((t) => t.skills))].sort(),
    [technicians],
  );

  const certState = (c: TechCertification) => {
    const d = Math.ceil((new Date(c.expires).getTime() - today) / DAY);
    return { days: d, expired: d < 0, soon: d >= 0 && d <= expiryWarnDays };
  };

  const rows = technicians
    .filter((t) => skills.every((s) => t.skills.includes(s)))
    .filter((t) => {
      const q = query.trim().toLowerCase();
      return !q || t.name.toLowerCase().includes(q) || t.region.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const v =
        sort.key === "name"
          ? a.name.localeCompare(b.name)
          : sort.key === "utilization"
            ? util(a) - util(b)
            : sort.key === "ftf"
              ? ftf(a) - ftf(b)
              : a.rating - b.rating;
      return sort.desc ? -v : v;
    });

  const alerts = technicians.reduce(
    (n, t) => n + t.certifications.filter((c) => certState(c).expired || certState(c).soon).length,
    0,
  );

  const th = (key: SortKey, label: string, right?: boolean) => (
    <th
      scope="col"
      aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}
      className={cn("py-1.5 font-normal", right && "text-right")}
    >
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : false }))}
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
      aria-label="Technicians"
      className={cn(
        "flex flex-col gap-3 rounded-crm border border-crm-border bg-crm-card p-4 font-crm shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="crm-eyebrow">Technicians</span>
          <span className="text-xs text-crm-subtle">
            {technicians.filter((t) => t.status === "online").length} on shift ·{" "}
            {alerts > 0 ? (
              <span className="text-crm-warning">{alerts} certification alerts</span>
            ) : (
              "all certifications current"
            )}
          </span>
        </div>
        <SearchInput
          size="sm"
          className="w-full sm:w-56"
          placeholder="Name or region"
          aria-label="Search technicians"
          value={query}
          onValueChange={setQuery}
        />
      </header>
      <div role="group" aria-label="Filter by skill" className="flex flex-wrap gap-1.5">
        {allSkills.map((s) => {
          const on = skills.includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => setSkills((x) => (on ? x.filter((y) => y !== s) : [...x, s]))}
              className={cn(
                "h-6 rounded-full border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-crm-primary",
                on
                  ? "border-crm-primary bg-crm-primary/15 text-crm-fg"
                  : "border-crm-border text-crm-soft hover:bg-crm-raised",
              )}
            >
              {s}
            </button>
          );
        })}
        {skills.length > 0 ? (
          <button
            type="button"
            onClick={() => setSkills([])}
            className="h-6 px-1 text-xs text-crm-subtle underline-offset-2 hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-crm border border-dashed border-crm-border py-8 text-center text-xs text-crm-subtle">
          No technician has every selected skill.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-xs">
            <thead>
              <tr className="text-left">
                {th("name", "Technician")}
                {th("utilization", "Today")}
                {th("ftf", "First-time fix", true)}
                {th("rating", "Rating", true)}
                <th scope="col" className="py-1.5 pl-6 font-normal text-crm-subtle">
                  Certs
                </th>
                <th scope="col">
                  <span className="sr-only">Expand</span>
                </th>
              </tr>
            </thead>
            {rows.map((t) => {
              const u = util(t);
              const f = ftf(t);
              const bad = t.certifications.filter((c) => certState(c).expired).length;
              const soon = t.certifications.filter((c) => certState(c).soon).length;
              const expanded = open === t.id;
              return (
                <tbody key={t.id} className="border-t border-crm-border">
                  <tr
                    className="cursor-pointer hover:bg-crm-raised"
                    onClick={() => {
                      setOpen(expanded ? null : t.id);
                      onSelect?.(t);
                    }}
                  >
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={t.name} size="md" />
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1.5 text-sm text-crm-fg">
                            {t.name}
                            <StatusDot status={t.status} />
                          </span>
                          <span className="text-crm-subtle">{t.region}</span>
                        </div>
                      </div>
                    </td>
                    <td className="w-40 py-2 pr-3">
                      <Progress
                        value={u}
                        size="sm"
                        tone={u > 100 ? "danger" : u > 85 ? "warning" : "primary"}
                        label={`${Math.round(t.bookedMin / 60)}h / ${Math.round(t.capacityMin / 60)}h`}
                        showValue
                      />
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right tabular-nums",
                        f < 75 ? "text-crm-danger" : "text-crm-fg",
                      )}
                    >
                      {f.toFixed(0)}%
                      <div className="text-crm-subtle">{t.callbacks30d} callbacks</div>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-crm-fg">
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-3 fill-current text-crm-warning" aria-hidden />
                        {t.rating.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2 pl-6">
                      {bad > 0 ? (
                        <Tag size="sm" color="red">
                          {bad} expired
                        </Tag>
                      ) : soon > 0 ? (
                        <Tag size="sm" color="amber">
                          {soon} expiring
                        </Tag>
                      ) : (
                        <Tag size="sm" color="green">
                          Current
                        </Tag>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Hide" : "Show"} details for ${t.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(expanded ? null : t.id);
                        }}
                        className="rounded-sm p-1 text-crm-subtle outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary"
                      >
                        <ChevronDown
                          className={cn("size-4 transition-transform", expanded && "rotate-180")}
                          aria-hidden
                        />
                      </button>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr>
                      <td colSpan={6} className="pb-3">
                        <div className="grid gap-3 rounded-crm bg-crm-raised p-3 sm:grid-cols-2">
                          <div className="flex flex-col gap-1.5">
                            <span className="crm-caption text-crm-soft">Skills</span>
                            <div className="flex flex-wrap gap-1">
                              {t.skills.map((s) => (
                                <Tag key={s} size="sm" color="blue">
                                  {s}
                                </Tag>
                              ))}
                            </div>
                            <span className="text-crm-subtle">
                              {t.jobsCompleted30d} jobs in the last 30 days
                            </span>
                          </div>
                          <ul className="flex flex-col gap-1">
                            <li className="crm-caption text-crm-soft">Certifications</li>
                            {t.certifications.map((c) => {
                              const st = certState(c);
                              return (
                                <li key={c.name} className="flex items-center gap-1.5">
                                  {st.expired || st.soon ? (
                                    <ShieldAlert
                                      className={cn(
                                        "size-3.5",
                                        st.expired ? "text-crm-danger" : "text-crm-warning",
                                      )}
                                      aria-hidden
                                    />
                                  ) : (
                                    <BadgeCheck className="size-3.5 text-crm-success" aria-hidden />
                                  )}
                                  <span className="flex-1 text-crm-fg">{c.name}</span>
                                  <span
                                    className={cn(
                                      "tabular-nums",
                                      st.expired
                                        ? "text-crm-danger"
                                        : st.soon
                                          ? "text-crm-warning"
                                          : "text-crm-subtle",
                                    )}
                                  >
                                    {st.expired
                                      ? `expired ${-st.days}d ago`
                                      : `${c.expires} (${st.days}d)`}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </section>
  );
}
