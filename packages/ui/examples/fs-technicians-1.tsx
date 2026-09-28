import { FsTechnicians, type FieldTechnician } from "@/components/crm/fs-technicians";

const technicians: FieldTechnician[] = [
  {
    id: "t1",
    name: "Rosa Delgado",
    region: "North",
    status: "online",
    skills: ["HVAC", "Maintenance", "Boilers"],
    certifications: [
      { name: "EPA 608 Universal", expires: "2029-04-01" },
      { name: "NATE Heat Pump", expires: "2026-10-15" },
    ],
    bookedMin: 420,
    capacityMin: 480,
    jobsCompleted30d: 64,
    firstTimeFixes30d: 57,
    rating: 4.9,
    callbacks30d: 2,
  },
  {
    id: "t2",
    name: "Kwame Mensah",
    region: "Downtown",
    status: "busy",
    skills: ["Refrigeration", "HVAC"],
    certifications: [
      { name: "EPA 608 Universal", expires: "2028-01-20" },
      { name: "Refrigerant handling (state)", expires: "2026-09-01" },
    ],
    bookedMin: 510,
    capacityMin: 480,
    jobsCompleted30d: 58,
    firstTimeFixes30d: 46,
    rating: 4.7,
    callbacks30d: 5,
  },
  {
    id: "t3",
    name: "Liam O'Connor",
    region: "South",
    status: "online",
    skills: ["Plumbing", "Backflow"],
    certifications: [
      { name: "Journeyman Plumber", expires: "2027-06-30" },
      { name: "Backflow Tester", expires: "2027-02-11" },
    ],
    bookedMin: 300,
    capacityMin: 480,
    jobsCompleted30d: 49,
    firstTimeFixes30d: 44,
    rating: 4.8,
    callbacks30d: 1,
  },
  {
    id: "t4",
    name: "Mei Chen",
    region: "North",
    status: "away",
    skills: ["HVAC", "Electrical", "Controls"],
    certifications: [
      { name: "Licensed Electrician", expires: "2026-10-20" },
      { name: "BACnet Controls", expires: "2027-12-01" },
    ],
    bookedMin: 180,
    capacityMin: 480,
    jobsCompleted30d: 31,
    firstTimeFixes30d: 21,
    rating: 4.4,
    callbacks30d: 7,
  },
  {
    id: "t5",
    name: "Samir Haddad",
    region: "Downtown",
    status: "offline",
    skills: ["Electrical", "Generators"],
    certifications: [{ name: "Licensed Electrician", expires: "2028-08-08" }],
    bookedMin: 0,
    capacityMin: 480,
    jobsCompleted30d: 40,
    firstTimeFixes30d: 36,
    rating: 4.6,
    callbacks30d: 3,
  },
];

export default function Example() {
  return (
    <FsTechnicians
      className="w-full max-w-[960px]"
      technicians={technicians}
      now={new Date("2026-09-28")}
    />
  );
}
