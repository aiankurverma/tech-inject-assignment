import * as React from "react";
import {
  ProBillingPortal,
  type BillingApi,
  type BillingOverview,
  type Invoice,
} from "@/components/crm/pro-billing-portal";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** In-memory mock of a billing backend: 36 months of invoices, cursor-paginated. */
function createMockApi(): BillingApi {
  const state: BillingOverview = {
    subscription: {
      planId: "growth",
      interval: "month",
      status: "active",
      currentPeriodEnd: "2026-10-28T00:00:00Z",
      seats: 24,
    },
    plans: [
      {
        id: "starter",
        name: "Starter",
        description: "For small teams",
        prices: { month: 2900, year: 29000 },
        features: ["5 seats", "10k API calls", "Email support"],
      },
      {
        id: "growth",
        name: "Growth",
        description: "Scale with confidence",
        highlighted: true,
        prices: { month: 9900, year: 99000 },
        features: ["25 seats", "1M API calls", "SSO", "Priority support"],
      },
      {
        id: "enterprise",
        name: "Enterprise",
        description: "Custom contracts",
        prices: {},
        features: ["Unlimited seats", "Dedicated CSM", "SLA 99.99%", "Audit logs"],
      },
    ],
    paymentMethods: [
      {
        id: "pm_1",
        token: "tok_visa_4242",
        kind: "card",
        brand: "visa",
        last4: "4242",
        expMonth: 8,
        expYear: 2028,
        isDefault: true,
      },
      {
        id: "pm_2",
        token: "tok_mc_4444",
        kind: "card",
        brand: "mastercard",
        last4: "4444",
        expMonth: 2,
        expYear: 2027,
      },
      { id: "pm_3", token: "tok_sepa_3000", kind: "sepa", last4: "3000" },
    ],
    details: {
      companyName: "Northwind Analytics GmbH",
      email: "billing@northwind.example",
      line1: "Friedrichstraße 68",
      city: "Berlin",
      postalCode: "10117",
      country: "DE",
      taxId: "DE123456789",
    },
    usage: [
      { id: "seats", label: "Seats", used: 24, limit: 25 },
      { id: "api", label: "API calls", used: 812_400, limit: 1_000_000 },
      { id: "storage", label: "Storage", used: 182, limit: 250, unit: "GB" },
      { id: "workflows", label: "Workflow runs", used: 48_210, limit: null },
    ],
    creditBalance: 12_500,
  };
  const invoices: Invoice[] = Array.from({ length: 36 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8 - i, 28));
    return {
      id: `in_${i}`,
      number: `NW-${String(2026 * 100 + 36 - i).slice(-5)}`,
      date: d.toISOString(),
      amount: 9900 + (i % 5) * 1375,
      status: i === 0 ? "open" : i === 7 ? "void" : "paid",
      pdfUrl: `https://billing.example.com/invoices/in_${i}.pdf`,
    };
  });
  const clone = () => structuredClone(state);
  return {
    getOverview: async () => (await wait(250), clone()),
    listInvoices: async (cursor) => {
      await wait(250);
      const start = cursor ? Number(cursor) : 0;
      const page = invoices.slice(start, start + 12);
      return {
        invoices: page,
        nextCursor: start + 12 < invoices.length ? String(start + 12) : undefined,
      };
    },
    changePlan: async (planId, interval) => {
      await wait(400);
      state.subscription = { ...state.subscription, planId, interval };
    },
    cancelSubscription: async () => {
      await wait(400);
      state.subscription.cancelAtPeriodEnd = true;
    },
    setDefaultPaymentMethod: async (id) => {
      await wait(300);
      state.paymentMethods = state.paymentMethods.map((m) => ({ ...m, isDefault: m.id === id }));
    },
    removePaymentMethod: async (id) => {
      await wait(300);
      state.paymentMethods = state.paymentMethods.filter((m) => m.id !== id);
    },
    updateDetails: async (details) => {
      await wait(400);
      state.details = details;
    },
    downloadInvoice: (inv) => alert(`Downloading ${inv.number}.pdf`),
  };
}

export default function ProBillingPortalExample() {
  const api = React.useMemo(createMockApi, []);
  return (
    <div className="bg-crm-bg p-4">
      <ProBillingPortal
        api={api}
        currency="EUR"
        locale="de-DE"
        onAddPaymentMethod={() => alert("Open provider card element")}
      />
    </div>
  );
}
