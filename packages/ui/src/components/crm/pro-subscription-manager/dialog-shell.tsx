import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}

/** Radix Dialog with CRM styling: focus trap, Escape, scroll lock and aria wiring come from Radix. */
export function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: DialogShellProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-crm border border-crm-border bg-crm-card font-crm text-crm-fg shadow-crm-raised outline-none",
            wide ? "max-w-[640px]" : "max-w-[460px]",
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-crm-border px-4 py-3">
            <div>
              <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-xs text-crm-subtle">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="grid size-7 place-items-center rounded-crm text-crm-subtle outline-none hover:bg-crm-muted focus-visible:ring-2 focus-visible:ring-crm-ring/60"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-crm-border px-4 py-3">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ErrorNote({ error }: { error: Error | null | undefined }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-3 rounded-crm bg-crm-danger/10 px-3 py-2 text-xs text-crm-danger">
      {error.message}
    </p>
  );
}
