import { TaskInbox, type InboxTask } from "@/components/crm/task-inbox";

const me = { id: "u1", name: "Maya Chen" };
const leo = { id: "u2", name: "Leo Park" };

const tasks: InboxTask[] = [
  {
    id: "a1",
    title: "Follow up on pricing objection",
    kind: "call",
    due: "2026-09-25",
    owner: me,
    related: "Northwind",
  },
  {
    id: "a2",
    title: "Send recap + mutual action plan",
    kind: "email",
    due: "2026-09-27",
    owner: me,
    related: "Initech",
  },
  {
    id: "a3",
    title: "Discovery call — ops lead",
    kind: "meeting",
    due: "2026-09-28",
    owner: me,
    related: "Globex",
  },
  { id: "a4", title: "Log call notes from demo", kind: "todo", due: "2026-09-28", owner: me },
  {
    id: "a5",
    title: "Renewal check-in",
    kind: "call",
    due: "2026-09-29",
    owner: me,
    related: "Umbrella",
  },
  {
    id: "a6",
    title: "Share case study (fintech)",
    kind: "email",
    due: "2026-10-02",
    owner: me,
    related: "Hooli",
  },
  { id: "a7", title: "Quarterly forecast review", kind: "meeting", due: "2026-10-14", owner: me },
  { id: "a8", title: "Clean up duplicate contacts", kind: "todo", owner: me },
  {
    id: "a9",
    title: "Call back inbound lead",
    kind: "call",
    due: "2026-09-26",
    owner: leo,
    related: "Soylent",
  },
  { id: "a10", title: "Send NDA", kind: "email", due: "2026-09-24", owner: me, done: true },
];

export default function Example() {
  return (
    <div className="w-full max-w-[720px]">
      <TaskInbox defaultTasks={tasks} currentUserId="u1" today="2026-09-28" />
    </div>
  );
}
