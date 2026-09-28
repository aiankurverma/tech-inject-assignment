import * as React from "react";
import { Bold, Columns3, Italic, LayoutGrid, List, Underline } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/crm/toggle-group";

export default function Example() {
  const [view, setView] = React.useState("board");
  return (
    <div className="flex flex-col items-start gap-4 font-crm text-crm-fg">
      <div className="flex items-center gap-3">
        <ToggleGroup type="single" label="View" value={view} onValueChange={setView}>
          <ToggleGroupItem value="list" icon={<List />}>
            List
          </ToggleGroupItem>
          <ToggleGroupItem value="board" icon={<Columns3 />}>
            Board
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" icon={<LayoutGrid />}>
            Grid
          </ToggleGroupItem>
        </ToggleGroup>
        <span className="text-xs text-crm-subtle">Showing {view} view</span>
      </div>

      <ToggleGroup type="multiple" label="Formatting" size="sm" defaultValue={["bold"]}>
        <ToggleGroupItem value="bold" label="Bold" icon={<Bold />} />
        <ToggleGroupItem value="italic" label="Italic" icon={<Italic />} />
        <ToggleGroupItem value="underline" label="Underline" icon={<Underline />} />
      </ToggleGroup>
    </div>
  );
}
