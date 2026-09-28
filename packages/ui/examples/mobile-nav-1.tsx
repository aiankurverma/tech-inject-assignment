import * as React from "react";
import {
  BarChart3,
  Building2,
  Calendar,
  Handshake,
  Home,
  Inbox,
  Settings,
  Users,
} from "lucide-react";
import { MobileNav, type MobileNavItem } from "@/components/crm/mobile-nav";

const items: MobileNavItem[] = [
  { id: "home", label: "Home", icon: <Home /> },
  { id: "inbox", label: "Inbox", icon: <Inbox />, badge: 12 },
  { id: "deals", label: "Deals", icon: <Handshake /> },
  { id: "contacts", label: "Contacts", icon: <Users /> },
  { id: "companies", label: "Companies", icon: <Building2 /> },
  { id: "calendar", label: "Calendar", icon: <Calendar />, dot: true },
  { id: "reports", label: "Reports", icon: <BarChart3 /> },
  { id: "settings", label: "Settings", icon: <Settings /> },
];

export default function Example() {
  const [tab, setTab] = React.useState("home");
  const [created, setCreated] = React.useState(0);
  return (
    <div className="relative mx-auto flex h-[560px] w-full max-w-[375px] flex-col overflow-hidden rounded-[28px] border border-crm-border bg-crm-bg font-crm">
      <div className="flex items-center justify-between px-5 pt-3 text-[11px] text-crm-subtle tabular-nums">
        <span>9:41</span>
        <span>5G · 82%</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
        <p className="crm-eyebrow text-crm-subtle">Current tab</p>
        <p className="mt-1 text-xl font-semibold text-crm-fg capitalize">{tab}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            ["Open pipeline", "$1.28M"],
            ["Due today", "7 tasks"],
            ["Deals created", String(created)],
            ["Unread", "12"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-crm border border-crm-border bg-crm-card p-3">
              <p className="text-[11px] text-crm-subtle">{k}</p>
              <p className="mt-0.5 text-base font-semibold text-crm-fg tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 mb-2 crm-eyebrow text-crm-subtle">Up next</p>
        <ul className="divide-y divide-crm-border rounded-crm border border-crm-border bg-crm-card">
          {[
            ["Call Priya · Northwind", "10:30"],
            ["Send Globex proposal", "13:00"],
            ["QBR prep · Initech", "16:15"],
          ].map(([t, time]) => (
            <li key={t} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <span className="truncate text-crm-fg">{t}</span>
              <span className="shrink-0 text-xs text-crm-subtle tabular-nums">{time}</span>
            </li>
          ))}
        </ul>
      </div>
      <MobileNav
        fixed={false}
        items={items}
        value={tab}
        onValueChange={setTab}
        primaryAction={{ label: "New deal", onClick: () => setCreated((n) => n + 1) }}
        drawerFooter={
          <p className="px-1 text-xs text-crm-subtle">Signed in as maya@northwind.io</p>
        }
      />
    </div>
  );
}
