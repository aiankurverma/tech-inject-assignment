import { useState, type ReactNode } from "react";
import { BarChart3, Building2, ClipboardList, Hexagon, Mail, Target, Users } from "lucide-react";
import {
  Sidebar,
  SidebarBrand,
  SidebarItem,
  SidebarSection,
  TrialCard,
} from "@/components/crm/app-sidebar";
import { Button } from "@/components/crm/button";

export default function Example() {
  const [active, setActive] = useState("Companies");
  const item = (label: string, icon: ReactNode, count?: number) => (
    <SidebarItem
      icon={icon}
      count={count}
      active={active === label}
      onClick={() => setActive(label)}
    >
      {label}
    </SidebarItem>
  );
  return (
    <div className="h-[620px] overflow-hidden rounded-crm border border-crm-border">
      <Sidebar>
        <SidebarBrand logo={<Hexagon />} title="Sales CRM" subtitle="Company pipeline" />
        <SidebarSection>
          {item("Companies", <Building2 />, 241)}
          {item("Deals Board", <ClipboardList />)}
          {item("Forecast", <BarChart3 />, 9)}
          {item("Email Sequences", <Mail />)}
        </SidebarSection>
        <SidebarSection title="Team">
          {item("Strategic AEs", <Target />)}
          {item("SDR Team", <Users />)}
        </SidebarSection>
        <SidebarSection title="Pipelines">
          <SidebarItem dotColor="#fbbf24">North America</SidebarItem>
          <SidebarItem dotColor="#f472b6">EMEA Enterprise</SidebarItem>
          <SidebarItem dotColor="#a78bfa">APAC Expansion</SidebarItem>
        </SidebarSection>
        <TrialCard days={14} action={<Button variant="muted">Add Billings</Button>} />
      </Sidebar>
    </div>
  );
}
