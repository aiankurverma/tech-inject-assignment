import * as React from "react";
import { ProductPicker, type CatalogProduct } from "@/components/crm/product-picker";

const catalog: CatalogProduct[] = [
  {
    id: "p1",
    name: "Growth plan licence",
    sku: "CRM-GRW-Y",
    price: 468,
    unit: "seat / year",
    category: "Licences",
  },
  {
    id: "p2",
    name: "Enterprise plan licence",
    sku: "CRM-ENT-Y",
    price: 948,
    unit: "seat / year",
    category: "Licences",
  },
  {
    id: "p3",
    name: "Advanced forecasting",
    sku: "ADD-FCST",
    price: 1200,
    unit: "per year",
    category: "Add-ons",
  },
  {
    id: "p4",
    name: "Sandbox environment",
    sku: "ADD-SBX",
    price: 600,
    unit: "per year",
    category: "Add-ons",
  },
  {
    id: "p5",
    name: "Legacy reporting pack",
    sku: "ADD-RPT-OLD",
    price: 300,
    unit: "per year",
    category: "Add-ons",
    archived: true,
  },
  {
    id: "p6",
    name: "Onboarding & data migration",
    sku: "SVC-ONB",
    price: 6500,
    unit: "one-time",
    category: "Services",
  },
  {
    id: "p7",
    name: "Admin training (remote)",
    sku: "SVC-TRN",
    price: 750,
    unit: "per session",
    category: "Services",
  },
  {
    id: "p8",
    name: "Desk phone Yealink T54W",
    sku: "HW-YLK-T54",
    price: 219,
    unit: "one-time",
    category: "Hardware",
    stock: 6,
  },
  {
    id: "p9",
    name: "USB headset Jabra Evolve2 40",
    sku: "HW-JBR-E40",
    price: 129,
    unit: "one-time",
    category: "Hardware",
    stock: 0,
  },
];

export default function Example() {
  const [added, setAdded] = React.useState<string[]>([]);
  return (
    <div className="flex w-full max-w-lg flex-col gap-2">
      <ProductPicker
        products={catalog}
        defaultValue={{ p1: 25 }}
        onConfirm={(sel) => setAdded(sel.map((s) => `${s.quantity} × ${s.product.name}`))}
      />
      {added.length ? (
        <p className="text-xs text-crm-soft">Added to Q-2026-117: {added.join(", ")}</p>
      ) : null}
    </div>
  );
}
