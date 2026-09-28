import { ClinicPatients, type ClinicPatient } from "@/components/crm/clinic-patients";

const patients: ClinicPatient[] = [
  {
    id: "p1",
    mrn: "00482917",
    name: "Maria Gonzalez",
    dob: "1968-03-14",
    sex: "F",
    phone: "(415) 555-0132",
    insurer: "Blue Cross Blue Shield",
    lastVisit: "2025-08-02",
    recallMonths: 12,
    allergies: ["Penicillin", "Latex"],
    conditions: ["Hypertension", "Type 2 diabetes"],
    balanceCents: 4500,
    primaryProvider: "Dr. Alan Chu",
  },
  {
    id: "p2",
    mrn: "00519004",
    name: "James O'Connor",
    dob: "1990-11-30",
    sex: "M",
    phone: "(415) 555-0199",
    insurer: "Aetna",
    lastVisit: "2026-06-18",
    nextAppointment: "2026-10-04T09:30:00",
    recallMonths: 6,
    balanceCents: 0,
    primaryProvider: "Dr. Priya Shah",
  },
  {
    id: "p3",
    mrn: "00377251",
    name: "Aiko Tanaka",
    dob: "2015-05-09",
    sex: "F",
    phone: "(628) 555-0144",
    insurer: "Medicaid",
    lastVisit: "2026-02-11",
    recallMonths: 6,
    allergies: ["Peanuts"],
    conditions: ["Asthma"],
    primaryProvider: "Dr. Priya Shah",
  },
  {
    id: "p4",
    mrn: "00601388",
    name: "Robert Hayes",
    dob: "1952-07-21",
    sex: "M",
    phone: "(415) 555-0170",
    insurer: "Medicare",
    lastVisit: "2026-09-01",
    recallMonths: 3,
    conditions: ["Atrial fibrillation"],
    balanceCents: 12850,
    primaryProvider: "Dr. Alan Chu",
  },
  {
    id: "p5",
    mrn: "00644120",
    name: "Fatima Noor",
    dob: "1985-01-03",
    sex: "F",
    phone: "(510) 555-0118",
    lastVisit: "2024-12-12",
    balanceCents: 2000,
  },
];

export default function Example() {
  return (
    <ClinicPatients
      className="w-[980px]"
      patients={patients}
      now={new Date("2026-09-28T10:00:00")}
      onBook={(p) => console.log("book", p.name)}
    />
  );
}
