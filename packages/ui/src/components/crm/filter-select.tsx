import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterSelectProps {
  /** Muted prefix inside the pill, e.g. "Sort by". */
  label: string;
  options: string[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

/** Segmented pill trigger "Label | Value" that opens a radio menu. Keyboard: Enter/Space/Arrow keys. */
export function FilterSelect({
  label,
  options,
  value,
  onValueChange,
  className,
}: FilterSelectProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`${label}: ${value}`}
        className={cn(
          "group inline-flex h-[30px] shrink-0 cursor-pointer items-center rounded-full bg-crm-raised font-crm text-xs font-medium text-crm-fg shadow-crm-raised",
          "outline-none transition-[background-color,box-shadow] duration-150 ease-crm hover:bg-crm-muted",
          "focus-visible:ring-2 focus-visible:ring-crm-ring/60 data-[state=open]:ring-1 data-[state=open]:ring-crm-input",
          className,
        )}
      >
        <span className="border-r border-crm-border px-2.5 font-normal text-crm-subtle">
          {label}
        </span>
        <span className="flex items-center gap-1.5 px-2.5">
          {value}
          <ChevronDown
            className="size-3 text-crm-soft transition-transform duration-150 group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 max-h-[min(360px,var(--radix-dropdown-menu-content-available-height))] min-w-40 overflow-y-auto rounded-crm bg-crm-popover p-1 font-crm shadow-crm-overlay data-[state=open]:animate-crm-in"
        >
          <DropdownMenu.Label className="px-3 pt-1.5 pb-2 text-xs text-crm-subtle">
            {label}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>
            {options.map((o) => (
              <DropdownMenu.RadioItem
                key={o}
                value={o}
                className="relative flex cursor-pointer items-center rounded-md py-1.5 pr-3 pl-7 text-xs text-crm-soft outline-none select-none data-[highlighted]:bg-crm-muted data-[highlighted]:text-crm-fg data-[state=checked]:font-medium data-[state=checked]:text-crm-fg"
              >
                <DropdownMenu.ItemIndicator className="absolute left-3">
                  <span className="block size-1.5 rounded-full bg-crm-status" />
                </DropdownMenu.ItemIndicator>
                {o}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
