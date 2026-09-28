import * as React from "react";
import {
  BarChart3,
  Bell,
  Building2,
  Handshake,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Mail,
  Users,
} from "lucide-react";
import { IconButton } from "@/components/crm/button";
import { TopNav, type TopNavItem } from "@/components/crm/top-nav";

const items: TopNavItem[] = [
  { id: "home", label: "Home", icon: <LayoutDashboard /> },
  { id: "inbox", label: "Inbox", icon: <Inbox />, count: 14 },
  { id: "deals", label: "Deals", icon: <Handshake />, count: 3 },
  { id: "contacts", label: "Contacts", icon: <Users /> },
  { id: "companies", label: "Companies", icon: <Building2 /> },
  { id: "tasks", label: "Tasks", icon: <ListTodo />, count: 128 },
  { id: "sequences", label: "Sequences", icon: <Mail /> },
  { id: "reports", label: "Reports", icon: <BarChart3 /> },
  { id: "forecast", label: "Forecast", disabled: true },
];

export default function Example() {
  const [active, setActive] = React.useState("deals");
  return (
    <div className="w-full max-w-[960px] resize-x overflow-hidden rounded-xl border border-crm-border bg-crm-bg">
      <TopNav
        sticky={false}
        items={items}
        value={active}
        onValueChange={setActive}
        brand={
          <>
            <span className="grid size-7 place-items-center rounded-crm bg-crm-primary text-xs font-bold text-crm-primary-fg">
              N
            </span>
            <span className="hidden text-sm font-semibold text-crm-fg sm:inline">Northwind</span>
          </>
        }
        actions={
          <IconButton label="Notifications, 5 unread" dot>
            <Bell />
          </IconButton>
        }
      />
      <p className="p-4 font-crm text-xs text-crm-subtle">
        Viewing <span className="text-crm-fg">{items.find((i) => i.id === active)?.label}</span>.
        Drag the bottom-right corner to narrow the frame and watch items move into “More”.
      </p>
    </div>
  );
}
