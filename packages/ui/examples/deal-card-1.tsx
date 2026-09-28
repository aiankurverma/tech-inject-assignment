import { DealCard } from "@/components/crm/deal-card";

export default function Example() {
  return (
    <div className="grid w-[560px] grid-cols-2 gap-2">
      <DealCard
        deal={{
          id: "d1",
          title: "Enterprise renewal",
          company: "LVMH",
          amount: 530111,
          probability: 80,
          closeDate: "Oct 14",
          owner: { name: "Maya Chen" },
          tag: { label: "Hot", color: "red" },
        }}
        onOpen={() => {}}
      />
      <DealCard
        deal={{
          id: "d2",
          title: "Pilot – 50 seats",
          company: "Dinosaur Labs",
          amount: 42000,
          probability: 35,
          closeDate: "Sep 20",
          overdue: true,
          owner: { name: "Leo Park" },
        }}
        onOpen={() => {}}
        selected
      />
    </div>
  );
}
