import { HotelDashboard, type HotelNight } from "@/components/crm/hotel-dashboard";

const sold = [
  96, 102, 110, 118, 115, 99, 88, 94, 104, 112, 117, 119, 101, 90, 86, 97, 108, 116, 120, 114, 92,
];
const adr = [
  182, 185, 196, 214, 209, 178, 169, 184, 191, 203, 221, 236, 188, 172, 170, 186, 199, 224, 249,
  230, 181,
];
const nights: HotelNight[] = sold.map((s, i) => {
  const d = new Date(Date.UTC(2026, 8, 18 + i));
  return { date: d.toISOString().slice(0, 10), roomsSold: s, revenue: s * (adr[i] ?? 0) * 100 };
});

export default function Example() {
  return (
    <div className="w-full max-w-6xl">
      <HotelDashboard
        propertyName="Harbourview Hotel & Suites"
        totalRooms={120}
        nights={nights}
        today="2026-09-28"
        roomTypes={[
          { name: "Twin Standard", total: 40, sold: 33 },
          { name: "King Deluxe", total: 52, sold: 47, outOfOrder: 1 },
          { name: "Junior Suite", total: 22, sold: 20 },
          { name: "Penthouse", total: 6, sold: 4 },
        ]}
        channels={[
          { name: "Direct", roomNights: 412 },
          { name: "Booking.com", roomNights: 298 },
          { name: "Expedia", roomNights: 176 },
          { name: "Corporate", roomNights: 141 },
          { name: "Travel agent", roomNights: 63 },
        ]}
        movements={[
          {
            id: "a1",
            guest: "Priya Raman",
            room: "412",
            kind: "arrival",
            eta: "13:30",
            done: true,
          },
          { id: "a2", guest: "Marcus Webb", kind: "arrival", eta: "15:00" },
          { id: "a3", guest: "Grace Liu", room: "501", kind: "arrival", eta: "16:45", vip: true },
          { id: "a4", guest: "Tom Alvarez", room: "118", kind: "arrival", eta: "19:10" },
          {
            id: "d1",
            guest: "Elena Sokolova",
            room: "305",
            kind: "departure",
            eta: "11:00",
            vip: true,
          },
          {
            id: "d2",
            guest: "Daniel Okafor",
            room: "208",
            kind: "departure",
            eta: "10:15",
            done: true,
          },
        ]}
      />
    </div>
  );
}
