import {
  ClinicAppointments,
  type ClinicAppointment,
  type ClinicProvider,
} from "@/components/crm/clinic-appointments";

const providers: ClinicProvider[] = [
  { id: "chu", name: "Dr. Alan Chu", specialty: "Internal medicine" },
  { id: "shah", name: "Dr. Priya Shah", specialty: "Pediatrics" },
  { id: "diaz", name: "Kim Diaz, NP", specialty: "Urgent care" },
];

const day = "2026-09-28";
const appts: ClinicAppointment[] = [
  {
    id: "a1",
    providerId: "chu",
    patient: "Robert Hayes",
    reason: "INR check",
    start: `${day}T08:30:00`,
    durationMin: 20,
    status: "completed",
  },
  {
    id: "a2",
    providerId: "chu",
    patient: "Maria Gonzalez",
    reason: "Diabetes follow-up",
    start: `${day}T09:00:00`,
    durationMin: 30,
    status: "in-room",
    checkedInAt: `${day}T08:52:00`,
  },
  {
    id: "a3",
    providerId: "chu",
    patient: "Walter Price",
    reason: "Annual physical",
    start: `${day}T09:30:00`,
    durationMin: 45,
    status: "checked-in",
    checkedInAt: `${day}T09:05:00`,
    newPatient: true,
  },
  {
    id: "a4",
    providerId: "chu",
    patient: "Helen Park",
    reason: "BP recheck",
    start: `${day}T09:45:00`,
    durationMin: 15,
    status: "scheduled",
  },
  {
    id: "a5",
    providerId: "shah",
    patient: "Aiko Tanaka",
    reason: "Asthma review",
    start: `${day}T08:00:00`,
    durationMin: 30,
    status: "no-show",
  },
  {
    id: "a6",
    providerId: "shah",
    patient: "Leo Martins",
    reason: "Well-child 4y",
    start: `${day}T09:00:00`,
    durationMin: 30,
    status: "scheduled",
  },
  {
    id: "a7",
    providerId: "shah",
    patient: "Ella Brooks",
    reason: "Ear pain",
    start: `${day}T11:00:00`,
    durationMin: 20,
    status: "scheduled",
  },
  {
    id: "a8",
    providerId: "diaz",
    patient: "Chris Novak",
    reason: "Laceration",
    start: `${day}T08:15:00`,
    durationMin: 30,
    status: "completed",
  },
  {
    id: "a9",
    providerId: "diaz",
    patient: "Fatima Noor",
    reason: "UTI symptoms",
    start: `${day}T10:00:00`,
    durationMin: 20,
    status: "scheduled",
  },
  {
    id: "a10",
    providerId: "diaz",
    patient: "Owen Reid",
    reason: "Flu shot",
    start: `${day}T13:30:00`,
    durationMin: 15,
    status: "canceled",
  },
];

export default function Example() {
  return (
    <ClinicAppointments
      className="w-[820px]"
      providers={providers}
      defaultAppointments={appts}
      now={new Date(`${day}T09:34:00`)}
      startHour={8}
      endHour={15}
    />
  );
}
