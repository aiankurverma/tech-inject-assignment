import { CompanyDetail, type CompanyRecord } from "@/components/crm/company-detail";

const company: CompanyRecord = {
  id: "c3",
  name: "Stark Industries",
  domain: "stark.io",
  industry: "Advanced manufacturing",
  employees: 31000,
  location: "Los Angeles, CA",
  owner: "Leo Park",
  arr: 410000,
  renewalDate: "2026-11-30",
  seats: { licensed: 600, active: 252 },
  nps: 12,
  description:
    "Uses the platform for field-service dispatch across 14 plants. Expansion blocked until the ERP integration ships.",
  tags: [
    { label: "Strategic", color: "purple" },
    { label: "Renewal Q4", color: "amber" },
  ],
  contacts: [
    { id: "p1", name: "Pepper Potts", title: "COO", email: "pepper@stark.io", primary: true },
    { id: "p2", name: "Happy Hogan", title: "Head of Facilities", email: "happy@stark.io" },
    { id: "p3", name: "Maria Hill", title: "IT Program Manager", email: "m.hill@stark.io" },
  ],
  deals: [
    {
      id: "d1",
      name: "Analytics add-on",
      amount: 48000,
      stage: "Proposal",
      status: "open",
      closeDate: "2026-10-02",
    },
    {
      id: "d2",
      name: "FY27 renewal",
      amount: 410000,
      stage: "Discovery",
      status: "open",
      closeDate: "2026-11-30",
    },
    {
      id: "d3",
      name: "Initial platform deal",
      amount: 360000,
      stage: "Closed",
      status: "won",
      closeDate: "2024-11-30",
    },
    {
      id: "d4",
      name: "Mobile app pilot",
      amount: 25000,
      stage: "Closed",
      status: "lost",
      closeDate: "2025-06-15",
    },
  ],
  tickets: [
    { id: "t1", subject: "ERP sync dropping work orders", priority: "urgent", status: "open" },
    { id: "t2", subject: "SSO login loop on Safari", priority: "high", status: "pending" },
    { id: "t3", subject: "Export CSV missing columns", priority: "normal", status: "solved" },
  ],
  activities: [
    {
      id: "a1",
      type: "meeting",
      actor: { name: "Leo Park" },
      text: "ran the QBR with Pepper",
      time: "3d ago",
    },
    {
      id: "a2",
      type: "note",
      actor: { name: "Leo Park" },
      text: "flagged renewal risk",
      detail: "Adoption at 42%. Need exec sponsor call before Nov.",
      time: "1w ago",
    },
  ],
};

export default function Example() {
  return <CompanyDetail className="w-full max-w-[1000px]" company={company} today="2026-09-28" />;
}
