import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export interface PopoverContentProps extends React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
> {
  /** Optional heading with a close button. */
  title?: string;
  description?: string;
  /** Footer actions, right aligned. */
  footer?: React.ReactNode;
  /** Show a small arrow pointing at the trigger. */
  arrow?: boolean;
}

/** Floating panel anchored to a trigger. Esc and outside click close it; focus returns to the trigger. */
export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(function PopoverContent(
  {
    title,
    description,
    footer,
    arrow,
    className,
    children,
    sideOffset = 6,
    align = "center",
    ...props
  },
  ref,
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 w-[300px] max-w-[calc(100vw-2rem)] rounded-xl border border-crm-border bg-crm-popover font-crm text-crm-fg shadow-crm-overlay outline-none data-[state=open]:animate-crm-in",
          title || footer ? "p-0" : "p-3",
          className,
        )}
        {...props}
      >
        {title ? (
          <div className="flex items-start justify-between gap-3 border-b border-crm-border px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{title}</p>
              {description ? <p className="mt-0.5 text-xs text-crm-soft">{description}</p> : null}
            </div>
            <PopoverPrimitive.Close
              aria-label="Close"
              className="rounded-full p-1 text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <X className="size-3.5" />
            </PopoverPrimitive.Close>
          </div>
        ) : null}
        {title || footer ? <div className="px-4 py-3">{children}</div> : children}
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-crm-border px-4 py-3">
            {footer}
          </div>
        ) : null}
        {arrow ? (
          <PopoverPrimitive.Arrow width={12} height={6} className="fill-crm-popover" />
        ) : null}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
});
