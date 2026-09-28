import { EduDashboard, type EduTermStats } from "@/components/crm/edu-dashboard";

const terms: EduTermStats[] = [
  {
    term: "Spring 2026",
    programs: [
      { name: "Computer Science", enrolled: 412, capacity: 450, retained: 380, returning: 420 },
      { name: "Economics", enrolled: 268, capacity: 300, retained: 241, returning: 270 },
      { name: "Nursing", enrolled: 190, capacity: 190, retained: 176, returning: 185 },
    ],
    attendanceTrend: [91, 90, 89, 88, 88, 87, 86],
    billedCents: 612_000_000,
    collectedCents: 548_000_000,
    atRisk: [],
  },
  {
    term: "Fall 2026",
    programs: [
      { name: "Computer Science", enrolled: 448, capacity: 450, retained: 392, returning: 412 },
      { name: "Economics", enrolled: 251, capacity: 300, retained: 230, returning: 268 },
      { name: "Nursing", enrolled: 196, capacity: 190, retained: 181, returning: 190 },
      { name: "Data Analytics", enrolled: 58, capacity: 90, retained: 0, returning: 0 },
    ],
    attendanceTrend: [93, 92, 92, 90, 89, 90, 88, 87],
    billedCents: 671_500_000,
    collectedCents: 559_200_000,
    aging: { current: 61_400_000, d30: 28_700_000, d60: 13_900_000, d90: 8_300_000 },
    atRisk: [
      {
        id: "s2",
        name: "Marcus Bell",
        program: "Economics",
        reason: "GPA 2.31 ↓",
        advisor: "Dr. Hall",
      },
      { id: "s4", name: "Diego Ramos", program: "Computer Science", reason: "Probation" },
      { id: "s9", name: "Tara Quinn", program: "Nursing", reason: "Attendance 68%" },
      { id: "s12", name: "Victor Chen", program: "Data Analytics", reason: "Fees 90d+" },
    ],
  },
];

export default function Example() {
  return (
    <EduDashboard
      className="w-[1040px]"
      terms={terms}
      onOpenStudent={(id) => console.log("open student", id)}
    />
  );
}
