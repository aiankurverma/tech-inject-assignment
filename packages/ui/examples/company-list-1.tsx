import * as React from "react";
import { CompanyList, type CompanyRow } from "@/components/crm/company-list";

const companies: CompanyRow[] = [
  {
    id: "c1",
    name: "LVMH",
    domain: "lvmh.com",
    industry: "Retail",
    tier: "Enterprise",
    employees: 213000,
    arr: 1240000,
    health: 82,
    owner: "Maya Chen",
    lastActivity: "2026-09-26",
    arrTrend: [8, 9, 9, 10, 11, 12],
  },
  {
    id: "c2",
    name: "Wayne Enterprises",
    domain: "wayne.co",
    industry: "Manufacturing",
    tier: "Enterprise",
    employees: 48000,
    arr: 890000,
    health: 64,
    owner: "Maya Chen",
    lastActivity: "2026-09-21",
    arrTrend: [6, 6, 7, 7, 8, 9],
  },
  {
    id: "c3",
    name: "Stark Industries",
    domain: "stark.io",
    industry: "Manufacturing",
    tier: "Enterprise",
    employees: 31000,
    arr: 410000,
    health: 33,
    owner: "Leo Park",
    lastActivity: "2026-08-12",
    arrTrend: [9, 8, 7, 6, 5, 4],
  },
  {
    id: "c4",
    name: "Initech",
    domain: "initech.com",
    industry: "Software",
    tier: "Mid-market",
    employees: 850,
    arr: 96000,
    health: 71,
    owner: "Priya Nair",
    lastActivity: "2026-09-27",
    arrTrend: [3, 4, 4, 5, 5, 6],
  },
  {
    id: "c5",
    name: "Globex",
    domain: "globex.net",
    industry: "Logistics",
    tier: "Mid-market",
    employees: 1200,
    arr: 128000,
    health: 58,
    owner: "Priya Nair",
    lastActivity: "2026-09-02",
    arrTrend: [5, 5, 5, 5, 5, 5],
  },
  {
    id: "c6",
    name: "Dinosaur Labs",
    domain: "dinolabs.ai",
    industry: "Software",
    tier: "SMB",
    employees: 64,
    arr: 42000,
    health: 88,
    owner: "Leo Park",
    lastActivity: "2026-09-28",
    arrTrend: [1, 2, 3, 3, 4, 5],
  },
  {
    id: "c7",
    name: "Umbrella Corp",
    domain: "umbrella.com",
    industry: "Healthcare",
    tier: "Enterprise",
    employees: 76000,
    arr: 520000,
    health: 29,
    owner: "Maya Chen",
    lastActivity: "2026-07-30",
    arrTrend: [7, 7, 6, 6, 5, 5],
  },
  {
    id: "c8",
    name: "Northwind Traders",
    domain: "northwind.com",
    industry: "Logistics",
    tier: "SMB",
    employees: 140,
    arr: 18400,
    health: 47,
    owner: "Jonas Weber",
    lastActivity: "2026-09-15",
  },
  {
    id: "c9",
    name: "Hooli",
    domain: "hooli.xyz",
    industry: "Software",
    tier: "Enterprise",
    employees: 22000,
    arr: 760000,
    health: 76,
    owner: "Jonas Weber",
    lastActivity: "2026-09-24",
    arrTrend: [6, 7, 7, 8, 8, 9],
  },
  {
    id: "c10",
    name: "Soylent Health",
    domain: "soylent.health",
    industry: "Healthcare",
    tier: "Mid-market",
    employees: 430,
    arr: 67000,
    health: 52,
    owner: "Priya Nair",
    lastActivity: "2026-08-25",
    arrTrend: [4, 4, 4, 3, 4, 4],
  },
  {
    id: "c11",
    name: "Vandelay Imports",
    domain: "vandelay.com",
    industry: "Retail",
    tier: "SMB",
    employees: 38,
    arr: 9600,
    health: 91,
    owner: "Leo Park",
    lastActivity: "2026-09-19",
  },
];

export default function Example() {
  const [selected, setSelected] = React.useState<string[]>([]);
  return (
    <div className="flex w-full max-w-[1200px] flex-col gap-2">
      <CompanyList
        companies={companies}
        today="2026-09-28"
        pageSize={8}
        selected={selected}
        onSelectedChange={setSelected}
      />
      <p className="text-xs text-crm-subtle">
        {selected.length} accounts selected for the QBR list
      </p>
    </div>
  );
}
