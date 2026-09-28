import * as React from "react";
import { UserRound } from "lucide-react";
import { Button } from "@/components/crm/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetSection,
  SheetTrigger,
} from "@/components/crm/sheet";
import { StatCard } from "@/components/crm/stat-card";

export default function Example() {
  return (
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button>Open profile</Button>
      </SheetTrigger>
      <SheetContent
        title="My Profile"
        icon={<UserRound />}
        footer={
          <>
            <SheetClose asChild>
              <Button size="sm">Close</Button>
            </SheetClose>
            <Button variant="primary" size="sm">
              Show all accounts
            </Button>
          </>
        }
      >
        <SheetSection title="Team pipeline">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Accounts" value={18} />
            <StatCard label="Open deals" value={90} />
            <StatCard label="Pipeline" value="$5,138,594" />
            <StatCard label="Avg. win" value="51%" />
          </div>
        </SheetSection>
        <SheetSection title="Quota � Q4">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-crm-soft">Closed won</span>
              <span className="tabular-nums text-crm-fg">$412,000 / $600,000</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-crm-track">
              <div className="h-full w-[69%] rounded-full bg-crm-primary" />
            </div>
            <span className="text-xs text-crm-subtle">69% attained � 34 days left in quarter</span>
          </div>
        </SheetSection>
        <SheetSection title="Details">
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
            {[
              ["Role", "Account Executive"],
              ["Team", "Mid-market � EMEA"],
              ["Email", "alex@northwind.io"],
              ["Manager", "Priya Nair"],
              ["Timezone", "Europe/Berlin (UTC+2)"],
            ].map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="text-crm-soft">{k}</dt>
                <dd className="truncate text-crm-fg">{v}</dd>
              </React.Fragment>
            ))}
          </dl>
        </SheetSection>
        <SheetSection title="Recent activity">
          <ul className="flex flex-col gap-3 text-sm">
            {[
              ["Moved Acme Corp to Negotiation", "2h ago"],
              ["Logged call with Globex (32 min)", "Yesterday"],
              ["Sent proposal to Initech", "Mon"],
            ].map(([t, d]) => (
              <li key={t} className="flex items-start justify-between gap-3">
                <span className="text-crm-fg">{t}</span>
                <span className="shrink-0 text-xs text-crm-subtle">{d}</span>
              </li>
            ))}
          </ul>
        </SheetSection>
      </SheetContent>
    </Sheet>
  );
}
