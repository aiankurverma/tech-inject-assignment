import * as React from "react";
import { ProCronBuilder, describeCron, validateCron } from "@/components/crm/pro-cron-builder";

interface Job {
  id: string;
  name: string;
  queue: string;
  cron: string;
  timezone: string;
}

const initialJobs: Job[] = [
  {
    id: "j1",
    name: "Sync HubSpot contacts",
    queue: "integrations",
    cron: "*/15 * * * *",
    timezone: "UTC",
  },
  {
    id: "j2",
    name: "Nightly revenue rollup",
    queue: "analytics",
    cron: "30 2 * * *",
    timezone: "America/New_York",
  },
  {
    id: "j3",
    name: "Renewal reminder emails",
    queue: "email",
    cron: "0 9 * * 1-5",
    timezone: "Europe/London",
  },
  {
    id: "j4",
    name: "Quarterly churn report",
    queue: "analytics",
    cron: "0 6 1 1,4,7,10 *",
    timezone: "Asia/Kolkata",
  },
  {
    id: "j5",
    name: "Purge soft-deleted records",
    queue: "maintenance",
    cron: "0 3 * * 0",
    timezone: "UTC",
  },
];

export default function Example() {
  const [jobs, setJobs] = React.useState(initialJobs);
  const [selectedId, setSelectedId] = React.useState("j3");
  const selected = jobs.find((j) => j.id === selectedId)!;
  const update = (patch: Partial<Job>) =>
    setJobs((all) => all.map((j) => (j.id === selectedId ? { ...j, ...patch } : j)));

  return (
    <div className="grid gap-4 bg-crm-bg p-6 font-crm text-crm-fg lg:grid-cols-[260px_1fr]">
      <nav aria-label="Scheduled jobs" className="grid content-start gap-1">
        <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-crm-muted-fg">
          Scheduled jobs
        </p>
        {jobs.map((job) => {
          const ok = validateCron(job.cron, job.timezone).valid;
          return (
            <button
              key={job.id}
              type="button"
              aria-current={job.id === selectedId || undefined}
              onClick={() => setSelectedId(job.id)}
              className="grid gap-0.5 rounded-crm px-2 py-2 text-left outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60 aria-[current=true]:bg-crm-raised aria-[current=true]:shadow-crm-raised"
            >
              <span className="flex items-center justify-between gap-2 text-sm">
                {job.name}
                <span
                  className={
                    ok
                      ? "size-1.5 rounded-full bg-crm-success"
                      : "size-1.5 rounded-full bg-crm-danger"
                  }
                />
              </span>
              <span className="truncate text-xs text-crm-muted-fg">
                {ok ? describeCron(job.cron) : "Invalid schedule"} · {job.queue}
              </span>
            </button>
          );
        })}
      </nav>
      <ProCronBuilder
        key={selected.id}
        label={`${selected.name} schedule`}
        value={selected.cron}
        onChange={(cron) => update({ cron })}
        timezone={selected.timezone}
        onTimezoneChange={(timezone) => update({ timezone })}
        runCount={6}
      />
    </div>
  );
}
