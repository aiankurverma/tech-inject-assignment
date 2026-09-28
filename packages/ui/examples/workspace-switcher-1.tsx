import * as React from "react";
import { Settings } from "lucide-react";
import { DropdownMenuItem } from "@/components/crm/dropdown-menu";
import { WorkspaceSwitcher } from "@/components/crm/workspace-switcher";

const workspaces = [
  { id: "acme", name: "Acme Inc.", meta: "Pro · 12 members" },
  { id: "globex", name: "Globex Sales", meta: "Starter · 4 members" },
  { id: "initech", name: "Initech EMEA", meta: "Pro · 27 members" },
];

export default function Example() {
  const [id, setId] = React.useState("acme");
  return (
    <div className="w-[240px] rounded-xl border border-crm-border bg-crm-sidebar p-2 font-crm">
      <WorkspaceSwitcher
        workspaces={workspaces}
        value={id}
        onValueChange={setId}
        onCreate={() => {}}
      >
        <DropdownMenuItem icon={<Settings />}>Workspace settings</DropdownMenuItem>
      </WorkspaceSwitcher>
    </div>
  );
}
