import * as React from "react";
import { addDays, startOfDay } from "date-fns";
import { ProGanttRoadmap, type GanttTask } from "@/components/crm/pro-gantt-roadmap";

const INITIATIVES = [
  "Self-serve onboarding",
  "Billing v2",
  "Enterprise SSO",
  "Mobile app",
  "Data warehouse sync",
  "AI lead scoring",
  "Partner marketplace",
  "Compliance (SOC 2)",
];
const PHASES = ["Discovery", "Design", "API", "Frontend", "QA", "Rollout"];
const WORK = [
  "Spec review",
  "Schema migration",
  "Service endpoints",
  "Permissions",
  "UI states",
  "Integration tests",
  "Load testing",
  "Docs",
  "Beta feedback",
  "Bug bash",
];
const OWNERS = ["Priya", "Arjun", "Neha", "Wade", "Esther", "Rahul", "Cody", "Jane"];

/** 8 initiatives x 25 epics x 50 tasks = 10,000 schedulable tasks + milestones. */
function generate(): GanttTask[] {
  const out: GanttTask[] = [];
  const base = addDays(startOfDay(new Date()), -75);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  INITIATIVES.forEach((name, i) => {
    const iid = `i${i}`;
    out.push({ id: iid, name, start: base, end: base });
    for (let e = 0; e < 25; e++) {
      const eid = `${iid}e${e}`;
      out.push({
        id: eid,
        name: `${PHASES[e % PHASES.length]} · ${name.split(" ")[0]} ${e + 1}`,
        start: base,
        end: base,
        parentId: iid,
      });
      let cursor = addDays(base, i * 9 + e * 6);
      let prev: string | null = null;
      for (let t = 0; t < 49; t++) {
        const id = `${eid}t${t}`;
        const dur = 1 + Math.floor(rnd() * 6);
        const parallel = t > 0 && rnd() < 0.3;
        const start = parallel ? addDays(cursor, -dur) : addDays(cursor, Math.floor(rnd() * 2));
        const end = addDays(start, dur);
        const slip = rnd() < 0.25 ? Math.floor(rnd() * 4) : 0;
        const done = end < new Date() ? 1 : start < new Date() ? Math.round(rnd() * 10) / 10 : 0;
        out.push({
          id,
          name: `${WORK[t % WORK.length]} ${t + 1}`,
          start,
          end,
          parentId: eid,
          dependencies: prev && !parallel ? [prev] : prev ? [] : [],
          progress: done,
          assignee: OWNERS[(i + e + t) % OWNERS.length],
          baselineStart: addDays(start, -slip),
          baselineEnd: addDays(end, -slip),
        });
        if (!parallel) prev = id;
        if (end > cursor) cursor = end;
      }
      out.push({
        id: `${eid}m`,
        name: "Epic sign-off",
        start: cursor,
        end: cursor,
        milestone: true,
        parentId: eid,
        dependencies: prev ? [prev] : [],
        baselineStart: addDays(cursor, -2),
        baselineEnd: addDays(cursor, -2),
      });
    }
  });
  return out;
}

export default function Example() {
  const [tasks, setTasks] = React.useState(generate);
  const [last, setLast] = React.useState<string | null>(null);
  const leafCount = React.useMemo(() => tasks.filter((t) => t.id.includes("t")).length, [tasks]);

  return (
    <div className="min-h-screen bg-crm-bg p-6">
      <ProGanttRoadmap
        title="Product roadmap FY26"
        tasks={tasks}
        onTasksChange={(next, id) => {
          setTasks(next);
          setLast(id);
        }}
        onTaskOpen={(t) => setLast(`${t.id} (opened)`)}
        defaultZoom="week"
        showCritical
        height={720}
      />
      <p className="mt-3 text-xs text-crm-muted-fg">
        {leafCount.toLocaleString()} tasks · drag bars to move, drag edges to resize, Alt+Arrow to
        nudge from the keyboard.{last && ` Last change: ${last}`}
      </p>
    </div>
  );
}
