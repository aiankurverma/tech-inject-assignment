import { HotelHousekeeping, type HousekeepingRoom } from "@/components/crm/hotel-housekeeping";

const rooms: HousekeepingRoom[] = [
  {
    number: "101",
    floor: 1,
    type: "TWN",
    status: "inspected",
    occupancy: "vacant",
    attendant: "Rosa",
  },
  {
    number: "102",
    floor: 1,
    type: "TWN",
    status: "dirty",
    occupancy: "departure",
    attendant: "Rosa",
  },
  {
    number: "103",
    floor: 1,
    type: "KNG",
    status: "dirty",
    occupancy: "arrival",
    dueBy: "14:00",
    note: "VIP — amenity tray",
  },
  {
    number: "104",
    floor: 1,
    type: "KNG",
    status: "out-of-order",
    occupancy: "vacant",
    note: "AC compressor replacement",
  },
  {
    number: "201",
    floor: 2,
    type: "KNG",
    status: "cleaning",
    occupancy: "arrival",
    attendant: "Aiyana",
    dueBy: "15:00",
  },
  {
    number: "202",
    floor: 2,
    type: "KNG",
    status: "clean",
    occupancy: "occupied",
    attendant: "Aiyana",
  },
  {
    number: "203",
    floor: 2,
    type: "TWN",
    status: "dirty",
    occupancy: "occupied",
    attendant: "Aiyana",
    note: "DND until 11:00",
  },
  {
    number: "208",
    floor: 2,
    type: "KNG",
    status: "dirty",
    occupancy: "departure",
    attendant: "Rosa",
  },
  {
    number: "305",
    floor: 3,
    type: "JRS",
    status: "dirty",
    occupancy: "departure",
    attendant: "Minh",
  },
  {
    number: "306",
    floor: 3,
    type: "JRS",
    status: "clean",
    occupancy: "arrival",
    attendant: "Minh",
    dueBy: "13:00",
  },
  {
    number: "307",
    floor: 3,
    type: "KNG",
    status: "inspected",
    occupancy: "vacant",
    attendant: "Minh",
  },
  {
    number: "501",
    floor: 5,
    type: "PH",
    status: "dirty",
    occupancy: "departure",
    attendant: "Minh",
    note: "Deep clean after 4-night stay",
  },
];

export default function Example() {
  return (
    <div className="w-full max-w-5xl">
      <HotelHousekeeping
        rooms={rooms}
        attendants={["Rosa", "Aiyana", "Minh", "Joseph"]}
        credits={{ TWN: 1, KNG: 1, JRS: 1.5, PH: 3 }}
      />
    </div>
  );
}
