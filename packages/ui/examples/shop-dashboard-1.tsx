import { ShopDashboard, type SalesChannel, type ShopOrder } from "@/components/crm/shop-dashboard";

const products = [
  { name: "Trailblaze Runner", price: 139 },
  { name: "Waxed field jacket", price: 245 },
  { name: "Organic cotton tee", price: 32 },
  { name: "Oak desk lamp", price: 118 },
  { name: "Pour-over kettle", price: 89 },
  { name: "Canvas tote", price: 48 },
  { name: "Merino beanie", price: 36 },
];
const channels: SalesChannel[] = ["web", "web", "web", "mobile", "mobile", "marketplace", "pos"];

// Deterministic pseudo-random order history for the last 180 days.
function buildOrders(): ShopOrder[] {
  const out: ShopOrder[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const end = Date.UTC(2026, 8, 28);
  for (let d = 0; d < 180; d++) {
    const date = new Date(end - d * 86_400_000).toISOString().slice(0, 10);
    const perDay = 4 + Math.floor(rnd() * 6) + (d < 30 ? 2 : 0);
    for (let i = 0; i < perDay; i++) {
      const lines = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => {
        const p = products[Math.floor(rnd() * products.length)] ?? {
          name: "Canvas tote",
          price: 48,
        };
        const qty = 1 + Math.floor(rnd() * 2);
        return { product: p.name, qty, revenue: qty * p.price };
      });
      const total = lines.reduce((s, l) => s + l.revenue, 0);
      out.push({
        id: `#${60000 - out.length}`,
        date,
        channel: channels[Math.floor(rnd() * channels.length)] ?? "web",
        customerId: `c${Math.floor(rnd() * 900)}`,
        lines,
        refunded: rnd() < 0.06 ? total : 0,
      });
    }
  }
  return out;
}

const orders = buildOrders();

export default function Example() {
  return (
    <ShopDashboard className="w-full max-w-[1080px]" orders={orders} now={new Date("2026-09-28")} />
  );
}
