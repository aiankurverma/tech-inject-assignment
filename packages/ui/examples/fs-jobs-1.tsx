import { FsJobs, type FieldJob } from "@/components/crm/fs-jobs";

const technicians = [
  { id: "t1", name: "Rosa Delgado" },
  { id: "t2", name: "Kwame Mensah" },
  { id: "t3", name: "Liam O'Connor" },
  { id: "t4", name: "Mei Chen" },
];

const jobs: FieldJob[] = [
  {
    id: "WO-2291",
    title: "No heat — boiler lockout",
    customer: "Harbor View Apartments",
    address: "118 Pier St, Unit 4B",
    type: "HVAC",
    priority: "emergency",
    status: "new",
    createdAt: "2026-09-28T07:40:00Z",
    estimateMin: 120,
  },
  {
    id: "WO-2288",
    title: "Walk-in freezer above -10°F",
    customer: "Luca's Trattoria",
    address: "42 Market Ave",
    type: "Refrigeration",
    priority: "high",
    status: "en_route",
    technicianId: "t2",
    createdAt: "2026-09-27T16:05:00Z",
    estimateMin: 90,
  },
  {
    id: "WO-2284",
    title: "Annual rooftop unit PM (3 units)",
    customer: "Northgate Medical Plaza",
    address: "900 Northgate Blvd",
    type: "Maintenance",
    priority: "normal",
    status: "scheduled",
    technicianId: "t1",
    createdAt: "2026-09-25T13:00:00Z",
    estimateMin: 240,
  },
  {
    id: "WO-2280",
    title: "Thermostat replacement",
    customer: "Jordan Ellis",
    address: "7 Willow Ct",
    type: "HVAC",
    priority: "low",
    status: "new",
    createdAt: "2026-09-24T09:30:00Z",
    estimateMin: 45,
  },
  {
    id: "WO-2277",
    title: "Water heater leaking at relief valve",
    customer: "Sunrise Daycare",
    address: "55 Elm St",
    type: "Plumbing",
    priority: "high",
    status: "on_site",
    technicianId: "t3",
    createdAt: "2026-09-27T08:15:00Z",
    estimateMin: 75,
  },
  {
    id: "WO-2270",
    title: "Condensate pump alarm",
    customer: "Brightline Offices",
    address: "300 Commerce Dr, Fl 6",
    type: "HVAC",
    priority: "normal",
    status: "on_hold",
    technicianId: "t4",
    createdAt: "2026-09-23T11:00:00Z",
    estimateMin: 60,
  },
  {
    id: "WO-2262",
    title: "Ice machine descale",
    customer: "Luca's Trattoria",
    address: "42 Market Ave",
    type: "Refrigeration",
    priority: "normal",
    status: "completed",
    technicianId: "t2",
    createdAt: "2026-09-22T10:00:00Z",
    estimateMin: 60,
  },
];

export default function Example() {
  return (
    <FsJobs
      className="w-full max-w-[1000px]"
      jobs={jobs}
      technicians={technicians}
      now={new Date("2026-09-28T10:00:00Z")}
      onAssign={(ids, tech) => console.log("assign", ids, tech)}
    />
  );
}
