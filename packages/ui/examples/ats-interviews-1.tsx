import { AtsInterviews, type Interview } from "@/components/crm/ats-interviews";

const now = new Date("2026-09-28T14:10:00");

const interviews: Interview[] = [
  {
    id: "iv1",
    candidate: "Priya Raman",
    role: "Senior Backend Engineer",
    stage: "onsite",
    start: "2026-09-28T14:00:00",
    durationMin: 60,
    location: "Zoom",
    panel: [
      { name: "Marcus Lee", focus: "System design" },
      { name: "Ana Souza", focus: "Coding" },
    ],
  },
  {
    id: "iv2",
    candidate: "Jonah Whitfield",
    role: "Account Executive, Mid-Market",
    stage: "final",
    start: "2026-09-29T10:30:00",
    durationMin: 45,
    location: "HQ · Room 4B",
    panel: [{ name: "Dana Kim", focus: "Sales leadership" }],
  },
  {
    id: "iv3",
    candidate: "Lucía Fernández",
    role: "Product Designer",
    stage: "technical",
    start: "2026-09-26T09:00:00",
    durationMin: 90,
    location: "Google Meet",
    panel: [
      { name: "Tom Becker", focus: "Portfolio", recommendation: "strong-yes", score: 4 },
      { name: "Ivy Chen", focus: "Whiteboard" },
      { name: "Sam Ortiz", focus: "Collaboration", recommendation: "yes", score: 3 },
    ],
  },
  {
    id: "iv4",
    candidate: "Ethan Brooks",
    role: "Senior Backend Engineer",
    stage: "phone",
    start: "2026-09-28T09:00:00",
    durationMin: 30,
    location: "Phone",
    panel: [{ name: "Nora Patel", focus: "Recruiter screen" }],
  },
  {
    id: "iv5",
    candidate: "Grace Okafor",
    role: "Customer Success Manager",
    stage: "onsite",
    start: "2026-09-25T13:00:00",
    durationMin: 60,
    panel: [
      { name: "Dana Kim", recommendation: "yes", score: 3 },
      { name: "Ravi Menon", recommendation: "no", score: 2 },
    ],
  },
];

export default function Example() {
  return (
    <AtsInterviews
      className="w-[760px]"
      interviews={interviews}
      now={now}
      defaultFilter="feedback"
      onNudge={(iv, pending) =>
        console.log("Remind", pending.map((p) => p.name).join(", "), "about", iv.candidate)
      }
    />
  );
}
