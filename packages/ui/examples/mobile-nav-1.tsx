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
      <div className="flex-1 p-5">
        <p className="crm-eyebrow text-[11px] text-crm-faint">Current tab</p>
        <p className="mt-2 text-lg font-semibold text-crm-fg capitalize">{tab}</p>
        <p className="mt-1 text-xs text-crm-subtle">Deals created from the + button: {created}</p>
      </div>
      <MobileNav
        fixed={false}
        className="flex"
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
