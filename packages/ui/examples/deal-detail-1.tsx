import { DealDetail, type DealRecord } from "@/components/crm/deal-detail";

const deal: DealRecord = {
  id: "d5",
  name: "Enterprise renewal – FY27",
  company: "LVMH",
  owner: "Maya Chen",
  currency: "EUR",
  closeDate: "2026-11-14",
  source: "Existing customer",
  nextStep:
    "Security questionnaire back from procurement by Oct 10, then redlines call with legal.",
  stage: "proposal",
  lineItems: [
    {
      id: "l1",
      product: "Platform – Enterprise seats",
      quantity: 400,
      unitPrice: 960,
      discount: 15,
    },
    { id: "l2", product: "Premium support (24/7)", quantity: 1, unitPrice: 48000 },
    { id: "l3", product: "SSO + SCIM add-on", quantity: 400, unitPrice: 60, discount: 10 },
    { id: "l4", product: "Onboarding services (days)", quantity: 12, unitPrice: 1800 },
  ],
  stakeholders: [
    { id: "s1", name: "Camille Durand", title: "Head of Digital Ops", role: "Champion" },
    { id: "s2", name: "Antoine Moreau", title: "CFO, Fashion division", role: "Economic buyer" },
    { id: "s3", name: "Inès Laurent", title: "CISO", role: "Blocker" },
    { id: "s4", name: "Hugo Bernard", title: "IT Director", role: "Decision maker" },
  ],
  activities: [
    {
      id: "a1",
      type: "meeting",
      actor: { name: "Maya Chen" },
      text: "held pricing review with Camille",
      time: "2d ago",
    },
    {
      id: "a2",
      type: "email",
      actor: { name: "Maya Chen" },
      text: "sent proposal v3",
      detail: "Updated seat count to 400 and added SCIM.",
      time: "4d ago",
    },
    {
      id: "a3",
      type: "call",
      actor: { name: "Leo Park" },
      text: "logged a call with Inès (security)",
      time: "1w ago",
    },
  ],
};

const stages = [
  { id: "qualified", label: "Qualified" },
  { id: "discovery", label: "Discovery" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "closed", label: "Closed" },
];

export default function Example() {
  return <DealDetail className="w-full max-w-[960px]" deal={deal} stages={stages} />;
}
