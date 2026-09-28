import * as React from "react";
import {
  AgencyTimesheets,
  type TimesheetProject,
  type TimesheetRow,
  type TimesheetStatus,
} from "@/components/crm/agency-timesheets";

const projects: TimesheetProject[] = [
  {
    id: "p1",
    name: "Commerce replatform",
    client: "Northwind Outfitters",
    billable: true,
    rate: 165,
  },
  { id: "p2", name: "Portal UX audit", client: "Helio Health", billable: true, rate: 180 },
  { id: "p3", name: "Brand refresh", client: "Cedar & Pine Hotels", billable: true, rate: 150 },
  { id: "int", name: "Internal · hiring & ops", client: "Studio", billable: false, rate: 0 },
];

const initial: TimesheetRow[] = [
  {
    id: "r1",
    projectId: "p1",
    task: "Catalog import scripts",
    billable: true,
    hours: [4, 5.5, 3, 6, 2, 0, 0],
  },
  {
    id: "r2",
    projectId: "p2",
    task: "Heuristic review",
    billable: true,
    hours: [2, 1.5, 4, 1, 3.5, 0, 0],
  },
  {
    id: "r3",
    projectId: "p3",
    task: "Logo revisions",
    billable: true,
    hours: [1, 0, 1.5, 4, 2, 0, 0],
  },
  {
    id: "r4",
    projectId: "int",
    task: "Candidate interviews",
    billable: false,
    hours: [1, 1, 0, 0.5, 1, 0, 0],
  },
];

export default function Example() {
  const [rows, setRows] = React.useState(initial);
  const [status, setStatus] = React.useState<TimesheetStatus>("draft");
  return (
    <div className="flex w-[960px] flex-col gap-2">
      <AgencyTimesheets
        projects={projects}
        rows={rows}
        onRowsChange={setRows}
        defaultWeek={new Date(2026, 8, 21)}
        status={status}
        onSubmit={() => setStatus("submitted")}
      />
      {status !== "draft" ? (
        <button
          type="button"
          className="self-start text-xs text-crm-soft underline"
          onClick={() => setStatus("draft")}
        >
          Recall submission
        </button>
      ) : (
        <p className="text-xs text-crm-subtle">
          Tip: type 1:30, 1.5 or 90m. Arrow keys move between cells.
        </p>
      )}
    </div>
  );
}
