import * as React from "react";
import { TaskList, type TaskGroupBy } from "@/components/crm/task-list";
import type { Task } from "@/components/crm/task-item";

const day = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const seed: Task[] = [
  {
    id: "1",
    title: "Chase signed order form",
    type: "email",
    due: day(-3),
    priority: "urgent",
    related: { label: "Acme Corp" },
    assignee: { name: "Priya Nair" },
  },
  {
    id: "2",
    title: "Security questionnaire follow-up",
    due: day(-1),
    priority: "high",
    related: { label: "Globex" },
    assignee: { name: "Alex Santos" },
  },
  {
    id: "3",
    title: "Demo for ops team",
    type: "meeting",
    due: day(0),
    related: { label: "Initech" },
    assignee: { name: "Alex Santos" },
  },
  {
    id: "4",
    title: "Call back re: pricing tiers",
    type: "call",
    due: day(1),
    priority: "high",
    related: { label: "Hooli" },
    assignee: { name: "Lena Park" },
  },
  {
    id: "5",
    title: "QBR deck prep",
    due: day(4),
    repeat: "Quarterly",
    assignee: { name: "Lena Park" },
  },
  {
    id: "6",
    title: "Intro to procurement",
    type: "email",
    due: day(12),
    related: { label: "Umbrella" },
  },
  { id: "7", title: "Log notes from onsite", priority: "low" },
  {
    id: "8",
    title: "Send NDA",
    done: true,
    completedAt: new Date().toISOString(),
    related: { label: "Stark Industries" },
  },
];

let nextId = 100;

export default function Example() {
  const [tasks, setTasks] = React.useState(seed);
  const [groupBy, setGroupBy] = React.useState<TaskGroupBy>("due");
  return (
    <div className="flex max-w-2xl flex-col gap-2 font-crm">
      <label className="flex items-center gap-2 self-end crm-caption text-crm-soft">
        Group by
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as TaskGroupBy)}
          className="rounded-md border border-crm-input/60 bg-crm-raised px-1.5 py-1 text-xs text-crm-fg [color-scheme:dark]"
        >
          <option value="due">Due date</option>
          <option value="assignee">Owner</option>
          <option value="priority">Priority</option>
        </select>
      </label>
      <TaskList
        title="My tasks"
        tasks={tasks}
        onTasksChange={setTasks}
        groupBy={groupBy}
        onCreate={(title) => ({
          id: String(nextId++),
          title,
          due: day(0),
          assignee: { name: "Alex Santos" },
        })}
      />
    </div>
  );
}
