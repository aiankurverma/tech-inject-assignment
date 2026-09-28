import { Archive, Pencil, Star } from "lucide-react";
import { IconButton } from "@/components/crm/button";
import { Tooltip } from "@/components/crm/tooltip";

export default function Example() {
  return (
    <div className="flex gap-2 p-10">
      <Tooltip content="Edit deal">
        <IconButton label="Edit">
          <Pencil />
        </IconButton>
      </Tooltip>
      <Tooltip content="Add to favourites" side="bottom">
        <IconButton label="Favourite">
          <Star />
        </IconButton>
      </Tooltip>
      <Tooltip
        content="Archived deals are hidden from the board but keep their history."
        side="right"
      >
        <IconButton label="Archive">
          <Archive />
        </IconButton>
      </Tooltip>
    </div>
  );
}
