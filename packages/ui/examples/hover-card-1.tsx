import * as React from "react";
import { Building2, Mail, MapPin } from "lucide-react";
import { Avatar } from "@/components/crm/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/crm/hover-card";

export default function Example() {
  const [open, setOpen] = React.useState(true);
  return (
    <p className="h-[320px] w-[420px] pt-2 font-crm text-sm text-crm-soft">
      Deal owned by{" "}
      <HoverCard open={open} onOpenChange={setOpen}>
        <HoverCardTrigger>
          <a href="#maya" className="font-medium text-crm-fg underline-offset-4 hover:underline">
            Maya Chen
          </a>
        </HoverCardTrigger>
        <HoverCardContent arrow>
          <div className="flex items-center gap-3">
            <Avatar name="Maya Chen" size="lg" />
            <div>
              <p className="text-sm font-medium">Maya Chen</p>
              <p className="text-xs text-crm-soft">Account Executive</p>
            </div>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-xs text-crm-soft [&_svg]:size-3.5 [&_svg]:text-crm-subtle">
            <li className="flex items-center gap-2">
              <Building2 /> Acme Inc.
            </li>
            <li className="flex items-center gap-2">
              <Mail /> maya@acme.io
            </li>
            <li className="flex items-center gap-2">
              <MapPin /> Berlin · 14:32 local
            </li>
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-crm-border pt-3 text-xs">
            <div>
              <p className="text-crm-subtle">Open deals</p>
              <p className="font-medium text-crm-fg">12</p>
            </div>
            <div>
              <p className="text-crm-subtle">Pipeline</p>
              <p className="font-medium text-crm-fg">$840K</p>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>{" "}
      · closes in 12 days.
    </p>
  );
}
