import * as React from "react";
import { HotelReservations, type Reservation } from "@/components/crm/hotel-reservations";

const initial: Reservation[] = [
  {
    id: "RSV-24018",
    guest: "Priya Raman",
    room: "412",
    roomType: "King Deluxe",
    checkIn: "2026-09-28",
    checkOut: "2026-10-01",
    adults: 2,
    rate: 18900,
    paid: 18900,
    channel: "Direct",
    status: "confirmed",
  },
  {
    id: "RSV-24021",
    guest: "Marcus Webb",
    roomType: "Twin Standard",
    checkIn: "2026-09-28",
    checkOut: "2026-09-29",
    adults: 1,
    rate: 12900,
    paid: 0,
    channel: "Booking.com",
    status: "confirmed",
  },
  {
    id: "RSV-23990",
    guest: "Elena Sokolova",
    room: "305",
    roomType: "Junior Suite",
    checkIn: "2026-09-25",
    checkOut: "2026-09-28",
    adults: 2,
    children: 1,
    rate: 27500,
    paid: 82500,
    channel: "Expedia",
    status: "in-house",
  },
  {
    id: "RSV-23994",
    guest: "Daniel Okafor",
    room: "208",
    roomType: "King Deluxe",
    checkIn: "2026-09-26",
    checkOut: "2026-09-28",
    adults: 1,
    rate: 17900,
    paid: 20000,
    channel: "Corporate",
    status: "in-house",
  },
  {
    id: "RSV-24002",
    guest: "Hana Kobayashi",
    room: "412",
    roomType: "King Deluxe",
    checkIn: "2026-09-27",
    checkOut: "2026-09-29",
    adults: 2,
    rate: 18900,
    paid: 18900,
    channel: "Direct",
    status: "in-house",
  },
  {
    id: "RSV-24030",
    guest: "Tom Alvarez",
    room: "118",
    roomType: "Twin Standard",
    checkIn: "2026-09-30",
    checkOut: "2026-10-04",
    adults: 2,
    rate: 12900,
    paid: 12900,
    channel: "Direct",
    status: "confirmed",
  },
  {
    id: "RSV-23970",
    guest: "Grace Liu",
    room: "501",
    roomType: "Penthouse",
    checkIn: "2026-09-20",
    checkOut: "2026-09-24",
    adults: 2,
    rate: 64000,
    paid: 256000,
    channel: "Travel agent",
    status: "checked-out",
  },
  {
    id: "RSV-24011",
    guest: "Oliver Brandt",
    roomType: "King Deluxe",
    checkIn: "2026-09-28",
    checkOut: "2026-09-30",
    adults: 1,
    rate: 17900,
    paid: 0,
    channel: "Booking.com",
    status: "cancelled",
  },
];

export default function Example() {
  const [rows, setRows] = React.useState(initial);
  const set = (id: string, status: Reservation["status"]) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  return (
    <div className="w-full max-w-5xl">
      <HotelReservations
        reservations={rows}
        today="2026-09-28"
        onCheckIn={(r) => set(r.id, "in-house")}
        onCheckOut={(r) => set(r.id, "checked-out")}
        onCancel={(r) => set(r.id, "cancelled")}
      />
    </div>
  );
}
