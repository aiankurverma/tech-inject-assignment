import { useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  Calendar,
  ClipboardList,
  FileText,
  Inbox,
  Mail,
  Users,
} from "lucide-react";
import { ShellTopnav, type TopNavItem } from "@/components/crm/shell-topnav";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { DealCard, type Deal } from "@/components/crm/deal-card";
import { Button } from "@/components/crm/button";
import type { Notification } from "@/components/crm/notifications";

const items: TopNavItem[] = [
  { id: "home", label: "Home", icon: <Inbox /> },
  { id: "deals", label: "Deals", icon: <ClipboardList />, count: 38 },
  { id: "companies", label: "Companies", icon: <Building2 /> },
  { id: "contacts", label: "Contacts", icon: <Users /> },
  { id: "meetings", label: "Meetings", icon: <Calendar />, count: 4 },
  { id: "sequences", label: "Sequences", icon: <Mail /> },
  { id: "quotes", label: "Quotes", icon: <FileText /> },
  { id: "reports", label: "Reports", icon: <BarChart3 /> },
];

const deals: (Deal & { stage: string })[] = [
  {
    id: "d1",
    title: "Enterprise renewal",
    company: "Northwind",
    amount: 184_500,
    probability: 75,
    closeDate: "Oct 14",
    owner: { name: "Sarah Nguyen" },
    tag: { label: "Negotiation", color: "purple" },
    stage: "late",
  },
  {
    id: "d2",
    title: "Platform expansion",
    company: "Contoso",
    amount: 62_300,
    probability: 40,
    closeDate: "Nov 02",
    owner: { name: "Luca Bianchi" },
    tag: { label: "Discovery", color: "blue" },
    stage: "early",
  },
  {
    id: "d3",
    title: "Seats add-on",
    company: "Tailspin",
    amount: 9_840,
    probability: 90,
    closeDate: "Sep 30",
    owner: { name: "Mei Lin" },
    tag: { label: "Contract sent", color: "green" },
    stage: "late",
    overdue: true,
  },
  {
    id: "d4",
    title: "Data warehouse pilot",
    company: "Fabrikam",
    amount: 48_000,
    probability: 20,
    closeDate: "Dec 12",
    owner: { name: "Omar Haddad" },
    tag: { label: "Qualified", color: "amber" },
    stage: "early",
  },
];

export default function Example() {
  const [active, setActive] = useState("deals");
  const [stage, setStage] = useState("all");
  const [notes, setNotes] = useState<Notification[]>([
    {
      id: "n1",
      actor: { name: "Mei Lin" },
      text: "signed the Tailspin order form",
      time: "12m ago",
      unread: true,
    },
  ]);
  const shown = useMemo(() => deals.filter((d) => stage === "all" || d.stage === stage), [stage]);
  const total = shown.reduce((s, d) => s + d.amount, 0);
  return (
    <div className="h-[620px] overflow-hidden rounded-crm border border-crm-border">
      <ShellTopnav
        items={items}
        activeId={active}
        onNavigate={setActive}
        workspaces={[{ id: "acme", name: "Acme Sales", meta: "Growth" }]}
        user={{ name: "Priya Raman", email: "priya@acme.io", role: "Admin" }}
        notifications={notes}
        onMarkAllRead={() => setNotes((n) => n.map((x) => ({ ...x, unread: false })))}
        onSearch={() => undefined}
        actions={<Button variant="primary">New deal</Button>}
        subheader={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-medium capitalize">{active}</h1>
              <p className="text-xs text-crm-muted-fg tabular-nums">
                {shown.length} deals · ${total.toLocaleString()}
              </p>
            </div>
            <SegmentedControl
              label="Stage"
              size="sm"
              value={stage}
              onValueChange={setStage}
              options={[
                { value: "all", label: "All", count: deals.length },
                { value: "early", label: "Early" },
                { value: "late", label: "Late" },
              ]}
            />
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((d) => (
            <DealCard key={d.id} deal={d} />
          ))}
        </div>
      </ShellTopnav>
    </div>
  );
}
