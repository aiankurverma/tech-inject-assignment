import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/crm/button";
import { Checkbox } from "@/components/crm/checkbox";
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from "@/components/crm/drawer";

const stages = ["Lead", "Qualified", "Proposal", "Negotiation", "Won"];

export default function Example() {
  return (
    <Drawer defaultOpen>
      <DrawerTrigger asChild>
        <Button>
          <SlidersHorizontal /> Filters
        </Button>
      </DrawerTrigger>
      <DrawerContent
        title="Filter deals"
        description="Drag the handle down to close"
        footer={
          <>
            <DrawerClose asChild>
              <Button size="lg">Reset</Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button size="lg" variant="primary">
                Show 42 deals
              </Button>
            </DrawerClose>
          </>
        }
      >
        <h3 className="crm-eyebrow mb-3 text-crm-soft">Stage</h3>
        <div className="flex flex-col gap-3">
          {stages.map((s, i) => (
            <label key={s} className="flex items-center gap-3 text-sm">
              <Checkbox defaultChecked={i < 3} />
              {s}
            </label>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
