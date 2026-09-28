import { EduAdmissions, type Applicant } from "@/components/crm/edu-admissions";

const docs = (transcript: boolean, essay: boolean, rec: boolean) => [
  { name: "Transcript", received: transcript },
  { name: "Personal essay", received: essay },
  { name: "Recommendation", received: rec },
];

const applicants: Applicant[] = [
  {
    id: "a1",
    name: "Ananya Iyer",
    program: "BSc Computer Science",
    stage: "interview",
    gpa: 3.92,
    testScore: 1480,
    documents: docs(true, true, true),
    submittedAt: "2026-08-30",
    scholarship: true,
  },
  {
    id: "a2",
    name: "Daniel Kowalski",
    program: "BSc Computer Science",
    stage: "review",
    gpa: 3.41,
    testScore: 1320,
    documents: docs(true, true, false),
    submittedAt: "2026-09-04",
  },
  {
    id: "a3",
    name: "Sofia Rossi",
    program: "BA Economics",
    stage: "admitted",
    gpa: 3.78,
    testScore: 1400,
    documents: docs(true, true, true),
    submittedAt: "2026-08-21",
  },
  {
    id: "a4",
    name: "Kwame Mensah",
    program: "BA Economics",
    stage: "enrolled",
    gpa: 3.66,
    documents: docs(true, true, true),
    submittedAt: "2026-08-15",
  },
  {
    id: "a5",
    name: "Hannah Schmidt",
    program: "BSc Nursing",
    stage: "applied",
    gpa: 3.25,
    documents: docs(false, true, false),
    submittedAt: "2026-09-20",
  },
  {
    id: "a6",
    name: "Mateo Alvarez",
    program: "BSc Nursing",
    stage: "review",
    gpa: 3.58,
    testScore: 1260,
    documents: docs(true, true, true),
    submittedAt: "2026-09-11",
  },
  {
    id: "a7",
    name: "Yuki Sato",
    program: "BSc Computer Science",
    stage: "waitlisted",
    gpa: 3.35,
    testScore: 1350,
    documents: docs(true, true, true),
    submittedAt: "2026-08-26",
  },
  {
    id: "a8",
    name: "Omar Haddad",
    program: "BA Economics",
    stage: "interview",
    gpa: 3.12,
    testScore: 1210,
    documents: docs(true, false, true),
    submittedAt: "2026-09-02",
  },
];

export default function Example() {
  return (
    <EduAdmissions
      className="w-[900px]"
      defaultApplicants={applicants}
      seats={{ "BSc Computer Science": 3, "BA Economics": 2, "BSc Nursing": 2 }}
      decisionDeadline="2026-10-05"
      now={new Date("2026-09-28")}
    />
  );
}
