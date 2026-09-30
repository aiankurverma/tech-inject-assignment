import * as React from "react";
import { BillingPageTemplate } from "@/components/crm/billing-page-template";
import type { BillingApi, BillingOverview, Invoice } from "@/components/crm/pro-billing-portal";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Small in-memory billing backend: 12 monthly invoices. */
function createMockApi(): BillingApi {
  const state: BillingOverview = {
    subscription: {
      planId: "growth",
      interval: "month",
      status: "active",
      currentPeriodEnd: "2026-10-28T00:00:00Z",
      seats: 18,
    },
    plans: [
      {
        id: "starter",
        name: "Starter",
        description: "For small teams",
        prices: { month: 2900, year: 29000 },
        features: ["5 seats", "Email support"],
      },
      {
        id: "growth",
        name: "Growth",
        description: "Scale with confidence",
        highlighted: true,
        prices: { month: 9900, year: 99000 },
        features: ["25 seats", "SSO", "Priority support"],
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
    ],
    details: {
      companyName: "Northwind Analytics",
      email: "billing@northwind.example",
      line1: "1 Market St",
      city: "San Francisco",
      postalCode: "94105",
      country: "US",
    },
    usage: [
      { id: "seats", label: "Seats", used: 18, limit: 25 },
      { id: "api", label: "API calls", used: 612_000, limit: 1_000_000 },
    ],
    creditBalance: 0,
  };
  const invoices: Invoice[] = Array.from({ length: 12 }, (_, i) => ({
    id: `in_${i}`,
    number: `NW-${String(1012 - i)}`,
    date: new Date(Date.UTC(2026, 8 - i, 28)).toISOString(),
    amount: 9900,
    status: i === 0 ? "open" : "paid",
  }));
  return {
    getOverview: async () => (await wait(200), structuredClone(state)),
    listInvoices: async (cursor) => {
      await wait(200);
      const start = cursor ? Number(cursor) : 0;
      return {
        invoices: invoices.slice(start, start + 6),
        nextCursor: start + 6 < invoices.length ? String(start + 6) : undefined,
      };
    },
    changePlan: async (planId, interval) => {
      await wait(300);
      state.subscription = { ...state.subscription, planId, interval };
    },
    cancelSubscription: async () => {
      await wait(300);
      state.subscription.cancelAtPeriodEnd = true;
    },
    setDefaultPaymentMethod: async (id) => {
      await wait(200);
      state.paymentMethods = state.paymentMethods.map((m) => ({ ...m, isDefault: m.id === id }));
    },
    removePaymentMethod: async (id) => {
      await wait(200);
      state.paymentMethods = state.paymentMethods.filter((m) => m.id !== id);
    },
    updateDetails: async (details) => {
      await wait(300);
      state.details = details;
    },
    downloadInvoice: (inv) => alert(`Downloading ${inv.number}.pdf`),
  };
}

export default function Example() {
  const api = React.useMemo(createMockApi, []);
  return (
    <BillingPageTemplate
      kpis={[
        { label: "Current plan", value: "Growth", caption: "Monthly" },
        { label: "Next invoice", value: "$99.00", caption: "Oct 28" },
        { label: "Seats used", value: "18 / 25" },
        { label: "Spend YTD", value: "$891", delta: 12 },
      ]}
      billing={{ api, onAddPaymentMethod: () => alert("Open provider card element") }}
    />
  );
}
