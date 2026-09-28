import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "border-tag-blue-border bg-tag-blue-bg text-tag-blue-text", icon: Info },
  success: {
    cls: "border-tag-green-border bg-tag-green-bg text-tag-green-text",
    icon: CheckCircle2,
  },
  warning: {
    cls: "border-tag-amber-border bg-tag-amber-bg text-tag-amber-text",
    icon: AlertTriangle,
  },
  danger: { cls: "border-tag-red-border bg-tag-red-bg text-tag-red-text", icon: XCircle },
} as const;

export type AlertTone = keyof typeof tones;

export interface AlertProps {
  tone?: AlertTone;
  title: React.ReactNode;
  children?: React.ReactNode;
  /** Buttons or links shown under the text. */
  action?: React.ReactNode;
  /** Shows a close button when set. */
  onDismiss?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

/** Inline banner for page or form messages. Danger/warning use role="alert", others role="status". */
export function Alert({
  tone = "info",
  title,
  children,
  action,
  onDismiss,
  icon,
  className,
}: AlertProps) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-crm border px-3 py-2.5 font-crm",
        t.cls,
        className,
      )}
    >
      <span className="mt-px shrink-0 [&_svg]:size-4">{icon ?? <Icon />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {children ? <div className="mt-1 text-xs text-crm-soft">{children}</div> : null}
        {action ? <div className="mt-2 flex gap-2">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="grid size-5 shrink-0 cursor-pointer place-items-center rounded text-crm-soft outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
