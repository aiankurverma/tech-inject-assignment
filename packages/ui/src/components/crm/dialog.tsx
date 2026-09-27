import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-crm-in",
        className,
      )}
    />
  );
}

export interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  title: string;
  description?: string;
  footer?: React.ReactNode;
}

/** Centered modal: header (title, description, close), scrollable body, footer actions. */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent({ title, description, footer, className, children, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col",
          "rounded-xl border border-crm-border bg-crm-sidebar font-crm text-crm-fg shadow-crm-overlay outline-none data-[state=open]:animate-crm-in",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-crm-border px-6 py-5">
          <div>
            <DialogPrimitive.Title className="text-base font-semibold">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-xs text-crm-soft">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            className="rounded-full p-1 text-crm-soft outline-none hover:bg-crm-muted hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
          >
            <X className="size-3.5" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-crm-border px-6 py-4">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

/** Padded body block with an optional uppercase heading; blocks are separated by borders. */
export function DialogSection({
  title,
  className,
  children,
}: {
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 border-b border-crm-border px-6 py-5 last:border-b-0",
        className,
      )}
    >
      {title ? <h3 className="crm-eyebrow text-crm-soft">{title}</h3> : null}
      {children}
    </section>
  );
}
