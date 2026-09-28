import { useMemo, useState } from "react";
import { Bell, Calendar, Home, PhoneCall, Plus, Users } from "lucide-react";
import { ShellMobile } from "@/components/crm/shell-mobile";
import { SegmentedControl } from "@/components/crm/segmented-control";
import { AccountListItem } from "@/components/crm/account-list-item";
import { IconButton } from "@/components/crm/button";

const accounts = Array.from({ length: 14 }, (_, i) => {
  const names = [
    "Northwind",
    "Contoso",
    "Tailspin",
    "Fabrikam",
    "Litware",
    "Adventure Works",
    "Proseware",
  ];
  const p = [82, 64, 45, 91, 23, 57, 70][i % 7] ?? 50;
  return {
    id: `a${i}`,
    name: `${names[i % 7]}${i >= 7 ? " EU" : ""}`,
    meta: i % 3 === 0 ? "Call due today" : "Follow-up Thu",
    amount: 12_000 + ((i * 7_919) % 90_000),
    probability: p,
    due: i % 3 === 0,
  };
});

export default function Example() {
  const [tab, setTab] = useState("home");
  const [filter, setFilter] = useState("today");
  const [calls, setCalls] = useState(0);
  const list = useMemo(() => accounts.filter((a) => filter === "all" || a.due), [filter]);
  return (
    <div className="mx-auto h-[640px] w-[375px] max-w-full overflow-hidden rounded-[28px] border border-crm-border">
      <ShellMobile
        title={tab === "home" ? "My accounts" : tab.charAt(0).toUpperCase() + tab.slice(1)}
        activeTab={tab}
        onTabChange={setTab}
        offline={false}
        tabs={[
          { id: "home", label: "Home", icon: <Home /> },
          { id: "contacts", label: "Contacts", icon: <Users /> },
          { id: "agenda", label: "Agenda", icon: <Calendar />, badge: 3 },
          { id: "inbox", label: "Inbox", icon: <Bell />, badge: 128 },
        ]}
        actions={
          <IconButton label="Quick add">
            <Plus />
          </IconButton>
        }
        toolbar={
          <SegmentedControl
            label="Filter accounts"
            fullWidth
            size="sm"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "today", label: "Due today", count: accounts.filter((a) => a.due).length },
              { value: "all", label: "All", count: accounts.length },
            ]}
          />
        }
        fab={{
          label: `Log call (${calls} logged)`,
          icon: <PhoneCall />,
          onClick: () => setCalls((c) => c + 1),
        }}
      >
        <div className="flex flex-col gap-2 px-4">
          {tab === "home" ? (
            list.map((a) => <AccountListItem key={a.id} {...a} onClick={() => undefined} />)
          ) : (
            <p className="py-16 text-center text-sm text-crm-muted-fg">Nothing new in {tab}.</p>
          )}
        </div>
      </ShellMobile>
    </div>
  );
}
