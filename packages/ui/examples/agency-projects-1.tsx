import { AgencyProjects, type AgencyProject } from "@/components/crm/agency-projects";

const projects: AgencyProject[] = [
  {
    id: "p1",
    name: "Spring commerce replatform",
    client: "Northwind Outfitters",
    phase: "build",
    billing: "fixed",
    budget: 96000,
    spent: 71200,
    progress: 52,
    dueDate: "2026-11-30",
    team: ["Priya Shah", "Leo Grant", "Ama Owusu", "Jin Park", "Sara Kim"],
    milestones: [
      { name: "Design sign-off", due: "2026-08-15", done: true },
      { name: "Catalog migration", due: "2026-09-20", done: false },
      { name: "Checkout QA", due: "2026-10-25", done: false },
    ],
  },
  {
    id: "p2",
    name: "Patient portal UX audit",
    client: "Helio Health",
    phase: "discovery",
    billing: "t&m",
    budget: 28000,
    spent: 9100,
    progress: 40,
    dueDate: "2026-10-18",
    team: ["Marcus Lee", "Ama Owusu"],
    milestones: [
      { name: "Stakeholder interviews", due: "2026-09-12", done: true },
      { name: "Heuristic review", due: "2026-10-05", done: false },
    ],
  },
  {
    id: "p3",
    name: "Brand refresh",
    client: "Cedar & Pine Hotels",
    phase: "design",
    billing: "fixed",
    budget: 42000,
    spent: 44800,
    progress: 85,
    dueDate: "2026-10-02",
    team: ["Dana Ortiz", "Leo Grant"],
  },
  {
    id: "p4",
    name: "Onboarding email journeys",
    client: "Brightline Fintech",
    phase: "launch",
    billing: "retainer",
    budget: 18000,
    spent: 15600,
    progress: 90,
    dueDate: "2026-09-25",
    team: ["Priya Shah"],
    milestones: [{ name: "Go-live", due: "2026-09-25", done: false }],
  },
  {
    id: "p5",
    name: "Menu board signage",
    client: "Kinfolk Coffee Co.",
    phase: "closed",
    billing: "fixed",
    budget: 8500,
    spent: 7900,
    progress: 100,
    dueDate: "2026-08-30",
    team: ["Dana Ortiz", "Jin Park"],
  },
];

export default function Example() {
  return (
    <AgencyProjects className="w-[1040px]" projects={projects} today={new Date(2026, 8, 28)} />
  );
}
