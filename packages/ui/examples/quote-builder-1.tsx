import {
  QuoteBuilder,
  type QuoteLine,
  type QuoteProductOption,
} from "@/components/crm/quote-builder";

const products: QuoteProductOption[] = [
  { id: "p1", sku: "PLT-PRO-Y", name: "Platform Pro seat (annual)", unitPrice: 588, taxRate: 8.25 },
  { id: "p2", sku: "ADD-DIAL-Y", name: "Power Dialer (annual)", unitPrice: 300, taxRate: 8.25 },
  { id: "p3", sku: "SVC-ONB", name: "Guided onboarding (20h)", unitPrice: 3500 },
  { id: "p4", sku: "SVC-TRN", name: "Team training day", unitPrice: 1800 },
];

const lines: QuoteLine[] = [
  {
    id: "l1",
    sku: "PLT-PRO-Y",
    name: "Platform Pro seat (annual)",
    quantity: 120,
    unitPrice: 588,
    discount: 15,
    taxRate: 8.25,
  },
  {
    id: "l2",
    sku: "ADD-DIAL-Y",
    name: "Power Dialer (annual)",
    quantity: 40,
    unitPrice: 300,
    discount: 25,
    taxRate: 8.25,
  },
  {
    id: "l3",
    sku: "SVC-ONB",
    name: "Guided onboarding (20h)",
    quantity: 1,
    unitPrice: 3500,
    discount: 0,
    taxRate: 0,
  },
];

export default function Example() {
  return (
    <div className="w-full max-w-[920px]">
      <QuoteBuilder
        defaultLines={lines}
        products={products}
        maxDiscount={20}
        defaultTaxRate={8.25}
        validUntil="2026-10-31"
        onSubmit={(l, totals) => console.log("save quote", l, totals)}
      />
    </div>
  );
}
