import * as React from "react";
import { CalendarCheck, GraduationCap, Repeat, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Card, CardBody, CardHeader } from "@/components/crm/card";
import { EmptyState } from "@/components/crm/feedback";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { Progress } from "@/components/crm/progress";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag } from "@/components/crm/tag";

export interface EduTermStats {
  /** e.g. "Fall 2026". */
  term: string;
  programs: {
    name: string;
    enrolled: number;
    capacity: number;
    /** Students retained from the previous term / eligible to return. */
    retained: number;
    returning: number;
  }[];
  /** Weekly average attendance %, oldest first. */
  attendanceTrend: number[];
  /** Fees billed and collected in minor units. */
  billedCents: number;
  collectedCents: number;
  /** Receivables by age bucket in minor units. */
  aging?: { current: number; d30: number; d60: number; d90: number };
  atRisk: { id: string; name: string; program: string; reason: string; advisor?: string }[];
}

export interface EduDashboardProps {
  terms: EduTermStats[];
  term?: string;
  defaultTerm?: string;
  onTermChange?: (term: string) => void;
  currency?: string;
  onOpenStudent?: (id: string) => void;
  className?: string;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const change = (cur: number, prev: number | undefined) =>
  prev ? ((cur - prev) / prev) * 100 : undefined;

function totals(t: EduTermStats | undefined) {
  if (!t) return undefined;
  const enrolled = sum(t.programs.map((p) => p.enrolled));
  const retention = sum(t.programs.map((p) => p.returning))
    ? (sum(t.programs.map((p) => p.retained)) / sum(t.programs.map((p) => p.returning))) * 100
    : 0;
  const attendance = t.attendanceTrend.length
    ? sum(t.attendanceTrend) / t.attendanceTrend.length
    : 0;
  const collection = t.billedCents ? (t.collectedCents / t.billedCents) * 100 : 0;
  return { enrolled, retention, attendance, collection };
}

/** Institution overview per term: enrollment, retention, attendance and fee-collection KPIs with program fill, receivables aging and at-risk students. */
export function EduDashboard({
  terms,
  term: termProp,
  defaultTerm,
  onTermChange,
  currency = "USD",
  onOpenStudent,
  className,
}: EduDashboardProps) {
  const [inner, setInner] = React.useState(defaultTerm ?? terms[terms.length - 1]?.term ?? "");
  const termName = termProp ?? inner;
  const idx = Math.max(
    0,
    terms.findIndex((t) => t.term === termName),
  );
  const t = terms[idx];
  const cur = totals(t);
  const prev = totals(terms[idx - 1]);
  const money = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  if (!t || !cur)
    return (
      <EmptyState
        className={className}
        icon={<GraduationCap />}
        title="No term data yet"
        description="Enrollment and fee figures appear once the first term is loaded."
      />
    );

  const aging = t.aging;
  const agingTotal = aging ? aging.current + aging.d30 + aging.d60 + aging.d90 : 0;

  return (
    <div className={cn("flex flex-col gap-3 font-crm text-crm-fg", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-medium">{t.term} overview</h2>
          <p className="text-xs text-crm-muted-fg">
            {t.programs.length} programs{terms[idx - 1] ? ` · vs ${terms[idx - 1]!.term}` : ""}
          </p>
        </div>
        <SegmentedControl
          label="Term"
          size="sm"
          value={t.term}
          onValueChange={(v) => {
            if (termProp === undefined) setInner(v);
            onTermChange?.(v);
          }}
          options={terms.map((x) => ({ value: x.term, label: x.term }))}
        />
      </div>

      <KpiGrid
        items={[
          {
            label: "Enrolled",
            value: cur.enrolled.toLocaleString(),
            delta: change(cur.enrolled, prev?.enrolled),
            icon: <GraduationCap />,
          },
          {
            label: "Retention",
            value: `${cur.retention.toFixed(1)}%`,
            delta: change(cur.retention, prev?.retention),
            icon: <Repeat />,
          },
          {
            label: "Avg. attendance",
            value: `${cur.attendance.toFixed(1)}%`,
            delta: change(cur.attendance, prev?.attendance),
            icon: <CalendarCheck />,
            trend: t.attendanceTrend,
          },
          {
            label: "Fees collected",
            value: money.format(t.collectedCents / 100),
            caption: `${cur.collection.toFixed(0)}% of ${money.format(t.billedCents / 100)}`,
            delta: change(cur.collection, prev?.collection),
            icon: <Wallet />,
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader title="Program fill" description="Enrolled vs. capacity" />
          <CardBody className="flex flex-col gap-3">
            {[...t.programs]
              .sort((a, b) => b.enrolled / b.capacity - a.enrolled / a.capacity)
              .map((p) => {
                const fill = p.capacity ? (p.enrolled / p.capacity) * 100 : 0;
                return (
                  <Progress
                    key={p.name}
                    size="sm"
                    label={`${p.name} · ${p.enrolled}/${p.capacity}`}
                    value={Math.min(fill, 100)}
                    tone={fill >= 100 ? "danger" : fill < 70 ? "warning" : "success"}
                    showValue
                  />
                );
              })}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Receivables aging"
            description={money.format(agingTotal / 100) + " outstanding"}
          />
          <CardBody>
            {aging && agingTotal > 0 ? (
              <>
                <div
                  className="flex h-3 overflow-hidden rounded-full"
                  role="img"
                  aria-label="Receivables by age"
                >
                  {(
                    [
                      ["current", "bg-crm-success"],
                      ["d30", "bg-crm-primary"],
                      ["d60", "bg-crm-warning"],
                      ["d90", "bg-crm-danger"],
                    ] as const
                  ).map(([k, c]) => (
                    <span
                      key={k}
                      className={c}
                      style={{ width: `${(aging[k] / agingTotal) * 100}%` }}
                    />
                  ))}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {(
                    [
                      ["current", "Current"],
                      ["d30", "1–30 days"],
                      ["d60", "31–60 days"],
                      ["d90", "60+ days"],
                    ] as const
                  ).map(([k, label]) => (
                    <div key={k}>
                      <dt className="text-crm-muted-fg">{label}</dt>
                      <dd
                        className={cn(
                          "tabular-nums",
                          k === "d90" && aging[k] > 0 && "text-crm-danger",
                        )}
                      >
                        {money.format(aging[k] / 100)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="text-xs text-crm-muted-fg">No outstanding fees.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Students at risk"
            description={`${t.atRisk.length} flagged by advisors`}
          />
          <CardBody>
            {t.atRisk.length === 0 ? (
              <p className="text-xs text-crm-muted-fg">No students flagged this term.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {t.atRisk.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onOpenStudent?.(s.id)}
                      className="flex w-full items-center gap-2 rounded-crm p-1 text-left text-xs outline-none hover:bg-crm-muted/50 focus-visible:ring-2 focus-visible:ring-crm-ring/60"
                    >
                      <Avatar name={s.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className="block truncate text-crm-muted-fg">{s.program}</span>
                      </span>
                      <Tag size="sm" color="amber">
                        {s.reason}
                      </Tag>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
