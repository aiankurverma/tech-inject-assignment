import { ArrowDown, ArrowUp, CornerDownLeft } from "lucide-react";
import { Kbd } from "@/components/crm/kbd";

export default function Example() {
  return (
    <div className="flex items-center gap-2 text-xs text-crm-subtle">
      <Kbd>Esc</Kbd> <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
      <Kbd>
        <ArrowUp />
      </Kbd>
      <Kbd>
        <ArrowDown />
      </Kbd>{" "}
      Navigate
      <Kbd>
        <CornerDownLeft />
      </Kbd>{" "}
      Open
    </div>
  );
}
