import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";
import { Input } from "@/components/crm/input";

export interface ConfirmDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the dialog (rendered with asChild). */
  trigger?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for destructive actions (red confirm, warning icon). */
  tone?: "danger" | "default";
  /** User must type this exact text before confirming (e.g. the record name). */
  confirmText?: string;
  /** May return a promise; the button shows a spinner and the dialog closes when it resolves. */
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

/** Destructive confirmation. alertdialog role, focus starts on Cancel, Esc cancels,
 *  outside clicks are ignored so a stray click cannot dismiss it. */
export function ConfirmDialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "danger",
  confirmText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [innerOpen, setInnerOpen] = React.useState(defaultOpen ?? false);
  const isOpen = open ?? innerOpen;
  const [busy, setBusy] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const inputId = React.useId();

  const setOpen = (next: boolean) => {
    if (busy) return;
    if (open === undefined) setInnerOpen(next);
    onOpenChange?.(next);
    if (!next) {
      setTyped("");
      setError(null);
    }
  };

  const blocked = confirmText !== undefined && typed !== confirmText;

  const confirm = async () => {
    if (blocked || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setBusy(false);
      if (open === undefined) setInnerOpen(false);
      onOpenChange?.(false);
      setTyped("");
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  };

  const danger = tone === "danger";

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-crm-in" />
        <DialogPrimitive.Content
          role="alertdialog"
          onOpenAutoFocus={(e) => {
            if (confirmText === undefined) {
              e.preventDefault();
              cancelRef.current?.focus();
            }
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={() => onCancel?.()}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border border-crm-border bg-crm-sidebar p-6 font-crm text-crm-fg shadow-crm-overlay outline-none data-[state=open]:animate-crm-in",
          )}
        >
          <div className="flex gap-4">
            <span
              aria-hidden
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-4",
                danger ? "bg-crm-danger/15 text-crm-danger" : "bg-crm-primary/20 text-crm-fg",
              )}
            >
              {danger ? <AlertTriangle /> : <Info />}
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-base font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1.5 text-sm text-crm-soft">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">
                  {title}
                </DialogPrimitive.Description>
              )}
              {confirmText !== undefined ? (
                <div className="mt-4 flex flex-col gap-1.5">
                  <label htmlFor={inputId} className="text-xs text-crm-soft">
                    Type <span className="font-medium text-crm-fg">{confirmText}</span> to confirm
                  </label>
                  <Input
                    id={inputId}
                    value={typed}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void confirm();
                    }}
                  />
                </div>
              ) : null}
              {error ? (
                <p role="alert" className="mt-3 text-xs text-crm-danger">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              ref={cancelRef}
              disabled={busy}
              onClick={() => {
                onCancel?.();
                setOpen(false);
              }}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={danger ? "danger" : "primary"}
              loading={busy}
              disabled={blocked}
              onClick={() => void confirm()}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
