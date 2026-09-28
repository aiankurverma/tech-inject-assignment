import { useMemo, useState } from "react";
import { BarChart3, Building2, ClipboardList, Inbox, Mail, Settings, Users } from "lucide-react";
import { ShellSidebar, type ShellNavSection } from "@/components/crm/shell-sidebar";
import { StatCard } from "@/components/crm/stat-card";
import { AccountListItem } from "@/components/crm/account-list-item";
import { TrialCard } from "@/components/crm/app-sidebar";
import { Button } from "@/components/crm/button";
import { DropdownMenuItem } from "@/components/crm/dropdown-menu";
import type { Notification } from "@/components/crm/notifications";

const sections: ShellNavSection[] = [
  {
    id: "main",
    items: [
      { id: "inbox", label: "Inbox", icon: <Inbox />, count: 12 },
      { id: "companies", label: "Companies", icon: <Building2 />, count: 241 },
      { id: "deals", label: "Deals board", icon: <ClipboardList /> },
      { id: "contacts", label: "Contacts", icon: <Users />, count: 1832 },
      { id: "reports", label: "Forecast", icon: <BarChart3 /> },
      { id: "sequences", label: "Sequences", icon: <Mail /> },
    ],
  },
  {
    id: "pipelines",
    title: "Pipelines",
    items: [
      { id: "na", label: "North America", dotColor: "#fbbf24", count: 48 },
      { id: "emea", label: "EMEA Enterprise", dotColor: "#f472b6", count: 31 },
      { id: "apac", label: "APAC Expansion", dotColor: "#a78bfa", count: 17 },
    ],
  },
];

const accounts = [
  {
    name: "Northwind Traders",
    meta: "Renewal · Sarah N.",
    amount: 184_500,
    probability: 72,
    pipe: "na",
  },
  {
    name: "Contoso GmbH",
    meta: "New business · Luca B.",
    amount: 96_000,
    probability: 45,
    pipe: "emea",
  },
  {
    name: "Tailspin Toys",
    meta: "Expansion · Mei L.",
    amount: 42_800,
    probability: 88,
    pipe: "apac",
  },
  {
    name: "Fabrikam Inc",
    meta: "New business · Omar H.",
    amount: 210_000,
    probability: 31,
    pipe: "na",
  },
];

export default function Example() {
  const [active, setActive] = useState("companies");
  const [ws, setWs] = useState("acme");
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<Notification[]>([
    {
      id: "1",
      actor: { name: "Sarah Nguyen" },
      text: "moved Northwind to Negotiation",
      time: "4m ago",
      unread: true,
    },
    {
      id: "2",
      actor: { name: "Omar Haddad" },
      text: "mentioned you on Fabrikam",
      quote: "Need legal review by Thu",
      time: "1h ago",
      unread: true,
    },
  ]);
  const label = sections.flatMap((s) => s.items).find((i) => i.id === active)?.label ?? "";
  const rows = useMemo(
    () =>
      accounts.filter(
        (a) =>
          (["na", "emea", "apac"].includes(active) ? a.pipe === active : true) &&
          a.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [active, query],
  );
  const total = rows.reduce((s, a) => s + a.amount, 0);
  const weighted = rows.reduce((s, a) => s + (a.amount * a.probability) / 100, 0);
  const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

  return (
    <div className="h-[640px] overflow-hidden rounded-crm border border-crm-border">
      <ShellSidebar
        sections={sections}
        activeId={active}
        onNavigate={setActive}
        workspaces={[
          { id: "acme", name: "Acme Sales", meta: "Growth · 24 seats" },
          { id: "labs", name: "Acme Labs", meta: "Starter · 5 seats" },
        ]}
        workspaceId={ws}
        onWorkspaceChange={setWs}
        user={{ name: "Priya Raman", email: "priya@acme.io", role: "Admin" }}
        userMenu={
          <DropdownMenuItem>
            <Settings /> Settings
          </DropdownMenuItem>
        }
        breadcrumbs={[{ label: ws === "acme" ? "Acme Sales" : "Acme Labs" }, { label }]}
        notifications={notes}
        onMarkAllRead={() => setNotes((n) => n.map((x) => ({ ...x, unread: false })))}
        onSearch={setQuery}
        actions={<Button variant="primary">New deal</Button>}
        sidebarFooter={<TrialCard days={9} action={<Button variant="muted">Upgrade</Button>} />}
      >
        <div className="flex flex-col gap-4 p-5">
          <h1 className="text-lg font-medium">{label}</h1>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Open deals" value={rows.length} />
            <StatCard label="Pipeline" value={usd(total)} />
            <StatCard label="Weighted" value={usd(weighted)} />
          </div>
          <div className="flex flex-col gap-2">
            {rows.length ? (
              rows.map((a) => <AccountListItem key={a.name} {...a} onClick={() => undefined} />)
            ) : (
              <p className="py-8 text-center text-sm text-crm-muted-fg">
                No accounts match “{query}”.
              </p>
            )}
          </div>
        </div>
      </ShellSidebar>
    </div>
  );
}
