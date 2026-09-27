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
      </SheetContent>
    </Sheet>
  );
}
