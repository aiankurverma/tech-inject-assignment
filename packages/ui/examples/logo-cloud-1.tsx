import { LogoCloud, type CloudLogo } from "@/components/crm/logo-cloud";

const logos: CloudLogo[] = [
  {
    id: "1",
    name: "Northwind Freight",
    industry: "Logistics",
    metric: "+38% win rate",
    href: "#northwind",
  },
  {
    id: "2",
    name: "Helio Health",
    industry: "Healthcare",
    metric: "2.1x faster onboarding",
    href: "#helio",
  },
  { id: "3", name: "Brightline Capital", industry: "Finance", metric: "$4.2M pipeline recovered" },
  { id: "4", name: "Quanta Labs", industry: "SaaS", metric: "-41% churn", href: "#quanta" },
  { id: "5", name: "Arcadia Retail", industry: "Retail", metric: "18 stores live" },
  { id: "6", name: "Meridian Care", industry: "Healthcare", metric: "HIPAA-ready in 3 weeks" },
  { id: "7", name: "Vela Analytics", industry: "SaaS", metric: "+27% expansion revenue" },
  { id: "8", name: "Portside Shipping", industry: "Logistics", metric: "600 reps migrated" },
  { id: "9", name: "Ledgerly", industry: "Finance", metric: "Close time down 6 days" },
  { id: "10", name: "Stackwise", industry: "SaaS", metric: "SLA hit rate 99.2%" },
  { id: "11", name: "Cobalt Outdoor", industry: "Retail", metric: "+22% repeat orders" },
  { id: "12", name: "Tidal Insurance", industry: "Finance", metric: "Quote-to-bind 3x" },
  { id: "13", name: "Kestrel Robotics", industry: "SaaS", metric: "Global rollout in 30 days" },
  { id: "14", name: "Summit Clinics", industry: "Healthcare", metric: "No-shows down 33%" },
];

export default function Example() {
  return (
    <div className="flex w-full max-w-4xl flex-col gap-10">
      <LogoCloud logos={logos} filterable max={8} columns={4} />
      <LogoCloud logos={logos} variant="marquee" title="Loved by 2,400+ sales teams" />
    </div>
  );
}
