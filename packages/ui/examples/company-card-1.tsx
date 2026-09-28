import * as React from "react";
import { CompanyCard, type CompanyCardData } from "@/components/crm/company-card";

const now = new Date("2026-09-28");
const companies: CompanyCardData[] = [
  {
    id: "acc_1",
    name: "Northwind Logistics",
    domain: "northwind.io",
    industry: "Logistics",
    location: "Rotterdam, NL",
    employees: 2400,
    arr: 184000,
    currency: "EUR",
    renewalDate: "2026-10-19",
    openDeals: { count: 2, amount: 62000 },
    health: 58,
    lifecycle: "customer",
    owner: { name: "Priya Raman" },
    tags: [
      { label: "Enterprise", color: "purple" },
      { label: "EU", color: "blue" },
      { label: "Multi-year", color: "green" },
    ],
  },
  {
    id: "acc_2",
    name: "Brightline Health",
    domain: "brightlinehealth.com",
    industry: "Healthcare",
    location: "Austin, TX",
    employees: 340,
    arr: 72500,
    renewalDate: "2027-03-02",
    openDeals: { count: 1, amount: 18000 },
    health: 84,
    lifecycle: "customer",
    owner: { name: "Marcus Lee" },
    tags: [{ label: "Mid-market", color: "teal" }],
  },
  {
    id: "acc_3",
    name: "Kestrel Robotics",
    domain: "kestrel.ai",
    industry: "Manufacturing",
    location: "Pune, IN",
    employees: 120,
    lifecycle: "prospect",
    openDeals: { count: 0, amount: 0 },
    owner: { name: "Lena Fischer" },
  },
];

export default function Example() {
  const [selected, setSelected] = React.useState("acc_1");
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {companies.map((c) => (
        <CompanyCard
          key={c.id}
          company={c}
          now={now}
          selected={selected === c.id}
          onOpen={setSelected}
        />
      ))}
      {companies[0] ? <CompanyCard company={companies[0]} loading /> : null}
    </div>
  );
}
