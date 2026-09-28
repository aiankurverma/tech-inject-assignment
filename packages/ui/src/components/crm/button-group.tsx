import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/crm/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/crm/dropdown-menu";

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Accessible name for the group. */
  label?: string;
  orientation?: "horizontal" | "vertical";
}

/** Joins adjacent buttons into one control: inner corners squared, thin dividers between. */
export function ButtonGroup({
  label,
  orientation = "horizontal",
  className,
  children,
  ...props
}: ButtonGroupProps) {
  const vertical = orientation === "vertical";
  return (
    <div
      role="group"
      aria-label={label}
      aria-orientation={orientation}
      className={cn(
        "isolate inline-flex [&>*:focus-visible]:z-10",
        vertical
          ? "flex-col [&>*]:rounded-xl [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t [&>*:not(:first-child)]:border-crm-border [&>*:not(:last-child)]:rounded-b-none"
          : "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l [&>*:not(:first-child)]:border-crm-border [&>*:not(:last-child)]:rounded-r-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface SplitButtonProps extends Omit<ButtonProps, "asChild"> {
  /** Menu content shown from the chevron half (DropdownMenuItem etc.). */
  menu: React.ReactNode;
  /** Accessible name for the chevron trigger. */
  menuLabel?: string;
  menuAlign?: "start" | "center" | "end";
}

/** Primary action plus a chevron that opens a menu of related actions. */
export const SplitButton = React.forwardRef<HTMLButtonElement, SplitButtonProps>(
  function SplitButton(
    { menu, menuLabel = "More options", menuAlign = "end", variant, size, disabled, ...props },
    ref,
  ) {
    return (
      <ButtonGroup>
        <Button ref={ref} variant={variant} size={size} disabled={disabled} {...props} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={variant}
              size={size}
              disabled={disabled}
              aria-label={menuLabel}
              className="px-2"
            >
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={menuAlign}>{menu}</DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    );
  },
);
