import { NpVolunteers, type Volunteer, type VolunteerShift } from "@/components/crm/np-volunteers";

const volunteers: Volunteer[] = [
  {
    id: "v1",
    name: "Ana Souza",
    skills: ["Food handling", "Spanish"],
    availability: ["Sat", "Sun"],
    hoursYtd: 86,
    backgroundCheckExpires: "2027-03-01",
  },
  {
    id: "v2",
    name: "Derek Owens",
    skills: ["Forklift", "Driving"],
    availability: ["Tue", "Thu", "Sat"],
    hoursYtd: 142,
  },
  {
    id: "v3",
    name: "Fatima Zahra",
    skills: ["Tutoring", "Arabic", "Food handling"],
    availability: ["Mon", "Wed", "Sat"],
    hoursYtd: 54,
    backgroundCheckExpires: "2026-10-01",
  },
  {
    id: "v4",
    name: "Ben Kowalski",
    skills: ["Tutoring"],
    availability: ["Wed", "Thu"],
    hoursYtd: 12,
    backgroundCheckExpires: "2028-01-15",
  },
  {
    id: "v5",
    name: "Lucy Nakamura",
    skills: ["Food handling", "First aid"],
    availability: ["Sat"],
    hoursYtd: 210,
    backgroundCheckExpires: "2027-07-20",
  },
  {
    id: "v6",
    name: "Omar Haddad",
    skills: ["Driving"],
    availability: ["Sat", "Sun"],
    hoursYtd: 33,
  },
];

const shifts: VolunteerShift[] = [
  {
    id: "s1",
    role: "Pantry sorting",
    location: "Warehouse",
    date: "2026-10-03",
    startHour: 9,
    hours: 3,
    capacity: 6,
    requiredSkill: "Food handling",
    volunteerIds: ["v1", "v5"],
  },
  {
    id: "s2",
    role: "Home delivery driver",
    location: "Warehouse dock",
    date: "2026-10-03",
    startHour: 11,
    hours: 3,
    capacity: 3,
    requiredSkill: "Driving",
    volunteerIds: ["v2"],
  },
  {
    id: "s3",
    role: "After-school reading buddy",
    location: "Eastside Library",
    date: "2026-10-07",
    startHour: 15.5,
    hours: 2,
    capacity: 4,
    requiredSkill: "Tutoring",
    requiresCheck: true,
    volunteerIds: [],
  },
  {
    id: "s4",
    role: "Mobile pantry setup",
    location: "Lincoln Park lot",
    date: "2026-10-04",
    startHour: 8,
    hours: 4,
    capacity: 5,
    volunteerIds: ["v6"],
  },
];

export default function Example() {
  return (
    <NpVolunteers
      className="w-full max-w-[1040px]"
      volunteers={volunteers}
      shifts={shifts}
      now={new Date("2026-09-28")}
    />
  );
}
