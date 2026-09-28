import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export interface DrawerContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  title: string;
  description?: string;
  /** Hide the visible title (kept for screen readers). */
  hideTitle?: boolean;
  footer?: React.ReactNode;
  /** Drag distance in px past which releasing the handle closes the drawer. */
  dismissThreshold?: number;
}

/** Mobile bottom sheet with a grab handle. Drag the handle (or the header) down to dismiss;
 *  Esc, the overlay and DrawerClose also close it. Focus is trapped while open. */
export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(function DrawerContent(
  {
    title,
    description,
    hideTitle,
    footer,
    dismissThreshold = 120,
    className,
    children,
    style,
    ...props
  },
  ref,
) {
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const start = React.useRef<number | null>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    start.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (start.current === null) return;
    setOffset(Math.max(0, e.clientY - start.current));
  };
  const onPointerUp = () => {
    if (start.current === null) return;
    start.current = null;
    setDragging(false);
    if (offset > dismissThreshold) closeRef.current?.click();
    setOffset(0);
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-crm-in"
        style={{ opacity: offset ? Math.max(0.2, 1 - offset / 400) : undefined }}
      />
      <DialogPrimitive.Content
        ref={ref}
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90vh] w-full max-w-[640px] flex-col",
          "rounded-t-2xl border border-b-0 border-crm-border bg-crm-sidebar font-crm text-crm-fg shadow-crm-overlay outline-none",
          "pb-[env(safe-area-inset-bottom)] data-[state=open]:animate-crm-sheet-in",
          !dragging && "transition-transform duration-200 ease-crm",
          className,
        )}
        style={{ ...style, transform: offset ? `translateY(${offset}px)` : undefined }}
        {...props}
      >
        <div
          className="cursor-grab touch-none px-5 pt-2.5 pb-3 select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-crm-faint" />
          <DialogPrimitive.Title
            className={cn("mt-3 text-center text-sm font-medium", hideTitle && "sr-only")}
          >
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-center text-xs text-crm-soft">
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </div>
        <DialogPrimitive.Close ref={closeRef} className="sr-only">
          Close
        </DialogPrimitive.Close>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-crm-border px-5 py-3 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
