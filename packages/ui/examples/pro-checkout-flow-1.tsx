import * as React from "react";
import {
  ProCheckoutFlow,
  type CartItem,
  type CouponResult,
  type PaymentMethod,
  type ShippingOption,
} from "@/components/crm/pro-checkout-flow";

const items: CartItem[] = [
  {
    id: "kb-75",
    name: "Keychron Q1 Max",
    variant: "Carbon Black · Gateron Jupiter Brown",
    unitPrice: 21900,
    quantity: 1,
  },
  {
    id: "desk-mat",
    name: "Merino wool desk mat",
    variant: "Charcoal · 900 x 400 mm",
    unitPrice: 5900,
    quantity: 2,
  },
  {
    id: "book",
    name: "Designing Data-Intensive Applications",
    variant: "Paperback",
    unitPrice: 4499,
    quantity: 1,
    taxCategory: "reduced",
  },
  {
    id: "gift",
    name: "Gift card",
    variant: "Digital delivery",
    unitPrice: 5000,
    quantity: 1,
    taxCategory: "zero",
  },
];

const shipping: ShippingOption[] = [
  { id: "std", label: "Standard", eta: "3-5 business days", price: 900 },
  { id: "exp", label: "Express", eta: "1-2 business days", price: 2400 },
  {
    id: "eu",
    label: "DHL Europe",
    eta: "2-4 business days",
    price: 1500,
    countries: ["DE", "FR", "NL", "ES", "IT", "IE"],
  },
  {
    id: "pickup",
    label: "Pick up in Brooklyn",
    eta: "Ready tomorrow",
    price: 0,
    countries: ["US"],
  },
];

const COUPONS: Record<string, CouponResult> = {
  WELCOME10: {
    ok: true,
    coupon: { code: "WELCOME10", kind: "percent", value: 10, label: "10% off first order" },
  },
  SHIPFREE: {
    ok: true,
    coupon: { code: "SHIPFREE", kind: "free_shipping", value: 0, label: "Free shipping" },
  },
  SAVE50: {
    ok: true,
    coupon: {
      code: "SAVE50",
      kind: "fixed",
      value: 5000,
      label: "$50 off $300+",
      minSubtotal: 30000,
    },
  },
  SUMMER24: { ok: false, reason: "expired", message: "SUMMER24 expired on 31 Aug 2024." },
};

// A stand-in for a real provider element (Stripe Elements, Adyen Drop-in...). Reports readiness.
function DemoCardElement({
  setReady,
  disabled,
}: {
  setReady: (r: boolean) => void;
  disabled: boolean;
}) {
  const [card, setCard] = React.useState("");
  const [exp, setExp] = React.useState("");
  React.useEffect(() => {
    setReady(card.replace(/\s/g, "").length >= 15 && /^\d{2}\/\d{2}$/.test(exp));
  }, [card, exp, setReady]);
  const cls =
    "h-9 rounded-crm border border-crm-input bg-crm-bg px-3 text-sm text-crm-fg outline-none focus-visible:ring-2 focus-visible:ring-crm-ring";
  return (
    <div className="grid grid-cols-[1fr_96px] gap-2">
      <input
        aria-label="Card number (test)"
        placeholder="4242 4242 4242 4242"
        value={card}
        disabled={disabled}
        onChange={(e) => setCard(e.target.value)}
        className={cls}
        inputMode="numeric"
      />
      <input
        aria-label="Expiry (MM/YY)"
        placeholder="MM/YY"
        value={exp}
        disabled={disabled}
        onChange={(e) => setExp(e.target.value)}
        className={cls}
      />
      <p className="col-span-2 text-xs text-crm-muted-fg">
        Provider slot: mount your PSP element here. Nothing is charged in this demo.
      </p>
    </div>
  );
}

const payments: PaymentMethod[] = [
  {
    id: "card",
    label: "Card",
    description: "Visa, Mastercard, Amex",
    render: (ctx) => <DemoCardElement setReady={ctx.setReady} disabled={ctx.disabled} />,
  },
  { id: "invoice", label: "Pay by invoice", description: "Net 30 for approved business accounts" },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Example() {
  return (
    <div className="bg-crm-bg p-4">
      <ProCheckoutFlow
        items={items}
        currency="USD"
        locale="en-US"
        sellerCountry="NL"
        shippingOptions={shipping}
        paymentMethods={payments}
        defaultValues={{ email: "maya.chen@northwind.io", country: "US" }}
        onApplyCoupon={async (code) => {
          await wait(600);
          return (
            COUPONS[code] ?? {
              ok: false,
              reason: "invalid",
              message: `${code} isn't a valid code.`,
            }
          );
        }}
        verifyVatId={async (id) => {
          await wait(500);
          return !id.endsWith("000");
        }}
        onPlaceOrder={async () => {
          await wait(1200);
        }}
      />
    </div>
  );
}
