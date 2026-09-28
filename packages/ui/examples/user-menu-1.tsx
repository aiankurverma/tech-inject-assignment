import { CreditCard, HelpCircle, Keyboard, Settings, User } from "lucide-react";
import { DropdownMenuItem } from "@/components/crm/dropdown-menu";
import { UserMenu } from "@/components/crm/user-menu";

const user = { name: "Maya Chen", email: "maya@acme.io", role: "Admin" };

export default function Example() {
  return (
    <div className="flex h-[360px] w-[460px] items-start justify-between gap-6 font-crm text-crm-fg">
      <div className="flex items-center gap-3">
        <div className="w-[220px] rounded-xl border border-crm-border bg-crm-sidebar p-2">
          <UserMenu user={user} trigger="full" side="bottom" align="start" onSignOut={() => {}}>
            <DropdownMenuItem icon={<User />}>Profile</DropdownMenuItem>
            <DropdownMenuItem icon={<Settings />} shortcut="⌘,">
              Settings
            </DropdownMenuItem>
          </UserMenu>
        </div>
      </div>
      <div className="flex h-[66px] items-center">
        <UserMenu user={user} status="online" defaultOpen modal={false} onSignOut={() => {}}>
          <DropdownMenuItem icon={<User />}>Profile</DropdownMenuItem>
          <DropdownMenuItem icon={<CreditCard />}>Billing</DropdownMenuItem>
          <DropdownMenuItem icon={<Keyboard />} shortcut="?">
            Shortcuts
          </DropdownMenuItem>
          <DropdownMenuItem icon={<HelpCircle />}>Help center</DropdownMenuItem>
        </UserMenu>
      </div>
    </div>
  );
}
