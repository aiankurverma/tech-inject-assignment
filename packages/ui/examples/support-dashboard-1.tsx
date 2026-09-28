import { SupportDashboard, type SupportTicket } from "@/components/crm/support-dashboard";

const t = (min: number) => new Date(Date.parse("2026-09-28T12:00:00") - min * 60_000).toISOString();

const tickets: SupportTicket[] = [
  {
    id: "4821",
    subject: "SSO login loop after IdP change",
    customer: "Globex",
    priority: "urgent",
    status: "open",
    assignee: "Maya",
    createdAt: t(42),
  },
  {
    id: "4820",
    subject: "Webhook deliveries failing with 410",
    customer: "Initech",
    priority: "high",
    status: "open",
    createdAt: t(95),
  },
  {
    id: "4818",
    subject: "CSV import drops phone numbers",
    customer: "Acme",
    priority: "normal",
    status: "open",
    assignee: "Omar",
    createdAt: t(310),
  },
  {
    id: "4815",
    subject: "Invoice shows wrong GST number",
    customer: "Stark",
    priority: "high",
    status: "pending",
    assignee: "Maya",
    createdAt: t(260),
    firstResponseAt: t(200),
  },
  {
    id: "4811",
    subject: "Request: dark mode for mobile",
    customer: "Hooli",
    priority: "low",
    status: "open",
    createdAt: t(900),
  },
  {
    id: "4809",
    subject: "Deal amounts rounding incorrectly",
    customer: "Umbrella",
    priority: "urgent",
    status: "solved",
    assignee: "Omar",
    createdAt: t(1400),
    firstResponseAt: t(1385),
    solvedAt: t(1200),
    csat: 5,
  },
  {
    id: "4802",
    subject: "Can't add seats to plan",
    customer: "Wayne",
    priority: "normal",
    status: "solved",
    assignee: "Lena",
    createdAt: t(2900),
    firstResponseAt: t(2500),
    solvedAt: t(2300),
    csat: 4,
  },
  {
    id: "4797",
    subject: "Email sync delayed by hours",
    customer: "Vandelay",
    priority: "high",
    status: "solved",
    assignee: "Lena",
    createdAt: t(3600),
    firstResponseAt: t(3380),
    solvedAt: t(3000),
    csat: 2,
  },
  {
    id: "4790",
    subject: "Export to PDF cuts columns",
    customer: "Acme",
    priority: "low",
    status: "solved",
    assignee: "Maya",
    createdAt: t(5000),
    firstResponseAt: t(4700),
    solvedAt: t(4200),
    csat: 5,
  },
];

export default function Example() {
  return (
    <SupportDashboard
      className="w-[1040px]"
      now={new Date("2026-09-28T12:00:00")}
      tickets={tickets}
    />
  );
}
