import * as React from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;

/** Floating menu panel. Radix handles arrow keys, typeahead, Escape and focus return. */
export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof Menu.Content>,
  React.ComponentPropsWithoutRef<typeof Menu.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, align = "start", ...props }, ref) {
  return (
    <Menu.Portal>
      <Menu.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 min-w-[180px] rounded-xl border border-crm-border bg-crm-popover p-1 font-crm text-crm-fg shadow-crm-overlay outline-none data-[state=open]:animate-crm-in",
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
});

export interface DropdownMenuItemProps extends React.ComponentPropsWithoutRef<typeof Menu.Item> {
  icon?: React.ReactNode;
  shortcut?: string;
  destructive?: boolean;
}

const itemCls =
  "relative flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-crm-muted [&_svg]:size-3.5 [&_svg]:shrink-0";

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof Menu.Item>,
  DropdownMenuItemProps
>(function DropdownMenuItem({ className, icon, shortcut, destructive, children, ...props }, ref) {
  return (
    <Menu.Item
      ref={ref}
      className={cn(itemCls, destructive ? "text-crm-danger" : "text-crm-fg", className)}
      {...props}
    >
      {icon ? <span className={destructive ? undefined : "text-crm-soft"}>{icon}</span> : null}
      <span className="flex-1">{children}</span>
      {shortcut ? <span className="text-xs text-crm-subtle">{shortcut}</span> : null}
    </Menu.Item>
  );
});

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof Menu.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof Menu.CheckboxItem>
>(function DropdownMenuCheckboxItem({ className, children, ...props }, ref) {
  return (
    <Menu.CheckboxItem ref={ref} className={cn(itemCls, "pl-7 text-crm-fg", className)} {...props}>
      <Menu.ItemIndicator className="absolute left-2 text-crm-primary">
        <Check />
      </Menu.ItemIndicator>
      {children}
    </Menu.CheckboxItem>
  );
});

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Menu.Label>) {
  return (
    <Menu.Label
      className={cn("crm-eyebrow px-2 pt-2 pb-1.5 text-crm-subtle", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <Menu.Separator className={cn("my-1 h-px bg-crm-border", className)} />;
}
