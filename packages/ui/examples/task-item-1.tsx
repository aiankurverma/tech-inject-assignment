import * as React from "react";
import { TaskItem, type Task } from "@/components/crm/task-item";

const day = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const initial: Task[] = [
  {
    id: "t1",
    title: "Send revised MSA redlines",
    type: "email",
    due: day(-2),
    priority: "urgent",
    related: { label: "Acme Corp" },
    assignee: { name: "Priya Nair" },
  },
  {
    id: "t2",
    title: "Discovery call with CFO",
    type: "call",
    due: new Date(Date.now() + 2 * 3_600_000),
    priority: "high",
    related: { label: "Globex · Expansion" },
    assignee: { name: "Alex Santos" },
  },
  {
    id: "t3",
    title: "Weekly pipeline review",
    type: "meeting",
    due: day(3),
    repeat: "Weekly",
    assignee: { name: "Lena Park" },
  },
  {
    id: "t4",
    title: "Update close date after procurement delay",
    done: true,
    completedAt: new Date().toISOString(),
    related: { label: "Initech" },
  },
];

export default function Example() {
  const [tasks, setTasks] = React.useState(initial);
  return (
    <div className="flex max-w-2xl flex-col rounded-xl border border-crm-border bg-crm-card p-2">
      {tasks.map((t) => (
        <TaskItem
          key={t.id}
          task={t}
          onToggle={(id, done) =>
            setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done } : x)))
          }
        />
      ))}
    </div>
  );
}
