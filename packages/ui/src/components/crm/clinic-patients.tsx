import * as React from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  HeartPulse,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/crm/avatar";
import { Button } from "@/components/crm/button";
import { Card } from "@/components/crm/card";
import { EmptyState, Skeleton } from "@/components/crm/feedback";
import { SearchInput } from "@/components/crm/search-input";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { Tag } from "@/components/crm/tag";

export interface ClinicPatient {
  id: string;
  /** Medical record number. */
  mrn: string;
  name: string;
  /** ISO date of birth. */
  dob: string;
  sex?: "F" | "M" | "X";
  phone?: string;
  insurer?: string;
  /** ISO date of the last completed visit. */
  lastVisit?: string;
  /** ISO datetime of the next booked appointment. */
  nextAppointment?: string;
  /** Months between routine visits for this patient (recall interval). */
  recallMonths?: number;
  allergies?: string[];
  conditions?: string[];
  /** Outstanding patient balance in minor units (cents). */
  balanceCents?: number;
  primaryProvider?: string;
}

type SortKey = "name" | "age" | "lastVisit" | "balance";
export type PatientSegment = "all" | "recall" | "balance" | "allergy";

export interface ClinicPatientsProps {
  patients: ClinicPatient[];
  now?: Date;
  currency?: string;
  locale?: string;
  /** Mask MRN and phone until a row is focused/selected (screen-share safe). */
  maskPhi?: boolean;
  selectedId?: string | null;
  onSelect?: (patient: ClinicPatient) => void;
  onBook?: (patient: ClinicPatient) => void;
  loading?: boolean;
  error?: string;
  className?: string;
}

export function ageFrom(dob: string, now: Date) {
  const d = new Date(dob);
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/** True when the patient is past their recall interval and has nothing booked. */
export function isRecallDue(p: ClinicPatient, now: Date) {
  if (p.nextAppointment && new Date(p.nextAppointment) > now) return false;
  if (!p.lastVisit) return true;
  const due = new Date(p.lastVisit);
  due.setMonth(due.getMonth() + (p.recallMonths ?? 12));
  return due <= now;
}

const mask = (s: string) => s.replace(/.(?=.{3})/g, "•");

/** Patient roster with PHI masking, recall-due and balance segments, allergy flags and a detail pane. */
export function ClinicPatients({
  patients,
  now: nowProp,
  currency = "USD",
  locale,
  maskPhi = true,
  selectedId: selectedProp,
  onSelect,
  onBook,
  loading,
  error,
  className,
}: ClinicPatientsProps) {
  const now = React.useMemo(() => nowProp ?? new Date(), [nowProp]);
  const money = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency }),
    [locale, currency],
  );
  const [query, setQuery] = React.useState("");
  const [segment, setSegment] = React.useState<PatientSegment>("all");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [innerSel, setInnerSel] = React.useState<string | null>(null);
  const selectedId = selectedProp !== undefined ? selectedProp : innerSel;

  const select = (p: ClinicPatient) => {
    if (selectedProp === undefined) setInnerSel(p.id);
    onSelect?.(p);
  };

  const segCounts = {
    recall: patients.filter((p) => isRecallDue(p, now)).length,
    balance: patients.filter((p) => (p.balanceCents ?? 0) > 0).length,
    allergy: patients.filter((p) => p.allergies?.length).length,
  };

  const q = query.trim().toLowerCase();
  const rows = patients
    .filter((p) => {
      if (q && !`${p.name} ${p.mrn} ${p.phone ?? ""}`.toLowerCase().includes(q)) return false;
      if (segment === "recall") return isRecallDue(p, now);
      if (segment === "balance") return (p.balanceCents ?? 0) > 0;
      if (segment === "allergy") return !!p.allergies?.length;
      return true;
    })
    .sort((a, b) => {
      const v = (p: ClinicPatient): string | number =>
        sort.key === "name"
          ? p.name.split(" ").slice(-1)[0]!.toLowerCase()
          : sort.key === "age"
            ? ageFrom(p.dob, now)
            : sort.key === "balance"
              ? (p.balanceCents ?? 0)
              : (p.lastVisit ?? "");
      const x = v(a);
      const y = v(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });

  const selected = patients.find((p) => p.id === selectedId) ?? null;
  const totalBalance = rows.reduce((s, p) => s + (p.balanceCents ?? 0), 0);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const Th = ({
    k,
    children,
    right,
  }: {
    k: SortKey;
    children: React.ReactNode;
    right?: boolean;
  }) => (
    <th
      className={cn("px-2 py-2 font-normal", right && "text-right")}
      aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-0.5 rounded-crm outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60 [&_svg]:size-3"
      >
        {children}
        {sort.key === k ? sort.dir === 1 ? <ArrowUp /> : <ArrowDown /> : null}
      </button>
    </th>
  );

  const onRowKey = (e: React.KeyboardEvent<HTMLTableRowElement>, p: ClinicPatient) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(p);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const sib =
        e.key === "ArrowDown"
          ? e.currentTarget.nextElementSibling
          : e.currentTarget.previousElementSibling;
      (sib as HTMLElement | null)?.focus();
    }
  };

  return (
    <div className={cn("grid gap-3 font-crm text-crm-fg lg:grid-cols-[1fr_300px]", className)}>
      <Card className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-crm-border p-3">
          <SegmentedControl
            label="Patient segment"
            size="sm"
            value={segment}
            onValueChange={(v) => setSegment(v as PatientSegment)}
            options={[
              { value: "all", label: "All", count: patients.length },
              { value: "recall", label: "Recall due", count: segCounts.recall },
              { value: "balance", label: "Balance", count: segCounts.balance },
              { value: "allergy", label: "Allergies", count: segCounts.allergy },
            ]}
          />
          <SearchInput
            size="sm"
            className="ml-auto w-full sm:w-56"
            placeholder="Name, MRN or phone"
            value={query}
            onValueChange={setQuery}
            aria-label="Search patients"
          />
        </div>
        {error ? (
          <EmptyState
            tone="error"
            icon={<AlertTriangle />}
            title="Couldn't load patients"
            description={error}
          />
        ) : loading ? (
          <div className="flex flex-col gap-2 p-3" aria-busy>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<HeartPulse />}
            title="No patients found"
            description="Adjust search or segment."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="text-left text-crm-muted-fg">
                <tr>
                  <Th k="name">Patient</Th>
                  <Th k="age">Age</Th>
                  <th className="px-2 py-2 font-normal">Insurance</th>
                  <Th k="lastVisit">Last visit</Th>
                  <th className="px-2 py-2 font-normal">Next</th>
                  <Th k="balance" right>
                    Balance
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const due = isRecallDue(p, now);
                  const active = p.id === selectedId;
                  return (
                    <tr
                      key={p.id}
                      tabIndex={0}
                      aria-selected={active}
                      onClick={() => select(p)}
                      onKeyDown={(e) => onRowKey(e, p)}
                      className={cn(
                        "cursor-pointer border-t border-crm-border outline-none hover:bg-crm-muted/40 focus-visible:bg-crm-muted/60",
                        active && "bg-crm-muted/60",
                      )}
                    >
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-2">
                          <Avatar name={p.name} size="sm" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1 font-medium">
                              {p.name}
                              {p.allergies?.length ? (
                                <ShieldAlert
                                  className="size-3 text-crm-danger"
                                  aria-label={`Allergies: ${p.allergies.join(", ")}`}
                                />
                              ) : null}
                            </span>
                            <span className="text-crm-muted-fg tabular-nums">
                              MRN {maskPhi && !active ? mask(p.mrn) : p.mrn}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {ageFrom(p.dob, now)}
                        {p.sex ? ` ${p.sex}` : ""}
                      </td>
                      <td className="px-2 py-2">
                        {p.insurer ?? <span className="text-crm-muted-fg">Self-pay</span>}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {p.lastVisit ? new Date(p.lastVisit).toLocaleDateString(locale) : "—"}
                      </td>
                      <td className="px-2 py-2">
                        {p.nextAppointment && new Date(p.nextAppointment) > now ? (
                          <span className="tabular-nums">
                            {new Date(p.nextAppointment).toLocaleDateString(locale, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        ) : due ? (
                          <Tag size="sm" color="amber">
                            Recall due
                          </Tag>
                        ) : (
                          <span className="text-crm-muted-fg">—</span>
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-2 text-right tabular-nums",
                          (p.balanceCents ?? 0) > 0 ? "text-crm-warning" : "text-crm-muted-fg",
                        )}
                      >
                        {money.format((p.balanceCents ?? 0) / 100)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-crm-border text-crm-muted-fg">
                  <td className="px-2 py-2" colSpan={5}>
                    {rows.length} patients
                  </td>
                  <td className="px-2 py-2 text-right text-crm-fg tabular-nums">
                    {money.format(totalBalance / 100)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card className="h-fit" aria-live="polite">
        {selected ? (
          <div className="flex flex-col gap-3 p-4 text-xs">
            <div className="flex items-center gap-3">
              <Avatar name={selected.name} size="md" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{selected.name}</div>
                <div className="text-crm-muted-fg tabular-nums">
                  {new Date(selected.dob).toLocaleDateString(locale)} · {ageFrom(selected.dob, now)}{" "}
                  yrs
                </div>
              </div>
            </div>
            {selected.allergies?.length ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-crm border border-crm-danger/40 bg-crm-danger/10 p-2 text-crm-danger"
              >
                <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>Allergies: {selected.allergies.join(", ")}</span>
              </div>
            ) : (
              <div className="text-crm-muted-fg">No known allergies (NKA)</div>
            )}
            <dl className="grid grid-cols-[92px_1fr] gap-y-1.5">
              <dt className="text-crm-muted-fg">MRN</dt>
              <dd className="tabular-nums">{selected.mrn}</dd>
              <dt className="text-crm-muted-fg">Phone</dt>
              <dd className="tabular-nums">{selected.phone ?? "—"}</dd>
              <dt className="text-crm-muted-fg">Provider</dt>
              <dd>{selected.primaryProvider ?? "Unassigned"}</dd>
              <dt className="text-crm-muted-fg">Insurance</dt>
              <dd>{selected.insurer ?? "Self-pay"}</dd>
              <dt className="text-crm-muted-fg">Recall</dt>
              <dd>Every {selected.recallMonths ?? 12} months</dd>
            </dl>
            {selected.conditions?.length ? (
              <div className="flex flex-wrap gap-1">
                {selected.conditions.map((c) => (
                  <Tag key={c} size="sm" color="blue">
                    {c}
                  </Tag>
                ))}
              </div>
            ) : null}
            <Button variant="primary" onClick={() => onBook?.(selected)} disabled={!onBook}>
              <CalendarPlus />
              Book appointment
            </Button>
          </div>
        ) : (
          <EmptyState
            className="py-10"
            icon={<HeartPulse />}
            title="Select a patient"
            description="Details and alerts appear here."
          />
        )}
      </Card>
    </div>
  );
}
