import { TaskBoard, type BoardTask } from "@/components/crm/task-board";

const maya = { id: "u1", name: "Maya Chen" };
const leo = { id: "u2", name: "Leo Park" };
const ana = { id: "u3", name: "Ana Souza" };

const tasks: BoardTask[] = [
  {
    id: "t1",
    title: "Send MSA redlines to legal",
    status: "todo",
    priority: "urgent",
    due: "2026-09-27",
    assignee: maya,
    related: "Northwind · Enterprise renewal",
  },
  {
    id: "t2",
    title: "Prep QBR deck with usage data",
    status: "todo",
    priority: "high",
    due: "2026-10-02",
    assignee: leo,
    related: "Globex · Q3 QBR",
  },
  {
    id: "t3",
    title: "Confirm SSO requirements with IT",
    status: "todo",
    priority: "low",
    assignee: ana,
  },
  {
    id: "t4",
    title: "Security questionnaire (142 Qs)",
    status: "in_progress",
    priority: "high",
    due: "2026-09-30",
    assignee: maya,
    related: "Initech · Pilot",
  },
  {
    id: "t5",
    title: "Draft pricing for 250 seats",
    status: "in_progress",
    priority: "medium",
    due: "2026-10-05",
    assignee: leo,
  },
  {
    id: "t6",
    title: "Onboarding kickoff agenda",
    status: "in_progress",
    priority: "medium",
    due: "2026-09-29",
    assignee: ana,
  },
  {
    id: "t7",
    title: "Chase PO number from procurement",
    status: "in_progress",
    priority: "urgent",
    due: "2026-09-26",
    assignee: maya,
    related: "Umbrella · Expansion",
  },
  {
    id: "t8",
    title: "Waiting on DPA signature",
    status: "blocked",
    priority: "high",
    due: "2026-09-25",
    assignee: leo,
    related: "Hooli · New logo",
  },
  {
    id: "t9",
    title: "Book executive sponsor call",
    status: "done",
    priority: "medium",
    due: "2026-09-24",
    assignee: ana,
  },
  { id: "t10", title: "Update close plan in CRM", status: "done", priority: "low", assignee: maya },
];

export default function Example() {
  return (
    <div className="w-full max-w-[1120px]">
      <TaskBoard
        defaultTasks={tasks}
        today="2026-09-28"
        onOpenTask={(t) => console.log("open", t.id)}
      />
    </div>
  );
}
