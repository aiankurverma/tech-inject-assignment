import { SaasHealth, type HealthAccount } from "@/components/crm/saas-health";

const accounts: HealthAccount[] = [
  {
    id: "a1",
    name: "Acme Robotics",
    arr: 186000,
    factors: { usage: 91, adoption: 78, support: 70, sentiment: 82, billing: 100 },
    history: [76, 78, 80, 79, 83, 84, 85, 86],
  },
  {
    id: "a2",
    name: "Lumen Analytics",
    arr: 42000,
    factors: { usage: 28, adoption: 35, support: 22, sentiment: 40, billing: 90 },
    history: [62, 58, 55, 50, 46, 41, 38, 36],
  },
  {
    id: "a3",
    name: "Fernbrook Legal",
    arr: 28800,
    factors: { usage: 84, adoption: 66, support: 88, sentiment: 71, billing: 100 },
    history: [70, 71, 73, 74, 76, 78, 80, 81],
  },
  {
    id: "a4",
    name: "Quill & Co",
    arr: 5400,
    factors: { usage: 35, adoption: 52, support: 95, sentiment: 60, billing: 40 },
    history: [58, 57, 55, 53, 51, 50, 49, 48],
  },
  {
    id: "a5",
    name: "Meridian Freight",
    arr: 124000,
    factors: { usage: 72, adoption: 48, support: 55, sentiment: 64, billing: 100 },
    history: [60, 62, 63, 66, 65, 67, 68, 68],
  },
];

export default function Example() {
  return <SaasHealth className="w-[1100px]" accounts={accounts} />;
}
