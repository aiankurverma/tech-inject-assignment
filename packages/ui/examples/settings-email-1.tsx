import * as React from "react";
import {
  SettingsEmail,
  type ConnectedMailbox,
  type DnsRecord,
} from "@/components/crm/settings-email";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const INITIAL_MAILBOXES: ConnectedMailbox[] = [
  {
    id: "mb1",
    address: "jordan.pike@northwind.io",
    provider: "google",
    status: "connected",
    lastSyncedAt: hoursAgo(0.1),
    isDefault: true,
  },
  {
    id: "mb2",
    address: "sales@northwind.io",
    provider: "google",
    status: "syncing",
    lastSyncedAt: hoursAgo(2),
  },
  {
    id: "mb3",
    address: "jpike@northwind-emea.co.uk",
    provider: "microsoft",
    status: "error",
    lastSyncedAt: hoursAgo(30),
    errorMessage: "Token expired - reconnect to resume sync",
  },
];

const RECORDS: DnsRecord[] = [
  {
    type: "TXT",
    purpose: "SPF",
    host: "@",
    value: "v=spf1 include:_spf.google.com include:send.kitbase.app ~all",
    status: "verified",
  },
  {
    type: "CNAME",
    purpose: "DKIM",
    host: "kb1._domainkey",
    value: "kb1.dkim.kitbase.app",
    status: "pending",
  },
  {
    type: "TXT",
    purpose: "DMARC",
    host: "_dmarc",
    value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@northwind.io",
    status: "failed",
  },
  {
    type: "CNAME",
    purpose: "Tracking",
    host: "links",
    value: "track.kitbase.app",
    status: "verified",
  },
];

export default function Example() {
  const [mailboxes, setMailboxes] = React.useState(INITIAL_MAILBOXES);
  return (
    <SettingsEmail
      mailboxes={mailboxes}
      domain="northwind.io"
      dnsRecords={RECORDS}
      sender={{
        first_name: "Jordan",
        last_name: "Pike",
        title: "Account Executive",
        phone: "+1 (415) 555-0142",
        calendar_link: "cal.com/jpike",
      }}
      defaultValue={{
        fromName: "Jordan Pike",
        replyTo: "",
        signature:
          "{{first_name}} {{last_name}}\n{{title}} · Northwind\n{{phone}}\nBook time: {{calendar_link}}",
        trackOpens: true,
        trackClicks: true,
        dailyLimit: 400,
        sendGap: "3",
        unsubscribeFooter: true,
      }}
      onConnect={(p) => alert(`OAuth with ${p}`)}
      onDisconnect={(id) => setMailboxes((m) => m.filter((x) => x.id !== id))}
      onSetDefault={(id) => setMailboxes((m) => m.map((x) => ({ ...x, isDefault: x.id === id })))}
      onResync={(id) =>
        setMailboxes((m) => m.map((x) => (x.id === id ? { ...x, status: "syncing" } : x)))
      }
      onVerifyDomain={async () => {
        await new Promise((r) => setTimeout(r, 900));
        return RECORDS.map((r) =>
          r.purpose === "DKIM" ? { ...r, status: "verified" as const } : r,
        );
      }}
      onSave={async () => {
        await new Promise((r) => setTimeout(r, 600));
      }}
    />
  );
}
