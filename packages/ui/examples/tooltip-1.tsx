import { Archive, Pencil, Star } from "lucide-react";
import { IconButton } from "@/components/crm/button";
import { Tooltip } from "@/components/crm/tooltip";

export default function Example() {
  return (
    <div className="w-full max-w-md rounded-crm border border-crm-border bg-crm-card p-4 pb-12 font-crm text-crm-fg">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Acme Corp · Renewal</p>
          <p className="text-xs text-crm-soft">$120,000 · Negotiation · closes Oct 14</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Tooltip content="Edit deal">
            <IconButton label="Edit">
              <Pencil />
            </IconButton>
          </Tooltip>
          <Tooltip content="Add to favourites" side="bottom" defaultOpen>
            <IconButton label="Favourite">
              <Star />
            </IconButton>
          </Tooltip>
          <Tooltip
            content="Archived deals are hidden from the board but keep their history."
            side="bottom"
          >
            <IconButton label="Archive">
              <Archive />
            </IconButton>
          </Tooltip>
        </div>
      </div>
      <p className="mt-3 text-xs text-crm-soft">Hover or focus an action to see its tooltip.</p>
    </div>
  );
}
