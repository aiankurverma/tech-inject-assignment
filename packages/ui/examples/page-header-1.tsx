import { Bell, Menu, Search } from "lucide-react";
import { StatusBadge } from "@/components/crm/badge";
import { IconButton } from "@/components/crm/button";
import { PageHeader, ProfileChip } from "@/components/crm/page-header";

export default function Example() {
  return (
    <div className="w-[760px] max-w-full rounded-crm border border-crm-border bg-crm-bg">
      <PageHeader
        title="Companies"
        badge={<StatusBadge>Active</StatusBadge>}
        leading={
          <IconButton label="Open navigation" className="md:hidden">
            <Menu />
          </IconButton>
        }
        actions={
          <>
            <IconButton label="Search">
              <Search />
            </IconButton>
            <IconButton label="Notifications, 3 unread" dot>
              <Bell />
            </IconButton>
            <ProfileChip name="Jensen Ackles" />
          </>
        }
      />
    </div>
  );
}
