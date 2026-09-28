import * as React from "react";
import { Briefcase, Clock, Handshake, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Card, CardBody, CardHeader } from "@/components/crm/card";
import { EmptyState } from "@/components/crm/feedback";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { Progress } from "@/components/crm/progress";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag } from "@/components/crm/tag";

export const ATS_FUNNEL = ["applied", "screen", "interview", "offer", "hired"] as const;
export type AtsFunnelStage = (typeof ATS_FUNNEL)[number];

export interface Requisition {
  id: string;
  title: string;
  department: string;
  recruiter: string;
  /** ISO date the req opened. */
  openedAt: string;
  /** Target days to fill. */
  targetDays: number;
  headcount: number;
  funnel: Record<AtsFunnelStage, number>;
  /** Applicants by source, e.g. { Referral: 12, LinkedIn: 40 }. */
  sources: Record<string, number>;
  offersExtended?: number;
  offersAccepted?: number;
  /** Days from open to hire for each hire so far. */
  daysToHire?: number[];
}

export interface AtsDashboardProps {
  requisitions: Requisition[];
  now?: Date;
  /** Controlled department filter ("all" for every department). */
  department?: string;
  defaultDepartment?: string;
  onDepartmentChange?: (department: string) => void;
  onOpenRequisition?: (req: Requisition) => void;
  className?: string;
}

const stageLabel: Record<AtsFunnelStage, string> = {
  applied: "Applied",
  screen: "Screen",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
};

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const daysBetween = (a: string, b: number) =>
  Math.max(0, Math.floor((b - new Date(a).getTime()) / 86_400_000));

/** Recruiting overview: KPIs, stage conversion funnel, source mix and an SLA-aware open-reqs table. */
export function AtsDashboard({
  requisitions,
  now: nowProp,
  department: deptProp,
  defaultDepartment = "all",
  onDepartmentChange,
  onOpenRequisition,
  className,
}: AtsDashboardProps) {
  const [innerDept, setInnerDept] = React.useState(defaultDepartment);
  const dept = deptProp ?? innerDept;
  const setDept = (d: string) => {
    if (deptProp === undefined) setInnerDept(d);
    onDepartmentChange?.(d);
  };
  const now = (nowProp ?? new Date()).getTime();

  const departments = [...new Set(requisitions.map((r) => r.department))].sort();
  const reqs = dept === "all" ? requisitions : requisitions.filter((r) => r.department === dept);

  const funnel = ATS_FUNNEL.map((s) => ({
    stage: s,
    count: reqs.reduce((sum, r) => sum + r.funnel[s], 0),
  }));
  const hires = funnel[4]!.count;
  const openings = reqs.reduce((s, r) => s + Math.max(0, r.headcount - r.funnel.hired), 0);
  const extended = reqs.reduce((s, r) => s + (r.offersExtended ?? 0), 0);
  const accepted = reqs.reduce((s, r) => s + (r.offersAccepted ?? 0), 0);
  const allDays = reqs.flatMap((r) => r.daysToHire ?? []);
  const tth = allDays.length ? allDays.reduce((a, b) => a + b, 0) / allDays.length : null;

  const sources = new Map<string, number>();
  for (const r of reqs)
    for (const [k, v] of Object.entries(r.sources)) sources.set(k, (sources.get(k) ?? 0) + v);
  const sourceRows = [...sources.entries()].sort((a, b) => b[1] - a[1]);
  const sourceTotal = sourceRows.reduce((s, [, v]) => s + v, 0);

  const open = reqs
    .filter((r) => r.funnel.hired < r.headcount)
    .map((r) => {
      const age = daysBetween(r.openedAt, now);
      return { r, age, ratio: age / r.targetDays };
    })
    .sort((a, b) => b.ratio - a.ratio);

  return (
    <div className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-medium">Recruiting overview</h2>
          <p className="text-xs text-crm-muted-fg">
            {reqs.length} requisitions · {openings} open seats
          </p>
        </div>
        <SegmentedControl
          label="Department"
          size="sm"
          value={dept}
          onValueChange={setDept}
          options={[
            { value: "all", label: "All" },
            ...departments.map((d) => ({ value: d, label: d })),
          ]}
        />
      </div>

      <KpiGrid
        items={[
          {
            label: "Open seats",
            value: openings,
            icon: <Briefcase />,
            caption: `${reqs.length} reqs`,
          },
          {
            label: "Applicants",
            value: funnel[0]!.count.toLocaleString(),
            icon: <UserPlus />,
            caption: `${hires} hired`,
          },
          {
            label: "Avg. time to hire",
            value: tth === null ? "—" : `${Math.round(tth)}d`,
            icon: <Clock />,
            caption: `${allDays.length} hires measured`,
          },
          {
            label: "Offer acceptance",
            value: extended ? `${Math.round(pct(accepted, extended))}%` : "—",
            icon: <Handshake />,
            caption: `${accepted}/${extended} offers`,
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Stage conversion"
            description="Share of the previous stage that advanced"
          />
          <CardBody>
            <ol className="flex flex-col gap-2.5" aria-label="Hiring funnel">
              {funnel.map((f, i) => {
                const prev = i === 0 ? f.count : funnel[i - 1]!.count;
                const conv = pct(f.count, prev);
                const width = pct(f.count, funnel[0]!.count || 1);
                return (
                  <li
                    key={f.stage}
                    className="grid grid-cols-[76px_1fr_88px] items-center gap-2 text-xs"
                  >
                    <span className="text-crm-muted-fg">{stageLabel[f.stage]}</span>
                    <span className="h-5 rounded-[4px] bg-crm-track">
                      <span
                        className="block h-full rounded-[4px] bg-crm-primary/80"
                        style={{ width: `${Math.max(width, f.count ? 2 : 0)}%` }}
                      />
                    </span>
                    <span className="text-right tabular-nums">
                      {f.count.toLocaleString()}
                      {i > 0 ? (
                        <span
                          className={cn(
                            "ml-1",
                            conv < 15 ? "text-crm-danger" : "text-crm-muted-fg",
                          )}
                        >
                          {conv.toFixed(0)}%
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Source of applicants" description={`${sourceTotal} total`} />
          <CardBody className="flex flex-col gap-2.5">
            {sourceRows.length === 0 ? (
              <p className="text-xs text-crm-muted-fg">No source data yet.</p>
            ) : (
              sourceRows.map(([name, v]) => (
                <Progress
                  key={name}
                  size="sm"
                  label={`${name} · ${v}`}
                  value={pct(v, sourceTotal)}
                  showValue
                />
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Open requisitions" description="Sorted by time-to-fill risk" bordered />
        {open.length === 0 ? (
          <EmptyState className="py-8" icon={<Briefcase />} title="All seats filled" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="text-left text-crm-muted-fg">
                <tr>
                  <th className="px-4 py-2 font-normal">Role</th>
                  <th className="px-2 py-2 font-normal">Recruiter</th>
                  <th className="px-2 py-2 text-right font-normal">Pipeline</th>
                  <th className="px-2 py-2 text-right font-normal">Filled</th>
                  <th className="px-4 py-2 font-normal">Days open / target</th>
                </tr>
              </thead>
              <tbody>
                {open.map(({ r, age, ratio }) => (
                  <tr
                    key={r.id}
                    tabIndex={0}
                    onClick={() => onOpenRequisition?.(r)}
                    onKeyDown={(e) => e.key === "Enter" && onOpenRequisition?.(r)}
                    className="cursor-pointer border-t border-crm-border outline-none hover:bg-crm-muted/40 focus-visible:bg-crm-muted/60"
                  >
                    <td className="px-4 py-2">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-crm-muted-fg">{r.department}</div>
                    </td>
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-1.5">
                        <Avatar name={r.recruiter} size="xs" />
                        {r.recruiter}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {r.funnel.interview} in loop · {r.funnel.offer} offer
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {r.funnel.hired}/{r.headcount}
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        <Progress
                          className="w-24"
                          size="sm"
                          value={Math.min(100, ratio * 100)}
                          tone={ratio >= 1 ? "danger" : ratio >= 0.75 ? "warning" : "success"}
                        />
                        <span className="tabular-nums">
                          {age}/{r.targetDays}d
                        </span>
                        {ratio >= 1 ? (
                          <Tag size="sm" color="red">
                            Over SLA
                          </Tag>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
