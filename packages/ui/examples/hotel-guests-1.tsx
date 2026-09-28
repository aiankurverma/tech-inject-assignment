import { HotelGuests, type HotelGuest } from "@/components/crm/hotel-guests";

const guests: HotelGuest[] = [
  {
    id: "g1",
    name: "Elena Sokolova",
    email: "elena.sokolova@northwind.io",
    phone: "+44 20 7946 0321",
    country: "United Kingdom",
    tier: "platinum",
    vip: true,
    inHouse: true,
    preferences: ["High floor", "Feather-free pillows", "Late checkout"],
    alerts: ["Severe nut allergy", "Travelling with infant — crib requested"],
    stays: [
      { checkIn: "2026-09-25", nights: 3, room: "305", spend: 96400 },
      { checkIn: "2026-05-11", nights: 4, room: "501", spend: 268000 },
      { checkIn: "2025-12-19", nights: 2, room: "305", spend: 61200 },
    ],
  },
  {
    id: "g2",
    name: "Daniel Okafor",
    email: "d.okafor@helixlabs.com",
    phone: "+1 415 555 0142",
    country: "United States",
    tier: "gold",
    inHouse: true,
    preferences: ["Quiet room", "Gym access 6am"],
    stays: [
      { checkIn: "2026-09-26", nights: 2, room: "208", spend: 38900 },
      { checkIn: "2026-07-02", nights: 3, room: "210", spend: 55800 },
    ],
  },
  {
    id: "g3",
    name: "Priya Raman",
    email: "priya.raman@gmail.com",
    country: "India",
    tier: "silver",
    preferences: ["Vegetarian breakfast"],
    stays: [{ checkIn: "2026-03-14", nights: 2, room: "412", spend: 41300 }],
  },
  {
    id: "g4",
    name: "Grace Liu",
    email: "grace@liuventures.com",
    phone: "+65 6555 0199",
    country: "Singapore",
    tier: "platinum",
    vip: true,
    preferences: ["Airport limo", "Champagne on arrival"],
    stays: [
      { checkIn: "2026-09-20", nights: 4, room: "501", spend: 289500 },
      { checkIn: "2026-01-08", nights: 5, room: "501", spend: 342000 },
    ],
  },
  {
    id: "g5",
    name: "Marcus Webb",
    email: "marcus.webb@outlook.com",
    country: "Canada",
    tier: "none",
    stays: [],
  },
];

export default function Example() {
  return (
    <div className="w-full max-w-4xl">
      <HotelGuests guests={guests} />
    </div>
  );
}
