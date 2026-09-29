import * as React from "react";
import {
  ProCatalogManager,
  cartesian,
  type CatalogStatus,
  type Product,
  type ProductOption,
} from "@/components/crm/pro-catalog-manager";

// Deterministic PRNG so the demo catalog is identical on every render.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const LINES: { name: string; vendor: string; base: number; options: ProductOption[] }[] = [
  {
    name: "Merino Crew Tee",
    vendor: "Northloom",
    base: 48,
    options: [
      { name: "Color", values: ["Black", "Oat", "Navy", "Sage"] },
      { name: "Size", values: ["S", "M", "L", "XL"] },
    ],
  },
  {
    name: "Trail Runner 3",
    vendor: "Kestrel Athletic",
    base: 139,
    options: [
      { name: "Color", values: ["Slate", "Ember"] },
      { name: "Size", values: ["8", "9", "10", "11", "12"] },
    ],
  },
  {
    name: "Canvas Weekender",
    vendor: "Harbor & Pine",
    base: 165,
    options: [{ name: "Color", values: ["Olive", "Sand", "Charcoal"] }],
  },
  {
    name: "Ceramic Pour-Over Set",
    vendor: "Kiln Co.",
    base: 72,
    options: [
      { name: "Glaze", values: ["Matte White", "Speckle", "Cobalt"] },
      { name: "Size", values: ["1 cup", "4 cup"] },
    ],
  },
  {
    name: "Wool Beanie",
    vendor: "Northloom",
    base: 32,
    options: [{ name: "Color", values: ["Black", "Rust", "Heather", "Forest", "Cream"] }],
  },
  {
    name: "Chino Slim",
    vendor: "Harbor & Pine",
    base: 88,
    options: [
      { name: "Color", values: ["Khaki", "Navy"] },
      { name: "Waist", values: ["30", "32", "34", "36"] },
      { name: "Inseam", values: ["30", "32"] },
    ],
  },
  {
    name: "Insulated Bottle",
    vendor: "Summit Gear",
    base: 36,
    options: [
      { name: "Capacity", values: ["500ml", "750ml", "1L"] },
      { name: "Color", values: ["Steel", "Black", "Glacier"] },
    ],
  },
  {
    name: "Linen Duvet Cover",
    vendor: "Kiln Co.",
    base: 210,
    options: [
      { name: "Size", values: ["Twin", "Queen", "King"] },
      { name: "Color", values: ["Flax", "White", "Clay"] },
    ],
  },
];
const ADJ = [
  "Classic",
  "Everyday",
  "Studio",
  "Coastal",
  "Alpine",
  "Heritage",
  "Field",
  "Urban",
  "Essential",
  "Limited",
  "Organic",
  "Recycled",
];
const STATUS: CatalogStatus[] = ["active", "active", "active", "active", "draft", "archived"];

function buildCatalog(target = 10_000): Product[] {
  const r = rng(42);
  const products: Product[] = [];
  let variants = 0;
  for (let i = 0; variants < target; i++) {
    const line = LINES[i % LINES.length]!;
    const adj = ADJ[Math.floor(i / LINES.length) % ADJ.length]!;
    const gen = Math.floor(i / (LINES.length * ADJ.length)) + 1;
    const code = `${line.vendor.slice(0, 2).toUpperCase()}${(1000 + i).toString(36).toUpperCase()}`;
    const status = STATUS[Math.floor(r() * STATUS.length)]!;
    const price = Math.round(line.base * (0.85 + r() * 0.4)) - 0.01;
    const vs = cartesian(line.options).map((combo, k) => {
      const p = combo.Size === "XL" || combo.Size === "King" ? price + 10 : price;
      return {
        id: `v_${i}_${k}`,
        sku: [
          code,
          ...line.options.map((o) =>
            (combo[o.name] ?? "").replace(/\W/g, "").slice(0, 3).toUpperCase(),
          ),
        ].join("-"),
        options: combo,
        price: +p.toFixed(2),
        compareAt: r() < 0.25 ? +(p * 1.2).toFixed(2) : null,
        cost: +(p * (0.32 + r() * 0.2)).toFixed(2),
        stock: Math.floor(r() * r() * 400),
        status: status === "archived" ? status : r() < 0.08 ? ("draft" as const) : status,
      };
    });
    variants += vs.length;
    products.push({
      id: `p_${i}`,
      title: `${adj} ${line.name}${gen > 1 ? ` G${gen}` : ""}`,
      vendor: line.vendor,
      status,
      options: line.options,
      variants: vs,
    });
  }
  return products;
}

export default function Example() {
  const [products, setProducts] = React.useState(() => buildCatalog());
  const [log, setLog] = React.useState<string | null>(null);
  return (
    <div className="flex w-full max-w-[1240px] flex-col gap-2 p-2">
      <ProCatalogManager
        products={products}
        height={680}
        onSave={async (changes, next) => {
          await new Promise((res) => setTimeout(res, 700));
          setProducts(next);
          setLog(
            `Saved ${changes.changedCells} cells across ${changes.updated.length} products` +
              (changes.removedVariantIds.length
                ? `, removed ${changes.removedVariantIds.length} variants`
                : ""),
          );
        }}
      />
      {log && <p className="text-[12px] text-crm-muted-fg">{log}</p>}
    </div>
  );
}
