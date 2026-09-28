import { LeadInbox, type InboxLead } from "@/components/crm/lead-inbox";

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const leads: InboxLead[] = [
  {
    id: "l1",
    name: "Aisha Khan",
    email: "aisha@brightpath.io",
    phone: "+1 415 555 0142",
    company: "BrightPath",
    title: "VP Operations",
    source: "Website",
    score: 86,
    receivedAt: minsAgo(4),
    status: "new",
    message:
      "We run 30 field techs on spreadsheets. Need dispatch + invoicing before Q1. Can we see a demo this week?",
  },
  {
    id: "l2",
    name: "Tomás Rivera",
    email: "tomas@kestrel.mx",
    company: "Kestrel Logistics",
    title: "IT Manager",
    source: "Paid ads",
    score: 58,
    receivedAt: minsAgo(22),
    status: "new",
    message: "Pricing for ~80 users? Do you integrate with SAP B1?",
  },
  {
    id: "l3",
    name: "Hannah Becker",
    email: "h.becker@nordlicht.de",
    company: "Nordlicht GmbH",
    source: "Webinar",
    score: 41,
    receivedAt: minsAgo(95),
    status: "new",
  },
  {
    id: "l4",
    name: "Ravi Menon",
    email: "ravi@quantafin.in",
    phone: "+91 98 1100 2233",
    company: "QuantaFin",
    title: "CTO",
    source: "Referral",
    score: 92,
    receivedAt: minsAgo(180),
    status: "contacted",
    assignee: "Maya Chen",
    message: "Referred by Priya at Initech — evaluating 3 vendors, decision in 30 days.",
  },
  {
    id: "l5",
    name: "Grace Liu",
    email: "grace@sproutly.co",
    company: "Sproutly",
    title: "Founder",
    source: "Event",
    score: 34,
    receivedAt: minsAgo(60 * 26),
    status: "new",
    assignee: "Maya Chen",
  },
  {
    id: "l6",
    name: "Oliver Grant",
    email: "ogrant@meridianhealth.org",
    company: "Meridian Health",
    title: "Director of Patient Services",
    source: "Outbound",
    score: 73,
    receivedAt: minsAgo(9),
    status: "new",
  },
];

export default function Example() {
  return (
    <LeadInbox
      className="w-full max-w-[1000px]"
      defaultLeads={leads}
      currentUser="Maya Chen"
      slaMinutes={15}
    />
  );
}
