import * as React from "react";
import { ShopCustomers, type ShopCustomer } from "@/components/crm/shop-customers";

const customers: ShopCustomer[] = [
  {
    id: "u1",
    name: "Maya Thompson",
    email: "maya.t@fastmail.com",
    city: "Austin",
    orders: 14,
    totalSpent: 2380,
    firstOrder: "2024-03-11",
    lastOrder: "2026-09-21",
    acceptsMarketing: true,
  },
  {
    id: "u2",
    name: "Arjun Mehta",
    email: "arjun@mehta.dev",
    city: "Seattle",
    orders: 9,
    totalSpent: 1645.5,
    firstOrder: "2024-11-02",
    lastOrder: "2026-09-02",
    acceptsMarketing: true,
  },
  {
    id: "u3",
    name: "Chloé Bernard",
    email: "chloe.bernard@proton.me",
    city: "Montréal",
    orders: 1,
    totalSpent: 89,
    firstOrder: "2026-09-18",
    lastOrder: "2026-09-18",
    acceptsMarketing: true,
  },
  {
    id: "u4",
    name: "Daniel Okafor",
    email: "d.okafor@gmail.com",
    city: "Chicago",
    orders: 7,
    totalSpent: 1920,
    firstOrder: "2023-12-01",
    lastOrder: "2026-05-14",
    acceptsMarketing: false,
  },
  {
    id: "u5",
    name: "Sofia Ricci",
    email: "sofia.ricci@libero.it",
    city: "Denver",
    orders: 2,
    totalSpent: 142,
    firstOrder: "2025-02-10",
    lastOrder: "2025-07-30",
    acceptsMarketing: true,
  },
  {
    id: "u6",
    name: "Ben Cartwright",
    email: "ben@cartwright.co",
    city: "Portland",
    orders: 3,
    totalSpent: 318,
    firstOrder: "2025-08-19",
    lastOrder: "2026-06-25",
    acceptsMarketing: true,
  },
  {
    id: "u7",
    name: "Hana Sato",
    email: "hana.sato@icloud.com",
    city: "San Jose",
    orders: 11,
    totalSpent: 2975,
    firstOrder: "2024-06-05",
    lastOrder: "2026-09-26",
    acceptsMarketing: true,
  },
  {
    id: "u8",
    name: "Lucas Moreau",
    email: "lucas.m@outlook.com",
    city: "Boston",
    orders: 5,
    totalSpent: 640,
    firstOrder: "2025-01-20",
    lastOrder: "2026-08-12",
    acceptsMarketing: true,
  },
  {
    id: "u9",
    name: "Grace Kim",
    email: "gkim@yahoo.com",
    city: "Atlanta",
    orders: 1,
    totalSpent: 54,
    firstOrder: "2026-09-25",
    lastOrder: "2026-09-25",
    acceptsMarketing: false,
  },
];

export default function Example() {
  const [msg, setMsg] = React.useState("");
  return (
    <div className="flex w-[1100px] flex-col gap-2">
      <ShopCustomers
        customers={customers}
        today={new Date(2026, 8, 28)}
        onExportSegment={(seg, list) =>
          setMsg(`Sent ${list.length} ${seg} customers to the email tool`)
        }
      />
      <p className="text-xs text-crm-soft" aria-live="polite">
        {msg}
      </p>
    </div>
  );
}
