import * as React from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Lock, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/crm/button";
import { Tag } from "@/components/crm/tag";

export interface TimesheetProject {
  id: string;
  name: string;
  client: string;
  /** Default billable flag for new rows on this project. */
  billable: boolean;
  /** Hourly bill rate used for the billable value total. */
  rate: number;
}

export interface TimesheetRow {
  id: string;
  projectId: string;
  task: string;
  billable: boolean;
  /** Seven entries, Monday → Sunday, in hours. */
  hours: number[];
}

export type TimesheetStatus = "draft" | "submitted" | "approved";

export interface AgencyTimesheetsProps {
  projects: TimesheetProject[];
  /** Controlled rows. */
  rows?: TimesheetRow[];
  defaultRows?: TimesheetRow[];
  onRowsChange?: (rows: TimesheetRow[]) => void;
  /** Any date inside the week to show; the grid snaps to its Monday. */
  week?: Date;
  defaultWeek?: Date;
  onWeekChange?: (monday: Date) => void;
  status?: TimesheetStatus;
  onSubmit?: (rows: TimesheetRow[], monday: Date) => void;
  /** Contracted weekly capacity used for the utilisation readout. */
  capacity?: number;
  /** Warn when a single day exceeds this many hours. */
  dailyLimit?: number;
  currency?: string;
  locale?: string;
  className?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function mondayOf(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - offset);
  return x;
}

/** Parses "1:30", "1.5", "1,5" or "90m" into decimal hours; returns null when invalid. */
export function parseHours(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (s === "") return 0;
  let v: number;
  const hm = /^(\d{1,2}):([0-5]\d)$/.exec(s);
  const mins = /^(\d{1,4})m$/.exec(s);
  if (hm) v = Number(hm[1]) + Number(hm[2]) / 60;
  else if (mins) v = Number(mins[1]) / 60;
  else {
    v = Number(s.replace(",", ".").replace(/h$/, ""));
    if (!Number.isFinite(v)) return null;
  }
  if (v < 0 || v > 24) return null;
  return Math.round(v * 4) / 4;
}

const fmtH = (n: number) => (n === 0 ? "" : Number.isInteger(n) ? String(n) : n.toFixed(2));

let rowSeq = 0;

/** Weekly timesheet grid: typed hour entry (1:30, 1.5, 90m), per-day and per-row totals, billable split, daily overtime warnings and submit locking. */
export function AgencyTimesheets({
  projects,
  rows: rowsProp,
  defaultRows = [],
  onRowsChange,
  week,
  defaultWeek,
  onWeekChange,
  status = "draft",
  onSubmit,
  capacity = 40,
  dailyLimit = 10,
  currency = "USD",
  locale = "en-US",
  className,
}: AgencyTimesheetsProps) {
  const [innerRows, setInnerRows] = React.useState(defaultRows);
  const rows = rowsProp ?? innerRows;
  const setRows = (next: TimesheetRow[]) => {
    if (rowsProp === undefined) setInnerRows(next);
    onRowsChange?.(next);
  };
  const [innerWeek, setInnerWeek] = React.useState(() => mondayOf(defaultWeek ?? new Date()));
  const monday = week ? mondayOf(week) : innerWeek;
  const shiftWeek = (delta: number) => {
    const next = new Date(monday);
    next.setDate(next.getDate() + delta * 7);
    if (!week) setInnerWeek(next);
    onWeekChange?.(next);
  };
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [newProject, setNewProject] = React.useState(projects[0]?.id ?? "");
  const locked = status !== "draft";

  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const dayFmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const dates = DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });

  const project = (id: string) => projects.find((p) => p.id === id);
  const dayTotals = DAYS.map((_, i) => rows.reduce((s, r) => s + (r.hours[i] ?? 0), 0));
  const total = dayTotals.reduce((a, b) => a + b, 0);
  const billable = rows
    .filter((r) => r.billable)
    .reduce((s, r) => s + r.hours.reduce((a, b) => a + b, 0), 0);
  const billableValue = rows
    .filter((r) => r.billable)
    .reduce(
      (s, r) => s + r.hours.reduce((a, b) => a + b, 0) * (project(r.projectId)?.rate ?? 0),
      0,
    );
  const invalidCount = Object.values(drafts).filter((v) => parseHours(v) === null).length;
  const overDays = dayTotals.filter((t) => t > dailyLimit).length;

  const commit = (rowId: string, day: number, text: string) => {
    const key = `${rowId}:${day}`;
    const v = parseHours(text);
    if (v === null) {
      setDrafts((d) => ({ ...d, [key]: text }));
      return;
    }
    setDrafts((d) => {
      const rest = { ...d };
      delete rest[key];
      return rest;
    });
    setRows(
      rows.map((r) =>
        r.id === rowId ? { ...r, hours: r.hours.map((h, i) => (i === day ? v : h)) } : r,
      ),
    );
  };

  const addRow = () => {
    const p = project(newProject);
    if (!p) return;
    rowSeq += 1;
    setRows([
      ...rows,
      {
        id: `row-${Date.now()}-${rowSeq}`,
        projectId: p.id,
        task: "",
        billable: p.billable,
        hours: [0, 0, 0, 0, 0, 0, 0],
      },
    ]);
  };

  const onCellKey = (e: React.KeyboardEvent<HTMLInputElement>, r: number, d: number) => {
    const move = (rr: number, dd: number) => {
      const el = document.querySelector<HTMLInputElement>(`[data-ts-cell="${rr}-${dd}"]`);
      if (el) {
        e.preventDefault();
        el.focus();
        el.select();
      }
    };
    if (e.key === "ArrowUp") move(r - 1, d);
    else if (e.key === "ArrowDown" || e.key === "Enter") move(r + 1, d);
    else if (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0) move(r, d - 1);
    else if (
      e.key === "ArrowRight" &&
      e.currentTarget.selectionEnd === e.currentTarget.value.length
    )
      move(r, d + 1);
  };

  const cellCls =
    "h-8 w-14 rounded-crm border bg-crm-raised px-1.5 text-right text-xs text-crm-fg tabular-nums focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <section
      aria-label="Weekly timesheet"
      className={cn(
        "flex flex-col rounded-crm border border-crm-border bg-crm-card font-crm shadow-crm-raised",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-crm-border p-3">
        <div className="flex items-center gap-1">
          <IconButton label="Previous week" onClick={() => shiftWeek(-1)}>
            <ChevronLeft />
          </IconButton>
          <span className="min-w-40 text-center text-sm font-medium text-crm-fg" aria-live="polite">
            {dayFmt.format(dates[0])} – {dayFmt.format(dates[6])}
          </span>
          <IconButton label="Next week" onClick={() => shiftWeek(1)}>
            <ChevronRight />
          </IconButton>
          <Tag
            size="sm"
            className="ml-2 capitalize"
            color={status === "approved" ? "green" : status === "submitted" ? "blue" : "neutral"}
          >
            {locked ? <Lock className="size-3" aria-hidden /> : null}
            {status}
          </Tag>
        </div>
        <dl className="flex gap-4 text-xs">
          <div>
            <dt className="text-crm-subtle">Logged</dt>
            <dd className="text-crm-fg tabular-nums">
              {total.toFixed(2)}h / {capacity}h
            </dd>
          </div>
          <div>
            <dt className="text-crm-subtle">Billable</dt>
            <dd className="text-crm-fg tabular-nums">
              {total ? Math.round((billable / total) * 100) : 0}%
            </dd>
          </div>
          <div>
            <dt className="text-crm-subtle">Billable value</dt>
            <dd className="text-crm-fg tabular-nums">{money.format(billableValue)}</dd>
          </div>
        </dl>
      </header>

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm text-crm-fg">
          <thead>
            <tr className="border-b border-crm-border">
              <th
                scope="col"
                className="crm-caption px-3 py-2 text-left font-normal text-crm-subtle"
              >
                Project / task
              </th>
              <th scope="col" className="crm-caption px-2 py-2 font-normal text-crm-subtle">
                Bill
              </th>
              {DAYS.map((d, i) => (
                <th
                  key={d}
                  scope="col"
                  className={cn(
                    "crm-caption px-1 py-2 text-right font-normal",
                    i >= 5 ? "text-crm-faint" : "text-crm-subtle",
                  )}
                >
                  {d}
                  <span className="block text-[10px]">{dates[i]?.getDate()}</span>
                </th>
              ))}
              <th
                scope="col"
                className="crm-caption px-3 py-2 text-right font-normal text-crm-subtle"
              >
                Total
              </th>
              <th scope="col" className="w-8">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-xs text-crm-soft">
                  No time logged this week. Pick a project below to add a row.
                </td>
              </tr>
            ) : null}
            {rows.map((r, ri) => {
              const p = project(r.projectId);
              const rowTotal = r.hours.reduce((a, b) => a + b, 0);
              return (
                <tr key={r.id} className="border-b border-crm-border">
                  <td className="px-3 py-1.5">
                    <span className="block text-xs font-medium">
                      {p?.name ?? "Unknown project"}
                    </span>
                    <input
                      value={r.task}
                      disabled={locked}
                      onChange={(e) =>
                        setRows(
                          rows.map((x) => (x.id === r.id ? { ...x, task: e.target.value } : x)),
                        )
                      }
                      placeholder={p ? `${p.client} · task` : "Task"}
                      aria-label={`Task for ${p?.name ?? "row"}`}
                      className="w-48 bg-transparent text-xs text-crm-soft placeholder:text-crm-faint focus-visible:text-crm-fg focus-visible:outline-none"
                    />
                  </td>
                  <td className="px-2 text-center">
                    <input
                      type="checkbox"
                      checked={r.billable}
                      disabled={locked}
                      aria-label={`${p?.name ?? "Row"} billable`}
                      onChange={() =>
                        setRows(
                          rows.map((x) => (x.id === r.id ? { ...x, billable: !x.billable } : x)),
                        )
                      }
                      className="size-3.5 accent-crm-primary"
                    />
                  </td>
                  {DAYS.map((d, di) => {
                    const key = `${r.id}:${di}`;
                    const draft = drafts[key];
                    const invalid = draft !== undefined && parseHours(draft) === null;
                    return (
                      <td key={d} className="px-1 py-1.5 text-right">
                        <input
                          data-ts-cell={`${ri}-${di}`}
                          inputMode="decimal"
                          disabled={locked}
                          aria-label={`${p?.name ?? "Row"} ${d} hours`}
                          aria-invalid={invalid || undefined}
                          defaultValue={draft ?? fmtH(r.hours[di] ?? 0)}
                          key={`${key}:${r.hours[di]}:${draft ?? ""}`}
                          onBlur={(e) => commit(r.id, di, e.target.value)}
                          onKeyDown={(e) => onCellKey(e, ri, di)}
                          className={cn(
                            cellCls,
                            invalid ? "border-crm-danger" : "border-crm-border",
                          )}
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 text-right text-xs font-medium tabular-nums">
                    {rowTotal.toFixed(2)}
                  </td>
                  <td className="pr-2">
                    {!locked ? (
                      <IconButton
                        label={`Remove ${p?.name ?? "row"}`}
                        onClick={() => setRows(rows.filter((x) => x.id !== r.id))}
                      >
                        <Trash2 />
                      </IconButton>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-xs">
              <th
                scope="row"
                colSpan={2}
                className="px-3 py-2 text-left font-normal text-crm-subtle"
              >
                Day total
              </th>
              {dayTotals.map((t, i) => (
                <td
                  key={DAYS[i]}
                  className={cn(
                    "px-1 py-2 text-right tabular-nums",
                    t > dailyLimit ? "font-medium text-crm-danger" : "text-crm-fg",
                  )}
                  title={t > dailyLimit ? `Over the ${dailyLimit}h daily limit` : undefined}
                >
                  {t.toFixed(2)}
                </td>
              ))}
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {total.toFixed(2)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-crm-border p-3">
        {!locked ? (
          <div className="flex items-center gap-2">
            <select
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              aria-label="Project to add"
              className="h-7 rounded-crm border border-crm-border bg-crm-raised px-2 text-xs text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-primary focus-visible:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.client} — {p.name}
                </option>
              ))}
            </select>
            <Button size="sm" variant="secondary" onClick={addRow} disabled={!projects.length}>
              <Plus className="size-3" aria-hidden /> Add row
            </Button>
          </div>
        ) : (
          <span className="text-xs text-crm-soft">Timesheet is {status}; edits are locked.</span>
        )}
        <div className="flex items-center gap-3">
          {invalidCount || overDays ? (
            <span role="alert" className="inline-flex items-center gap-1 text-xs text-crm-warning">
              <AlertTriangle className="size-3" aria-hidden />
              {invalidCount
                ? `${invalidCount} invalid entr${invalidCount === 1 ? "y" : "ies"}`
                : ""}
              {invalidCount && overDays ? " · " : ""}
              {overDays ? `${overDays} day${overDays === 1 ? "" : "s"} over ${dailyLimit}h` : ""}
            </span>
          ) : null}
          {!locked ? (
            <Button
              size="sm"
              disabled={invalidCount > 0 || total === 0}
              onClick={() => onSubmit?.(rows, monday)}
            >
              Submit for approval
            </Button>
          ) : null}
        </div>
      </footer>
    </section>
  );
}
