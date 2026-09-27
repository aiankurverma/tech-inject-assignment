import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  /** Optional leading node, e.g. an Avatar. */
  icon?: React.ReactNode;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Form select with the CRM dark list and a dot on the selected option. */
export function Select({
  options,
  placeholder = "Select...",
  id,
  invalid,
  className,
  ...props
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={props.value}
      defaultValue={props.defaultValue}
      onValueChange={props.onValueChange}
      disabled={props.disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={props["aria-label"]}
        aria-invalid={invalid || undefined}
        className={cn(
          "group flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-crm border border-crm-input/60 bg-crm-raised px-3 font-crm text-sm font-medium text-crm-fg",
          "outline-none transition-colors duration-150 ease-crm hover:border-crm-input focus-visible:ring-2 focus-visible:ring-crm-ring/40",
          "aria-[invalid=true]:border-crm-danger data-[placeholder]:text-crm-subtle disabled:opacity-50",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <ChevronDown
          className="size-3.5 text-crm-subtle transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-crm bg-crm-popover p-1 font-crm shadow-crm-overlay data-[state=open]:animate-crm-in"
        >
          <SelectPrimitive.Viewport>
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer items-center gap-2 rounded-md py-2 pr-3 pl-6 text-sm text-crm-soft outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-crm-muted data-[highlighted]:text-crm-fg data-[state=checked]:text-crm-fg"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2.5">
                  <span className="block size-1.5 rounded-full bg-crm-status" />
                </SelectPrimitive.ItemIndicator>
                {o.icon}
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
