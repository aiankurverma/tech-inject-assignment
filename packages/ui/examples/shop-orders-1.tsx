import * as React from "react";
import { ShopOrders, type ShopOrder } from "@/components/crm/shop-orders";

const initial: ShopOrder[] = [
  {
    id: "o1",
    number: "#10482",
    customer: "Maya Thompson",
    placedAt: "2026-09-28T09:14:00",
    channel: "online",
    payment: "paid",
    fulfillment: "unfulfilled",
    taxRate: 0.0825,
    shipping: 6.95,
    discount: 10,
    risk: "low",
    lines: [
      {
        sku: "TEE-ORG-M-BLK",
        title: "Organic cotton tee",
        variant: "M / Black",
        qty: 2,
        unitPrice: 32,
      },
      { sku: "CAP-WAX-OLV", title: "Waxed canvas cap", variant: "Olive", qty: 1, unitPrice: 38 },
    ],
  },
  {
    id: "o2",
    number: "#10479",
    customer: "Daniel Okafor",
    placedAt: "2026-09-25T16:40:00",
    channel: "online",
    payment: "paid",
    fulfillment: "partial",
    taxRate: 0.1025,
    shipping: 0,
    risk: "medium",
    lines: [
      { sku: "JKT-CHR-L-NVY", title: "Chore jacket", variant: "L / Navy", qty: 1, unitPrice: 148 },
      { sku: "SCK-MER-3PK", title: "Merino socks 3-pack", qty: 2, unitPrice: 24 },
    ],
  },
  {
    id: "o3",
    number: "#10477",
    customer: "Grace Kim",
    placedAt: "2026-09-27T21:05:00",
    channel: "online",
    payment: "pending",
    fulfillment: "unfulfilled",
    taxRate: 0.089,
    shipping: 6.95,
    lines: [{ sku: "TOTE-CNV-NAT", title: "Canvas tote", qty: 1, unitPrice: 45 }],
  },
  {
    id: "o4",
    number: "#10471",
    customer: "J. Anonymous",
    placedAt: "2026-09-27T03:12:00",
    channel: "online",
    payment: "paid",
    fulfillment: "unfulfilled",
    shipping: 24,
    risk: "high",
    taxRate: 0.06,
    lines: [
      { sku: "JKT-CHR-M-BLK", title: "Chore jacket", variant: "M / Black", qty: 4, unitPrice: 148 },
    ],
  },
  {
    id: "o5",
    number: "#10466",
    customer: "Hana Sato",
    placedAt: "2026-09-24T11:30:00",
    channel: "pos",
    payment: "paid",
    fulfillment: "fulfilled",
    taxRate: 0.0925,
    lines: [{ sku: "BTL-STL-750", title: "Steel bottle 750ml", qty: 3, unitPrice: 29 }],
  },
  {
    id: "o6",
    number: "EU-2291",
    customer: "Chloé Bernard",
    placedAt: "2026-09-26T08:02:00",
    channel: "marketplace",
    payment: "partially-refunded",
    fulfillment: "returned",
    currency: "EUR",
    shipping: 4.5,
    lines: [
      {
        sku: "TEE-ORG-S-WHT",
        title: "Organic cotton tee",
        variant: "S / White",
        qty: 2,
        unitPrice: 29,
      },
    ],
  },
];

export default function Example() {
  const [orders, setOrders] = React.useState(initial);
  return (
    <ShopOrders
      className="w-[1040px]"
      orders={orders}
      now={new Date("2026-09-28T12:00:00")}
      onFulfill={(ids) =>
        setOrders((list) =>
          list.map((o) => (ids.includes(o.id) ? { ...o, fulfillment: "fulfilled" } : o)),
        )
      }
    />
  );
}
