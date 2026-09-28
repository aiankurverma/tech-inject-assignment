import { EduStudents, type StudentRecord } from "@/components/crm/edu-students";

const students: StudentRecord[] = [
  {
    id: "s1",
    studentId: "S2024-0117",
    name: "Ananya Iyer",
    cohort: "Class of 2028",
    program: "Computer Science",
    gpa: 3.86,
    termGpa: 3.9,
    creditsEarned: 45,
    creditsRequired: 120,
    attended: 58,
    sessions: 60,
  },
  {
    id: "s2",
    studentId: "S2023-0452",
    name: "Marcus Bell",
    cohort: "Class of 2027",
    program: "Economics",
    gpa: 2.31,
    termGpa: 1.9,
    creditsEarned: 68,
    creditsRequired: 120,
    attended: 41,
    sessions: 60,
    balanceCents: 185000,
    advisor: "Dr. Hall",
  },
  {
    id: "s3",
    studentId: "S2022-0310",
    name: "Chloe Martin",
    cohort: "Class of 2026",
    program: "Nursing",
    gpa: 3.44,
    termGpa: 3.5,
    creditsEarned: 102,
    creditsRequired: 128,
    attended: 57,
    sessions: 60,
  },
  {
    id: "s4",
    studentId: "S2024-0209",
    name: "Diego Ramos",
    cohort: "Class of 2028",
    program: "Computer Science",
    gpa: 1.84,
    termGpa: 1.6,
    creditsEarned: 24,
    creditsRequired: 120,
    attended: 44,
    sessions: 60,
    balanceCents: 92000,
  },
  {
    id: "s5",
    studentId: "S2023-0088",
    name: "Leila Ahmadi",
    cohort: "Class of 2027",
    program: "Economics",
    gpa: 3.62,
    termGpa: 3.1,
    creditsEarned: 72,
    creditsRequired: 120,
    attended: 55,
    sessions: 60,
  },
  {
    id: "s6",
    studentId: "S2022-0415",
    name: "Noah Fischer",
    cohort: "Class of 2026",
    program: "Computer Science",
    gpa: 2.95,
    termGpa: 3.05,
    creditsEarned: 96,
    creditsRequired: 120,
    attended: 50,
    sessions: 60,
    balanceCents: 40000,
  },
];

export default function Example() {
  return (
    <EduStudents
      className="w-[960px]"
      students={students}
      onOpen={(s) => console.log("open", s.studentId)}
    />
  );
}
