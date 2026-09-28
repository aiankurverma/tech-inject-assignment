import { LeadDetail, type LeadRecord } from "@/components/crm/lead-detail";

const lead: LeadRecord = {
  id: "l1",
  name: "Aisha Khan",
  email: "aisha@brightpath.io",
  phone: "+1 415 555 0142",
  company: "BrightPath Services",
  title: "VP Operations",
  source: "Website – demo form",
  owner: "Maya Chen",
  status: "working",
  signals: {
    employees: 240,
    industryMatch: true,
    seniority: "VP",
    pricingPageViews: 3,
    demoRequested: true,
    emailOpens: 2,
    webinarAttended: false,
  },
  qualification: {
    need: "30 field techs dispatched from spreadsheets; double-booking weekly",
    timeline: "Live before Jan 15 (new season)",
  },
  activities: [
    {
      id: "a1",
      type: "email",
      actor: { name: "Maya Chen" },
      text: "sent demo invite",
      time: "1h ago",
    },
    {
      id: "a2",
      type: "call",
      actor: { name: "Maya Chen" },
      text: "had a 12-min discovery call",
      detail: "CFO signs anything over $20k. Budget line exists for 'ops tooling'.",
      time: "45m ago",
    },
  ],
};

export default function Example() {
  return <LeadDetail className="w-full max-w-[1000px]" lead={lead} />;
}
