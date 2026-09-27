import { Building2 } from "lucide-react";
import { Avatar, LogoTile } from "@/components/crm/avatar";

export default function Example() {
  return (
    <div className="flex items-center gap-4">
      <Avatar name="Alex Santos" size="sm" />
      <Avatar name="Grace Miller" size="md" />
      <Avatar name="Jensen Ackles" size="lg" badge={<span className="bg-crm-primary" />} />
      <LogoTile size="sm">
        <Building2 />
      </LogoTile>
      <LogoTile>
        <Building2 />
      </LogoTile>
      <LogoTile size="lg">
        <Building2 />
      </LogoTile>
    </div>
  );
}
