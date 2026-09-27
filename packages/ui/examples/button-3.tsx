import { Bell, Search } from "lucide-react";
import { IconButton } from "@/components/crm/button";

export default function Example() {
  return (
    <div className="flex items-center gap-2">
      <IconButton label="Search">
        <Search />
      </IconButton>
      <IconButton label="Notifications, 3 unread" dot>
        <Bell />
      </IconButton>
    </div>
  );
}
