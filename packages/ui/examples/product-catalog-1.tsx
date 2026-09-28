import * as React from "react";
import {
  ProductCatalog,
  type CatalogProduct,
  type CatalogSelection,
} from "@/components/crm/product-catalog";

const products: CatalogProduct[] = [
  {
    id: "p1",
    sku: "PLT-PRO-M",
    name: "Platform Pro seat",
    category: "Licenses",
    price: 49,
    interval: "month",
    description: "Full CRM access, automations and reporting.",
  },
  {
    id: "p2",
    sku: "PLT-ENT-Y",
    name: "Platform Enterprise seat",
    category: "Licenses",
    price: 1188,
    interval: "year",
    description: "SSO, audit log, sandbox and 99.9% SLA.",
  },
  {
    id: "p3",
    sku: "ADD-DIAL",
    name: "Power Dialer add-on",
    category: "Add-ons",
    price: 25,
    interval: "month",
  },
  {
    id: "p4",
    sku: "ADD-AI",
    name: "Conversation Intelligence",
    category: "Add-ons",
    price: 35,
    interval: "month",
  },
  {
    id: "p5",
    sku: "SVC-ONB",
    name: "Guided onboarding (20h)",
    category: "Services",
    price: 3500,
    description: "Data migration, pipeline setup and admin training.",
  },
  { id: "p6", sku: "SVC-TRN", name: "Team training day", category: "Services", price: 1800 },
  {
    id: "p7",
    sku: "HW-HDST",
    name: "USB headset (noise-cancel)",
    category: "Hardware",
    price: 89,
    stock: 42,
  },
  {
    id: "p8",
    sku: "HW-DESK",
    name: "Desk phone VX-200",
    category: "Hardware",
    price: 149,
    stock: 6,
    lowStockAt: 8,
  },
  {
    id: "p9",
    sku: "HW-CAM",
    name: "Conference camera 4K",
    category: "Hardware",
    price: 649,
    stock: 0,
  },
  {
    id: "p10",
    sku: "PLT-STD-M",
    name: "Platform Starter seat (legacy)",
    category: "Licenses",
    price: 19,
    interval: "month",
    archived: true,
  },
];

export default function Example() {
  const [selection, setSelection] = React.useState<CatalogSelection[]>([
    { productId: "p1", quantity: 25 },
  ]);
  return (
    <div className="w-full max-w-[960px]">
      <ProductCatalog
        products={products}
        selection={selection}
        onSelectionChange={setSelection}
        onAddToQuote={(s) => console.log("add to quote", s)}
      />
    </div>
  );
}
