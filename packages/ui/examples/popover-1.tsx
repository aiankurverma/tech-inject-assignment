import { CalendarClock } from "lucide-react";
import { Button } from "@/components/crm/button";
import { FormField, Input } from "@/components/crm/input";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/crm/popover";

export default function Example() {
  return (
    <div className="flex h-[260px] items-start font-crm text-crm-fg">
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button>
            <CalendarClock /> Snooze
          </Button>
        </PopoverTrigger>
        <PopoverContent
          title="Snooze follow-up"
          description="The deal leaves your inbox until then."
          align="start"
          footer={
            <>
              <PopoverClose asChild>
                <Button size="sm">Cancel</Button>
              </PopoverClose>
              <PopoverClose asChild>
                <Button size="sm" variant="primary">
                  Snooze
                </Button>
              </PopoverClose>
            </>
          }
        >
          <FormField label="Remind me on" htmlFor="pop-date">
            <Input id="pop-date" type="date" defaultValue="2026-10-05" />
          </FormField>
        </PopoverContent>
      </Popover>
    </div>
  );
}
