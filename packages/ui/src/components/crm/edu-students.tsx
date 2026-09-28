import * as React from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Card } from "@/components/crm/card";
import { EmptyState, Skeleton } from "@/components/crm/feedback";
import { Progress } from "@/components/crm/progress";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Select } from "@/components/crm/select";
import { Tag, type TagColor } from "@/components/crm/tag";

export interface StudentRecord {
  id: string;
  studentId: string;
  name: string;
  cohort: string;
  program: string;
  /** Cumulative GPA on a 4.0 scale. */
  gpa: number;
  /** GPA of the most recent term; used for trend. */
  termGpa?: number;
  creditsEarned: number;
  creditsRequired: number;
  /** Sessions attended / held this term. */
  attended: number;
  sessions: number;
  /** Outstanding tuition in minor units. */
  balanceCents?: number;
  advisor?: string;
}

export type Standing = "honors" | "good" | "watch" | "probation";

export interface EduStudentsProps {
  students: StudentRecord[];
  currency?: string;
  /** Attendance % below which a student is flagged. */
  attendanceThreshold?: number;
  onOpen?: (s: StudentRecord) => void;
  loading?: boolean;
  className?: string;
}

/** Academic standing from cumulative GPA, term trend and attendance. */
export function academicStanding(s: StudentRecord, attendanceThreshold = 80): Standing {
  const att = s.sessions ? (s.attended / s.sessions) * 100 : 100;
  if (s.gpa < 2.0) return "probation";
  if (
    s.gpa < 2.5 ||
    att < attendanceThreshold ||
    (s.termGpa !== undefined && s.gpa - s.termGpa >= 0.5)
  )
    return "watch";
  if (s.gpa >= 3.5) return "honors";
  return "good";
}

const standingMeta: Record<Standing, { label: string; color: TagColor }> = {
  honors: { label: "Dean's list", color: "purple" },
  good: { label: "Good standing", color: "green" },
  watch: { label: "Academic watch", color: "amber" },
  probation: { label: "Probation", color: "red" },
};

type SortKey = "name" | "gpa" | "attendance" | "credits";

/** Student roster with computed academic standing, attendance risk, degree progress and cohort filters. */
export function EduStudents({
  students,
  currency = "USD",
  attendanceThreshold = 80,
  onOpen,
  loading,
  className,
}: EduStudentsProps) {
  const [query, setQuery] = React.useState("");
  const [cohort, setCohort] = React.useState("all");
  const [view, setView] = React.useState<"all" | "risk" | "honors">("all");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const money = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  const cohorts = [...new Set(students.map((s) => s.cohort))].sort();
  const enriched = students.map((s) => ({
    s,
    att: s.sessions ? (s.attended / s.sessions) * 100 : 100,
    prog: s.creditsRequired ? (s.creditsEarned / s.creditsRequired) * 100 : 0,
    standing: academicStanding(s, attendanceThreshold),
  }));
  const pool = enriched.filter((r) => cohort === "all" || r.s.cohort === cohort);
  const risk = pool.filter((r) => r.standing === "watch" || r.standing === "probation");
  const honors = pool.filter((r) => r.standing === "honors");
  const q = query.trim().toLowerCase();

  const rows = (view === "risk" ? risk : view === "honors" ? honors : pool)
    .filter((r) => !q || `${r.s.name} ${r.s.studentId}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const v = (r: (typeof enriched)[number]) =>
        sort.key === "gpa"
          ? r.s.gpa
          : sort.key === "attendance"
            ? r.att
            : sort.key === "credits"
              ? r.prog
              : r.s.name;
      const x = v(a);
      const y = v(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });

  const avgGpa = pool.length ? pool.reduce((s, r) => s + r.s.gpa, 0) / pool.length : 0;
  const avgAtt = pool.length ? pool.reduce((s, r) => s + r.att, 0) / pool.length : 0;

  const header = (k: SortKey, label: string, right?: boolean) => (
    <th
      className={cn("px-2 py-2 font-normal", right && "text-right")}
      aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() =>
          setSort((s) =>
            s.key === k
              ? { key: k, dir: s.dir === 1 ? -1 : 1 }
              : { key: k, dir: k === "name" ? 1 : -1 },
          )
        }
        className="inline-flex items-center gap-0.5 rounded-crm outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3"
      >
        {label}
        {sort.key === k ? sort.dir === 1 ? <ArrowUp /> : <ArrowDown /> : null}
      </button>
    </th>
  );

  return (
    <Card className={cn("flex flex-col font-crm text-crm-fg", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3">
        <SegmentedControl
          label="Student view"
          size="sm"
          value={view}
          onValueChange={(v) => setView(v as typeof view)}
          options={[
            { value: "all", label: "All", count: pool.length },
            { value: "risk", label: "At risk", count: risk.length },
            { value: "honors", label: "Dean's list", count: honors.length },
          ]}
        />
        <Select
          className="h-8 w-40"
          aria-label="Cohort"
          value={cohort}
          onValueChange={setCohort}
          options={[
            { value: "all", label: "All cohorts" },
            ...cohorts.map((c) => ({ value: c, label: c })),
          ]}
        />
        <span className="text-xs text-crm-muted-fg tabular-nums">
          Avg GPA {avgGpa.toFixed(2)} · attendance {avgAtt.toFixed(0)}%
        </span>
        <SearchInput
          size="sm"
          className="ml-auto w-full sm:w-52"
          placeholder="Name or student ID"
          value={query}
          onValueChange={setQuery}
          aria-label="Search students"
        />
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 p-3" aria-busy>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={view === "risk" ? "No students at risk" : "No students found"}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="text-left text-crm-muted-fg">
              <tr>
                {header("name", "Student")}
                <th className="px-2 py-2 font-normal">Standing</th>
                {header("gpa", "GPA", true)}
                {header("attendance", "Attendance")}
                {header("credits", "Degree progress")}
                <th className="px-3 py-2 text-right font-normal">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, att, prog, standing }) => {
                const trend = s.termGpa !== undefined ? s.termGpa - s.gpa : 0;
                return (
                  <tr
                    key={s.id}
                    tabIndex={0}
                    onClick={() => onOpen?.(s)}
                    onKeyDown={(e) => e.key === "Enter" && onOpen?.(s)}
                    className="cursor-pointer border-t border-crm-border outline-none hover:bg-crm-muted/40 focus-visible:bg-crm-muted/60"
                  >
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-2">
                        <Avatar name={s.name} size="sm" />
                        <span>
                          <span className="block font-medium">{s.name}</span>
                          <span className="text-crm-muted-fg tabular-nums">
                            {s.studentId} · {s.cohort}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <Tag size="sm" color={standingMeta[standing].color}>
                        {standingMeta[standing].label}
                      </Tag>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {s.gpa.toFixed(2)}
                      {trend ? (
                        <span
                          className={cn("ml-1", trend < 0 ? "text-crm-danger" : "text-crm-success")}
                        >
                          {trend > 0 ? "▲" : "▼"}
                          {Math.abs(trend).toFixed(1)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-2">
                        <Progress
                          className="w-20"
                          size="sm"
                          value={att}
                          tone={
                            att < attendanceThreshold ? "danger" : att < 90 ? "warning" : "success"
                          }
                        />
                        <span
                          className={cn(
                            "tabular-nums",
                            att < attendanceThreshold && "text-crm-danger",
                          )}
                        >
                          {att.toFixed(0)}%
                        </span>
                        {att < attendanceThreshold ? (
                          <AlertTriangle
                            className="size-3 text-crm-danger"
                            aria-label="Below attendance threshold"
                          />
                        ) : null}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-2">
                        <Progress className="w-24" size="sm" value={prog} />
                        <span className="text-crm-muted-fg tabular-nums">
                          {s.creditsEarned}/{s.creditsRequired} cr
                        </span>
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        (s.balanceCents ?? 0) > 0 ? "text-crm-warning" : "text-crm-muted-fg",
                      )}
                    >
                      {money.format((s.balanceCents ?? 0) / 100)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
