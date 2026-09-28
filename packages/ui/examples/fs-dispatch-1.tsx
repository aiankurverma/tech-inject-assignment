import { FsDispatch, type DispatchJob, type DispatchTech } from "@/components/crm/fs-dispatch";

const technicians: DispatchTech[] = [
  {
    id: "t1",
    name: "Rosa Delgado",
    skills: ["HVAC", "Maintenance"],
    shiftStart: 7,
    shiftEnd: 15.5,
  },
  {
    id: "t2",
    name: "Kwame Mensah",
    skills: ["Refrigeration", "HVAC"],
    shiftStart: 8,
    shiftEnd: 17,
  },
  { id: "t3", name: "Liam O'Connor", skills: ["Plumbing"], shiftStart: 9, shiftEnd: 18 },
  { id: "t4", name: "Mei Chen", skills: ["HVAC", "Electrical"], shiftStart: 10, shiftEnd: 19 },
];

const jobs: DispatchJob[] = [
  {
    id: "WO-2291",
    title: "Boiler lockout",
    customer: "Harbor View Apts",
    skill: "HVAC",
    durationMin: 120,
    priority: "emergency",
  },
  {
    id: "WO-2280",
    title: "Thermostat swap",
    customer: "J. Ellis",
    skill: "HVAC",
    durationMin: 45,
    priority: "normal",
  },
  {
    id: "WO-2293",
    title: "Panel breaker trips",
    customer: "Kiln & Co",
    skill: "Electrical",
    durationMin: 90,
    priority: "high",
  },
  {
    id: "WO-2295",
    title: "Slow drain, 2 sinks",
    customer: "Sunrise Daycare",
    skill: "Plumbing",
    durationMin: 60,
    priority: "normal",
  },
  {
    id: "WO-2284",
    title: "RTU PM ×3",
    customer: "Northgate Medical",
    skill: "Maintenance",
    durationMin: 240,
    priority: "normal",
    technicianId: "t1",
    start: 7.5,
  },
  {
    id: "WO-2288",
    title: "Freezer warm",
    customer: "Luca's Trattoria",
    skill: "Refrigeration",
    durationMin: 90,
    priority: "high",
    technicianId: "t2",
    start: 8.5,
  },
  {
    id: "WO-2277",
    title: "Water heater leak",
    customer: "Sunrise Daycare",
    skill: "Plumbing",
    durationMin: 75,
    priority: "high",
    technicianId: "t3",
    start: 9,
  },
  {
    id: "WO-2290",
    title: "Backflow test",
    customer: "City Library",
    skill: "Plumbing",
    durationMin: 60,
    priority: "normal",
    technicianId: "t3",
    start: 10,
  },
  {
    id: "WO-2270",
    title: "Condensate pump",
    customer: "Brightline Offices",
    skill: "HVAC",
    durationMin: 60,
    priority: "normal",
    technicianId: "t4",
    start: 13,
  },
];

export default function Example() {
  return (
    <FsDispatch
      className="w-full max-w-[1180px]"
      technicians={technicians}
      jobs={jobs}
      onChange={(next) => console.log(next.filter((j) => j.technicianId).length, "scheduled")}
    />
  );
}
