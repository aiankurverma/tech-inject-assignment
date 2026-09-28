import * as React from "react";
import { Copy, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react";
import { IconButton } from "@/components/crm/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/crm/dropdown-menu";

export default function Example() {
  const [pinned, setPinned] = React.useState(true);
  return (
    <div className="flex h-[340px] w-[360px] items-start justify-start p-4">
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton label="Deal actions">
            <MoreHorizontal />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Deal</DropdownMenuLabel>
          <DropdownMenuItem icon={<Pencil />} shortcut="E">
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem icon={<Copy />} shortcut="⌘D">
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem icon={<UserPlus />}>Reassign owner</DropdownMenuItem>
          <DropdownMenuCheckboxItem checked={pinned} onCheckedChange={(v) => setPinned(v === true)}>
            Pin to board
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<Trash2 />} destructive>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
