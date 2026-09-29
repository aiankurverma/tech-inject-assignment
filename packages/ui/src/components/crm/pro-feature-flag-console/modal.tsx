import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Blocks Escape / outside click / close button (used while a request is pending or a secret is unsaved). */
  locked?: boolean;
  className?: string;
  /** Portal target; defaults to document.body. */
  container?: HTMLElement | null;
}

/** Radix Dialog shell with CRM styling. Radix provides focus trap, scroll lock and aria wiring. */
export function FlagModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  locked,
  className,
  container,
}: FlagModalProps) {
  const block = (e: Event) => {
    if (locked) e.preventDefault();
  };
  return (
    <Dialog.Root open={open} onOpenChange={(o) => (!o && locked ? undefined : onOpenChange(o))}>
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
        <Dialog.Content
          onEscapeKeyDown={block}
          onPointerDownOutside={block}
          onInteractOutside={block}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col",
            "rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised outline-none",
            className,
          )}
        >
          <div className="flex items-start gap-3 border-b border-crm-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-[15px] font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-[13px] text-crm-muted-fg">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              disabled={locked}
              aria-label="Close"
              className="rounded-md p-1 text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-crm-ring disabled:opacity-40"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-crm-border px-5 py-3">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function FlagButton({
  variant = "secondary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-crm-ring disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-crm-primary text-crm-primary-fg hover:bg-crm-primary/90",
        variant === "secondary" &&
          "border border-crm-border bg-crm-raised text-crm-fg hover:bg-crm-muted",
        variant === "danger" && "bg-crm-danger/90 text-black hover:bg-crm-danger",
        variant === "ghost" && "text-crm-soft hover:bg-crm-muted hover:text-crm-fg",
        className,
      )}
      {...props}
    />
  );
}
