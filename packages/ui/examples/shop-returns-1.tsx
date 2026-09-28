import { ShopReturns, type ReturnRequest } from "@/components/crm/shop-returns";

const returns: ReturnRequest[] = [
  {
    id: "RMA-10482",
    orderId: "#58213",
    customer: "Priya Natarajan",
    email: "priya.n@fastmail.com",
    deliveredAt: "2026-09-12",
    requestedAt: "2026-09-24",
    status: "requested",
    resolution: "refund",
    shipping: 8.95,
    lines: [
      {
        sku: "TRL-RUN-42-BLU",
        name: "Trailblaze Runner, EU 42",
        qty: 1,
        unitPrice: 139,
        reason: "Runs half a size small",
        condition: "like_new",
      },
    ],
  },
  {
    id: "RMA-10479",
    orderId: "#58140",
    customer: "Marcus Oyelaran",
    email: "marcus@oyelaran.co",
    deliveredAt: "2026-09-05",
    requestedAt: "2026-09-21",
    status: "requested",
    resolution: "refund",
    shipping: 12.5,
    lines: [
      {
        sku: "KET-ELC-17-SS",
        name: "Pour-over electric kettle",
        qty: 1,
        unitPrice: 89,
        reason: "Stopped heating after 3 uses",
        condition: "defective",
      },
      {
        sku: "FLT-PAP-100",
        name: "Paper filters (100)",
        qty: 2,
        unitPrice: 9.5,
        reason: "Returning with kettle",
        condition: "unopened",
      },
    ],
  },
  {
    id: "RMA-10471",
    orderId: "#57902",
    customer: "Hannah Becker",
    email: "h.becker@posteo.de",
    deliveredAt: "2026-08-10",
    requestedAt: "2026-09-19",
    status: "requested",
    resolution: "store_credit",
    lines: [
      {
        sku: "JKT-WAX-M-OLV",
        name: "Waxed field jacket, M",
        qty: 1,
        unitPrice: 245,
        reason: "Changed mind",
        condition: "like_new",
      },
    ],
  },
  {
    id: "RMA-10466",
    orderId: "#57811",
    customer: "Diego Alvarez",
    email: "diego.alvarez@gmail.com",
    deliveredAt: "2026-09-01",
    requestedAt: "2026-09-15",
    status: "approved",
    resolution: "exchange",
    lines: [
      {
        sku: "TEE-ORG-L-BLK",
        name: "Organic cotton tee, L",
        qty: 3,
        unitPrice: 32,
        reason: "Wrong size ordered",
        condition: "unopened",
      },
    ],
  },
  {
    id: "RMA-10458",
    orderId: "#57655",
    customer: "Aiko Tanaka",
    email: "aiko.t@proton.me",
    deliveredAt: "2026-08-28",
    requestedAt: "2026-09-09",
    status: "received",
    resolution: "refund",
    lines: [
      {
        sku: "LMP-DSK-OAK",
        name: "Oak desk lamp",
        qty: 1,
        unitPrice: 118,
        reason: "Arrived with cracked base",
        condition: "damaged",
      },
    ],
  },
  {
    id: "RMA-10441",
    orderId: "#57320",
    customer: "Tom Whitfield",
    email: "tom.whitfield@outlook.com",
    deliveredAt: "2026-08-15",
    requestedAt: "2026-08-29",
    status: "refunded",
    resolution: "refund",
    lines: [
      {
        sku: "BAG-CNV-TOTE",
        name: "Canvas tote",
        qty: 1,
        unitPrice: 48,
        reason: "Colour differs from photos",
        condition: "unopened",
      },
    ],
  },
];

export default function Example() {
  return (
    <ShopReturns
      className="w-full max-w-[980px]"
      returns={returns}
      now={new Date("2026-09-28T10:00:00Z")}
      onStatusChange={(id, status, refund) => console.log(id, status, refund)}
    />
  );
}
