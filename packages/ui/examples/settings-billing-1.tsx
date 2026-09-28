import { SettingsBilling, type BillingPlan } from "@/components/crm/settings-billing";

const plans: BillingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    seatPrice: 15,
    maxSeats: 10,
    features: ["2 pipelines", "Email sync", "5k contacts"],
  },
  {
    id: "growth",
    name: "Growth",
    seatPrice: 39,
    recommended: true,
    features: ["Unlimited pipelines", "Workflows", "Forecasting", "50k contacts"],
  },
  {
    id: "scale",
    name: "Scale",
    seatPrice: 79,
    features: ["SSO & audit log", "Custom roles", "Sandbox", "Priority support"],
  },
];

const renews = new Date(Date.now() + 12 * 86_400_000).toISOString();
const soon = new Date(Date.now() + 40 * 86_400_000);

export default function Example() {
  return (
    <SettingsBilling
      className="max-w-5xl"
      plans={plans}
      current={{ planId: "growth", seats: 12, cycle: "monthly" }}
      seatsInUse={11}
      renewsOn={renews}
      taxRate={0.18}
      usage={[
        { label: "Contacts", used: 41_250, limit: 50_000 },
        { label: "Workflow runs", used: 9_300, limit: 10_000, unit: "/mo" },
        { label: "File storage", used: 12, limit: 50, unit: "GB" },
        { label: "API calls", used: 210_000, limit: 1_000_000, unit: "/day" },
      ]}
      paymentMethod={{
        brand: "Visa",
        last4: "4242",
        expMonth: soon.getMonth() + 1,
        expYear: soon.getFullYear(),
      }}
      invoices={[
        {
          id: "i4",
          number: "INV-2026-0912",
          date: "2026-09-01",
          amount: 552.24,
          status: "open",
          url: "#",
        },
        {
          id: "i3",
          number: "INV-2026-0811",
          date: "2026-08-01",
          amount: 552.24,
          status: "paid",
          url: "#",
        },
        { id: "i2", number: "INV-2026-0710", date: "2026-07-01", amount: 506.22, status: "failed" },
        {
          id: "i1",
          number: "INV-2026-0609",
          date: "2026-06-01",
          amount: 506.22,
          status: "paid",
          url: "#",
        },
      ]}
      onConfirm={() => new Promise((r) => setTimeout(r, 800))}
    />
  );
}
