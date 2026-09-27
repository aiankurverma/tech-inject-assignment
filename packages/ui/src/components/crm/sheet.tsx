import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const sides = {
  right:
    "inset-y-0 right-0 h-full w-full max-w-[480px] border-l data-[state=open]:animate-crm-sheet-in",
  left: "inset-y-0 left-0 h-full w-[280px] border-r data-[state=open]:animate-crm-in",
  bottom:
    "inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-2xl border-t data-[state=open]:animate-crm-in",
} as const;

export interface SheetContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  side?: keyof typeof sides;
  title: string;
  /** Hide the visual header but keep the title for screen readers. */
  hideHeader?: boolean;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
}

/** Side panel (right detail panel, left mobile nav, bottom mobile filters). */
export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(function SheetContent(
  { side = "right", title, hideHeader, icon, footer, className, children, ...props },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        ref={ref}
        aria-describedby={undefined}
        className={cn(
          "fixed z-50 flex flex-col border-crm-border bg-crm-sidebar font-crm text-crm-fg shadow-crm-overlay outline-none",
          sides[side],
          className,
        )}
        {...props}
      >
        {hideHeader ? (
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        ) : (
          <div className="flex items-center justify-between gap-3 border-b border-crm-border px-5 py-4">
            <DialogPrimitive.Title className="flex items-center gap-2 text-sm font-medium [&_svg]:size-3.5">
              {icon}
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close"
              className="rounded-full p-1 text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <X className="size-3.5" />
            </DialogPrimitive.Close>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <div className="flex items-center justify-between gap-2 border-t border-crm-border px-5 py-3">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

/** Bordered block inside a sheet with an optional uppercase heading and action. */
export function SheetSection({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-4 border-b border-crm-border px-5 py-5", className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-2">
          {title ? <h3 className="crm-eyebrow font-medium text-crm-fg">{title}</h3> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
