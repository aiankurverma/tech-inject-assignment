import {
  ProCpqQuoteBuilder,
  type ApprovalPolicy,
  type CpqBundle,
  type CpqProduct,
  type FxTable,
  type QuoteDraft,
  type QuoteLine,
} from "@/components/crm/pro-cpq-quote-builder";

const products: CpqProduct[] = [
  {
    id: "p-core",
    sku: "PLAT-CORE",
    name: "Platform seat",
    family: "Platform",
    currency: "USD",
    model: "tiered",
    unitPrice: 0,
    billing: "monthly",
    tiers: [
      { upTo: 50, unitPrice: 4900 },
      { upTo: 250, unitPrice: 3900 },
      { upTo: null, unitPrice: 2900 },
    ],
    maxRepDiscountBp: 1500,
  },
  {
    id: "p-analytics",
    sku: "ADD-ANLYT",
    name: "Advanced analytics",
    family: "Add-ons",
    currency: "USD",
    model: "volume",
    unitPrice: 0,
    billing: "monthly",
    tiers: [
      { upTo: 100, unitPrice: 1500 },
      { upTo: 500, unitPrice: 1100 },
      { upTo: null, unitPrice: 800 },
    ],
  },
  {
    id: "p-sso",
    sku: "SEC-SSO",
    name: "SSO & SCIM",
    family: "Security",
    currency: "USD",
    model: "flat",
    unitPrice: 60000,
    billing: "annual",
  },
  {
    id: "p-audit",
    sku: "SEC-AUDIT",
    name: "Audit log retention (7y)",
    family: "Security",
    currency: "EUR",
    model: "flat",
    unitPrice: 240000,
    billing: "annual",
  },
  {
    id: "p-support-std",
    sku: "SUP-STD",
    name: "Standard support",
    family: "Support",
    currency: "USD",
    model: "flat",
    unitPrice: 0,
    billing: "annual",
  },
  {
    id: "p-support-prem",
    sku: "SUP-PREM",
    name: "Premium support (24/7)",
    family: "Support",
    currency: "USD",
    model: "flat",
    unitPrice: 1800000,
    billing: "annual",
    maxRepDiscountBp: 500,
  },
  {
    id: "p-onboard",
    sku: "SVC-ONB",
    name: "Guided onboarding",
    family: "Services",
    currency: "GBP",
    model: "flat",
    unitPrice: 750000,
    billing: "one-time",
  },
  {
    id: "p-api",
    sku: "ADD-API",
    name: "API calls (per 10k)",
    family: "Usage",
    currency: "USD",
    model: "tiered",
    unitPrice: 0,
    billing: "monthly",
    tiers: [
      { upTo: 100, unitPrice: 200 },
      { upTo: 1000, unitPrice: 120 },
      { upTo: null, unitPrice: 80 },
    ],
  },
];

const bundles: CpqBundle[] = [
  {
    id: "b-growth",
    name: "Growth",
    description: "Seats, analytics and standard support for scaling revenue teams.",
    options: [
      { id: "core", productId: "p-core", required: true, qtyFollowsPrimary: true },
      { id: "analytics", productId: "p-analytics", defaultSelected: true, qtyFollowsPrimary: true },
      { id: "std", productId: "p-support-std", defaultSelected: true },
      { id: "prem", productId: "p-support-prem" },
      { id: "onboard", productId: "p-onboard" },
    ],
    rules: [{ kind: "pickOne", options: ["std", "prem"], message: "Pick one support plan" }],
  },
  {
    id: "b-enterprise",
    name: "Enterprise",
    description: "Everything in Growth plus SSO, audit retention and premium support.",
    options: [
      { id: "core", productId: "p-core", required: true, qtyFollowsPrimary: true },
      { id: "analytics", productId: "p-analytics", defaultSelected: true, qtyFollowsPrimary: true },
      { id: "sso", productId: "p-sso", defaultSelected: true },
      { id: "audit", productId: "p-audit" },
      { id: "prem", productId: "p-support-prem", required: true },
      { id: "api", productId: "p-api", defaultSelected: true, defaultQty: 500 },
      { id: "onboard", productId: "p-onboard", defaultSelected: true },
    ],
    rules: [
      { kind: "requires", option: "audit", requires: "sso" },
      { kind: "minQty", option: "api", min: 100 },
    ],
  },
];

const fx: FxTable = {
  base: "USD",
  rates: { EUR: "1.0850", GBP: "1.2700", INR: "0.0120", JPY: "0.0067" },
};

const policy: ApprovalPolicy = {
  repMaxDiscountBp: 1000,
  tiers: [
    { minDiscountBp: 1000, approver: "Sales manager" },
    { minDiscountBp: 2000, approver: "VP Sales" },
    { minDiscountBp: 3000, approver: "CFO" },
  ],
  largeDealMinor: 500_000_000,
};

// 10,000 lines: a reseller renewal with one line per sub-account, deterministic pseudo-random data.
function makeLines(n: number): QuoteLine[] {
  let s = 42;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const ids = products.map((p) => p.id);
  return Array.from({ length: n }, (_, i) => {
    const productId = ids[Math.floor(rnd() * ids.length)]!;
    const oneTime = productId === "p-onboard";
    return {
      id: `l${i}`,
      productId,
      bundleName: `Sub-account ${String(Math.floor(i / 8) + 1).padStart(4, "0")}`,
      quantity: 1 + Math.floor(rnd() * 120),
      discountBp: rnd() < 0.08 ? 1500 : Math.floor(rnd() * 8) * 100,
      termMonths: oneTime ? 1 : 12,
    };
  });
}

const quote: QuoteDraft = {
  id: "q-1042",
  number: "Q-2026-1042",
  currency: "USD",
  header: {
    customer: "Northwind Logistics",
    contactEmail: "procurement@northwind.example",
    validUntil: "2026-10-31",
    paymentTerms: "net30",
    notes: "Pricing assumes a 12-month commitment and annual invoicing in advance.",
  },
  lines: makeLines(10_000),
  headerDiscountBp: 250,
};

export default function Example() {
  return (
    <div className="w-full max-w-[1180px] p-4">
      <ProCpqQuoteBuilder
        products={products}
        bundles={bundles}
        fx={fx}
        policy={policy}
        defaultValue={quote}
        sellerName="Kitbase Cloud Inc."
        gridHeight={380}
        onRequestApproval={(q, approvers) =>
          console.info(`Submitted ${q.number} to ${approvers.join(", ")}`)
        }
      />
    </div>
  );
}
