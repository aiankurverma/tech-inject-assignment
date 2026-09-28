import { CreditCard, HelpCircle, Keyboard, Settings, User } from "lucide-react";
import { DropdownMenuItem } from "@/components/crm/dropdown-menu";
import { UserMenu } from "@/components/crm/user-menu";

const user = { name: "Maya Chen", email: "maya@acme.io", role: "Admin" };

export default function Example() {
  return (
    <div className="flex w-[420px] items-start justify-between gap-6 font-crm text-crm-fg">
      <div className="w-[220px] rounded-xl border border-crm-border bg-crm-sidebar p-2">
        <UserMenu user={user} trigger="full" side="top" align="start" onSignOut={() => {}}>
          <DropdownMenuItem icon={<User />}>Profile</DropdownMenuItem>
          <DropdownMenuItem icon={<Settings />} shortcut="⌘,">
            Settings
          </DropdownMenuItem>
        </UserMenu>
      </div>
      <UserMenu user={user} status="online" onSignOut={() => {}}>
        <DropdownMenuItem icon={<User />}>Profile</DropdownMenuItem>
        <DropdownMenuItem icon={<CreditCard />}>Billing</DropdownMenuItem>
        <DropdownMenuItem icon={<Keyboard />} shortcut="?">
          Shortcuts
        </DropdownMenuItem>
        <DropdownMenuItem icon={<HelpCircle />}>Help center</DropdownMenuItem>
      </UserMenu>
    </div>
  );
}
