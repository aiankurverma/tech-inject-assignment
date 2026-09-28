import * as React from "react";
import { Check, FileWarning, GraduationCap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { Card } from "@/components/crm/card";
import { Checkbox } from "@/components/crm/checkbox";
import { EmptyState } from "@/components/crm/feedback";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Select } from "@/components/crm/select";
import { Tag, type TagColor } from "@/components/crm/tag";

export const ADMISSION_STAGES = ["applied", "review", "interview", "admitted", "enrolled"] as const;
export type AdmissionStage = (typeof ADMISSION_STAGES)[number] | "waitlisted" | "rejected";

export interface AdmissionDocument {
  name: string;
  received: boolean;
}

export interface Applicant {
  id: string;
  name: string;
  program: string;
  stage: AdmissionStage;
  /** Unweighted GPA on a 4.0 scale. */
  gpa?: number;
  testScore?: number;
  documents: AdmissionDocument[];
  /** ISO submitted date. */
  submittedAt: string;
  scholarship?: boolean;
}

export interface EduAdmissionsProps {
  applicants?: Applicant[];
  defaultApplicants?: Applicant[];
  onApplicantsChange?: (next: Applicant[]) => void;
  /** ISO decision deadline shown as a countdown. */
  decisionDeadline?: string;
  /** Seats per program; drives the capacity bar. */
  seats?: Record<string, number>;
  now?: Date;
  className?: string;
}

const stageMeta: Record<AdmissionStage, { label: string; color: TagColor }> = {
  applied: { label: "Applied", color: "neutral" },
  review: { label: "In review", color: "blue" },
  interview: { label: "Interview", color: "purple" },
  admitted: { label: "Admitted", color: "green" },
  enrolled: { label: "Enrolled", color: "teal" },
  waitlisted: { label: "Waitlisted", color: "amber" },
  rejected: { label: "Declined", color: "red" },
};

const docsDone = (a: Applicant) => a.documents.filter((d) => d.received).length;
const complete = (a: Applicant) => docsDone(a) === a.documents.length;

/** Admissions review queue: stage funnel, document completeness, program seat caps, deadline countdown and bulk decisions. */
export function EduAdmissions({
  applicants: prop,
  defaultApplicants = [],
  onApplicantsChange,
  decisionDeadline,
  seats = {},
  now: nowProp,
  className,
}: EduAdmissionsProps) {
  const [inner, setInner] = React.useState(defaultApplicants);
  const list = prop ?? inner;
  const now = nowProp ?? new Date();
  const [program, setProgram] = React.useState("all");
  const [stage, setStage] = React.useState<string>("all");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());

  const commit = (next: Applicant[]) => {
    if (prop === undefined) setInner(next);
    onApplicantsChange?.(next);
  };

  const programs = [...new Set(list.map((a) => a.program))].sort();
  const inProgram = program === "all" ? list : list.filter((a) => a.program === program);
  const q = query.trim().toLowerCase();
  const rows = inProgram
    .filter((a) => (stage === "all" ? true : a.stage === stage))
    .filter((a) => !q || a.name.toLowerCase().includes(q))
    .sort((a, b) => (b.gpa ?? 0) - (a.gpa ?? 0));

  const admitted = inProgram.filter((a) => a.stage === "admitted" || a.stage === "enrolled").length;
  const enrolled = inProgram.filter((a) => a.stage === "enrolled").length;
  const seatCap =
    program === "all" ? Object.values(seats).reduce((s, n) => s + n, 0) : (seats[program] ?? 0);
  const daysLeft = decisionDeadline
    ? Math.ceil((new Date(decisionDeadline).getTime() - now.getTime()) / 86_400_000)
    : null;

  const selRows = rows.filter((a) => selected.has(a.id));
  const allSel = rows.length > 0 && selRows.length === rows.length;
  const incompleteSel = selRows.filter((a) => !complete(a)).length;
  const overCap =
    seatCap > 0 &&
    admitted + selRows.filter((a) => a.stage !== "admitted" && a.stage !== "enrolled").length >
      seatCap;

  const decide = (to: AdmissionStage) => {
    commit(
      list.map((a) => (selected.has(a.id) && a.stage !== "enrolled" ? { ...a, stage: to } : a)),
    );
    setSelected(new Set());
  };

  return (
    <Card className={cn("flex flex-col font-crm text-crm-fg", className)}>
      <div className="flex flex-col gap-3 border-b border-crm-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1">
            <h2 className="text-sm font-medium">Admissions</h2>
            <p className="text-xs text-crm-muted-fg">
              {admitted} admitted{seatCap ? ` of ${seatCap} seats` : ""} · yield{" "}
              {admitted ? Math.round((enrolled / admitted) * 100) : 0}%
            </p>
          </div>
          {daysLeft !== null ? (
            <Tag color={daysLeft < 0 ? "red" : daysLeft <= 7 ? "amber" : "neutral"}>
              {daysLeft < 0 ? "Decision deadline passed" : `${daysLeft}d to decision deadline`}
            </Tag>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <SegmentedControl
            label="Stage"
            size="sm"
            value={stage}
            onValueChange={setStage}
            options={[
              { value: "all", label: "All", count: inProgram.length },
              ...(Object.keys(stageMeta) as AdmissionStage[]).map((s) => ({
                value: s,
                label: stageMeta[s].label,
                count: inProgram.filter((a) => a.stage === s).length,
              })),
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="h-8 w-48"
            aria-label="Program"
            value={program}
            onValueChange={setProgram}
            options={[
              { value: "all", label: "All programs" },
              ...programs.map((p) => ({ value: p, label: p })),
            ]}
          />
          <SearchInput
            size="sm"
            className="ml-auto w-full sm:w-52"
            placeholder="Search applicants"
            value={query}
            onValueChange={setQuery}
            aria-label="Search applicants"
          />
        </div>
      </div>

      {selRows.length ? (
        <div
          role="toolbar"
          aria-label="Bulk decision"
          className="flex flex-wrap items-center gap-2 border-b border-crm-border bg-crm-muted/40 px-3 py-2 text-xs"
        >
          <span className="font-medium">{selRows.length} selected</span>
          {incompleteSel ? (
            <span className="flex items-center gap-1 text-crm-warning">
              <FileWarning className="size-3" aria-hidden /> {incompleteSel} missing documents
            </span>
          ) : null}
          {overCap ? (
            <span className="text-crm-danger">Admitting all would exceed seats</span>
          ) : null}
          <span className="ml-auto flex gap-1">
            <Button
              size="sm"
              variant="primary"
              disabled={incompleteSel > 0}
              onClick={() => decide("admitted")}
            >
              <Check /> Admit
            </Button>
            <Button size="sm" onClick={() => decide("waitlisted")}>
              Waitlist
            </Button>
            <Button size="sm" variant="danger" onClick={() => decide("rejected")}>
              <X /> Decline
            </Button>
          </span>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={<GraduationCap />}
          title="No applicants match"
          description="Change the program, stage or search."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-xs">
            <thead className="text-left text-crm-muted-fg">
              <tr>
                <th className="w-8 px-3 py-2">
                  <Checkbox
                    aria-label="Select all"
                    checked={allSel ? true : selRows.length ? "indeterminate" : false}
                    onCheckedChange={() =>
                      setSelected(allSel ? new Set() : new Set(rows.map((r) => r.id)))
                    }
                  />
                </th>
                <th className="px-2 py-2 font-normal">Applicant</th>
                <th className="px-2 py-2 font-normal">Stage</th>
                <th className="px-2 py-2 text-right font-normal">GPA</th>
                <th className="px-2 py-2 text-right font-normal">Test</th>
                <th className="px-2 py-2 font-normal">Documents</th>
                <th className="px-3 py-2 text-right font-normal">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const done = docsDone(a);
                const missing = a.documents.filter((d) => !d.received).map((d) => d.name);
                return (
                  <tr
                    key={a.id}
                    className={cn(
                      "border-t border-crm-border",
                      selected.has(a.id) && "bg-crm-muted/40",
                    )}
                  >
                    <td className="px-3 py-2">
                      <Checkbox
                        aria-label={`Select ${a.name}`}
                        checked={selected.has(a.id)}
                        onCheckedChange={() =>
                          setSelected((s) => {
                            const n = new Set(s);
                            if (n.has(a.id)) n.delete(a.id);
                            else n.add(a.id);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-2">
                        <Avatar name={a.name} size="sm" />
                        <span>
                          <span className="block font-medium">
                            {a.name}
                            {a.scholarship ? (
                              <span className="ml-1 text-crm-primary">★</span>
                            ) : null}
                          </span>
                          <span className="text-crm-muted-fg">{a.program}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <Tag size="sm" color={stageMeta[a.stage].color}>
                        {stageMeta[a.stage].label}
                      </Tag>
                    </td>
                    <td
                      className={cn(
                        "px-2 py-2 text-right tabular-nums",
                        (a.gpa ?? 0) >= 3.7 && "text-crm-success",
                      )}
                    >
                      {a.gpa?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{a.testScore ?? "—"}</td>
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          "tabular-nums",
                          done === a.documents.length ? "text-crm-success" : "text-crm-warning",
                        )}
                        title={
                          missing.length
                            ? `Missing: ${missing.join(", ")}`
                            : "All documents received"
                        }
                      >
                        {done}/{a.documents.length}
                        {missing.length ? (
                          <span className="ml-1 text-crm-muted-fg">
                            · {missing[0]}
                            {missing.length > 1 ? ` +${missing.length - 1}` : ""}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-crm-muted-fg tabular-nums">
                      {new Date(a.submittedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
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
