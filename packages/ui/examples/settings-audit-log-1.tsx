import * as React from "react";
import { SettingsAuditLog, type AuditEvent } from "@/components/crm/settings-audit-log";

const NOW = new Date("2026-09-28T15:00:00Z");
const at = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString();
const dana = { name: "Dana Whitfield", email: "dana@northwind.io" };
const marcus = { name: "Marcus Oyelaran", email: "marcus@northwind.io" };
const lena = { name: "Lena Fischer", email: "lena@northwind.io" };
const CHROME = "Chrome 128 on macOS 14.6";

const EVENTS: AuditEvent[] = [
  {
    id: "e1",
    at: at(0.3),
    actor: dana,
    action: "deal.stage_changed",
    summary: "Moved Acme Logistics renewal to Negotiation",
    category: "record",
    severity: "info",
    target: "Deal · Acme Logistics renewal",
    ip: "73.162.14.8",
    location: "Oakland, US",
    userAgent: CHROME,
    changes: [
      { field: "Stage", before: "Proposal", after: "Negotiation" },
      { field: "Amount", before: "$42,000", after: "$48,500" },
    ],
  },
  {
    id: "e2",
    at: at(1.2),
    actor: null,
    action: "user.login_failed",
    summary: "5 failed sign-ins for marcus@northwind.io",
    category: "auth",
    severity: "critical",
    ip: "185.220.101.4",
    location: "Frankfurt, DE (Tor exit)",
    userAgent: "python-requests/2.31",
  },
  {
    id: "e3",
    at: at(2),
    actor: marcus,
    action: "user.mfa_enabled",
    summary: "Enabled authenticator app",
    category: "auth",
    severity: "info",
    ip: "98.42.7.110",
    location: "Austin, US",
    userAgent: "Safari 17 on iOS 17.6",
  },
  {
    id: "e4",
    at: at(5),
    actor: lena,
    action: "export.contacts",
    summary: "Exported 12,480 contacts to CSV",
    category: "data",
    severity: "warning",
    target: "Saved view · All customers",
    ip: "91.64.20.3",
    location: "Berlin, DE",
    userAgent: CHROME,
  },
  {
    id: "e5",
    at: at(8),
    actor: dana,
    action: "role.updated",
    summary: "Granted Admin role to Lena Fischer",
    category: "settings",
    severity: "critical",
    target: "User · Lena Fischer",
    ip: "73.162.14.8",
    location: "Oakland, US",
    changes: [{ field: "Role", before: "Sales rep", after: "Admin" }],
  },
  {
    id: "e6",
    at: at(20),
    actor: dana,
    action: "billing.seats_changed",
    summary: "Added 3 seats to Growth plan",
    category: "billing",
    severity: "info",
    changes: [
      { field: "Seats", before: "25", after: "28" },
      { field: "Monthly total", before: "$1,975.00", after: "$2,212.00" },
    ],
  },
  {
    id: "e7",
    at: at(30),
    actor: marcus,
    action: "contact.deleted",
    summary: "Deleted contact Tom Becker",
    category: "record",
    severity: "warning",
    target: "Contact · Tom Becker",
    changes: [{ field: "Status", before: "Active", after: null }],
  },
  {
    id: "e8",
    at: at(49),
    actor: null,
    action: "integration.token_expired",
    summary: "Microsoft 365 sync token expired",
    category: "settings",
    severity: "warning",
  },
  {
    id: "e9",
    at: at(72),
    actor: lena,
    action: "pipeline.stage_added",
    summary: "Added stage 'Security review' to Enterprise pipeline",
    category: "settings",
    severity: "info",
    changes: [{ field: "Stages", before: "6", after: "7" }],
  },
  {
    id: "e10",
    at: at(96),
    actor: dana,
    action: "user.login",
    summary: "Signed in with Google SSO",
    category: "auth",
    severity: "info",
    ip: "73.162.14.8",
    location: "Oakland, US",
    userAgent: CHROME,
  },
  {
    id: "e11",
    at: at(130),
    actor: marcus,
    action: "import.completed",
    summary: "Imported 1,204 leads from trade-show.csv",
    category: "data",
    severity: "info",
    target: "Import · trade-show.csv",
  },
  {
    id: "e12",
    at: at(150),
    actor: lena,
    action: "deal.owner_changed",
    summary: "Reassigned 18 deals from Marcus to Lena",
    category: "record",
    severity: "info",
    changes: [{ field: "Owner", before: "Marcus Oyelaran", after: "Lena Fischer" }],
  },
  {
    id: "e13",
    at: at(400),
    actor: dana,
    action: "api_key.created",
    summary: "Created API key 'Zapier production'",
    category: "settings",
    severity: "warning",
    ip: "73.162.14.8",
    location: "Oakland, US",
  },
  {
    id: "e14",
    at: at(900),
    actor: null,
    action: "billing.invoice_paid",
    summary: "Invoice INV-2026-0831 paid · $1,975.00",
    category: "billing",
    severity: "info",
  },
];

export default function Example() {
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);
  return (
    <SettingsAuditLog
      events={EVENTS}
      loading={loading}
      now={NOW}
      pageSize={6}
      retentionDays={180}
    />
  );
}
