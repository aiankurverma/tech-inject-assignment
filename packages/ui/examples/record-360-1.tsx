import { Record360, type Record360Data } from "@/components/crm/record-360";

const maya = { name: "Maya Chen" };

const data: Record360Data = {
  company: {
    name: "Northwind Traders",
    domain: "northwind.com",
    industry: "Wholesale distribution",
    employees: 2400,
    location: "San Francisco, CA",
    owner: maya,
    lifecycle: "customer",
  },
  health: 72,
  arr: 412000,
  renewalDate: "2026-10-31",
  contacts: [
    {
      id: "c1",
      name: "Dana Whitfield",
      title: "VP Sales Ops",
      email: "dana@northwind.com",
      phone: "+14155550132",
      role: "champion",
      lastTouch: "today",
    },
    {
      id: "c2",
      name: "Rahul Iyer",
      title: "Procurement Lead",
      email: "rahul@northwind.com",
      role: "decision_maker",
      lastTouch: "3d ago",
    },
    { id: "c3", name: "Grace Liu", title: "IT Security", role: "blocker", lastTouch: "2w ago" },
    { id: "c4", name: "Omar Haddad", title: "Support Manager", role: "influencer" },
  ],
  deals: [
    {
      id: "d1",
      title: "Enterprise renewal (2-yr)",
      company: "Northwind",
      amount: 530000,
      probability: 80,
      closeDate: "Oct 31",
      stage: "Negotiation",
      owner: maya,
      tag: { label: "Renewal", color: "green" },
    },
    {
      id: "d2",
      title: "Support team expansion — 40 seats",
      company: "Northwind",
      amount: 96000,
      probability: 40,
      closeDate: "Dec 15",
      stage: "Proposal",
      owner: maya,
    },
    {
      id: "d3",
      title: "Power Dialer add-on",
      company: "Northwind",
      amount: 12000,
      probability: 100,
      closeDate: "Mar 2",
      stage: "Closed won",
      status: "won",
      owner: maya,
    },
    {
      id: "d4",
      title: "APAC rollout",
      company: "Northwind",
      amount: 180000,
      probability: 0,
      closeDate: "Jun 30",
      stage: "Closed lost",
      status: "lost",
      owner: maya,
    },
  ],
  activities: [
    {
      id: "a1",
      type: "call",
      actor: maya,
      text: "Called Dana Whitfield — 21 min",
      detail: "Wants 2-year term; procurement joins Thursday.",
      time: "2h ago",
    },
    {
      id: "a2",
      type: "email",
      actor: { name: "Dana Whitfield" },
      text: "Replied to “Renewal — 2-year option”",
      time: "5h ago",
    },
    {
      id: "a3",
      type: "meeting",
      actor: maya,
      text: "Renewal & expansion review",
      time: "Yesterday",
    },
    {
      id: "a4",
      type: "note",
      actor: { name: "Leo Park" },
      text: "SSO/SCIM confirmed working in sandbox",
      time: "Sep 24",
    },
    { id: "a5", type: "task", actor: maya, text: "Completed: Share SOC 2 report", time: "Sep 23" },
  ],
  tickets: [
    {
      id: "4812",
      subject: "Forecast export times out on large pipelines",
      status: "open",
      priority: "urgent",
      age: "6h",
    },
    {
      id: "4790",
      subject: "Add custom field to quote PDF",
      status: "pending",
      priority: "normal",
      age: "3d",
    },
    {
      id: "4702",
      subject: "SAML login loop for new hires",
      status: "solved",
      priority: "high",
      age: "2w",
    },
  ],
};

export default function Example() {
  return (
    <div className="w-full max-w-[1120px]">
      <Record360
        data={data}
        onOpenDeal={(d) => console.log("open", d.id)}
        onLogActivity={() => console.log("log activity")}
      />
    </div>
  );
}
