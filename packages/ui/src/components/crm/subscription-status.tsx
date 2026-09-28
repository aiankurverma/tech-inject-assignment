import * as React from "react";
import { cn } from "@/lib/utils";

export type SubscriptionState =
  "trialing" | "active" | "past_due" | "unpaid" | "paused" | "canceled" | "incomplete";

const meta: Record<SubscriptionState, { label: string; dot: string; tone: string }> = {
  trialing: { label: "Trial", dot: "bg-tag-blue-text", tone: "text-tag-blue-text" },
  active: { label: "Active", dot: "bg-crm-status", tone: "text-crm-success" },
  past_due: { label: "Past due", dot: "bg-crm-warning", tone: "text-crm-warning" },
  unpaid: { label: "Unpaid", dot: "bg-crm-danger", tone: "text-crm-danger" },
  paused: { label: "Paused", dot: "bg-crm-subtle", tone: "text-crm-soft" },
  canceled: { label: "Canceled", dot: "bg-crm-subtle", tone: "text-crm-soft" },
  incomplete: { label: "Incomplete", dot: "bg-crm-warning", tone: "text-crm-warning" },
};

export interface SubscriptionStatusProps {
  status: SubscriptionState;
  /** ISO date: trial end, next renewal, grace end, or access end depending on status. */
  periodEnd?: string;
  /** Scheduled to cancel at periodEnd (status still active). */
  cancelAtPeriodEnd?: boolean;
  /** Failed payment retries so far, for past_due. */
  retryCount?: number;
  /** Clock override, for tests and SSR. */
  now?: Date;
  locale?: string;
  /** "badge" = compact pill; "detail" = pill plus explanatory line. */
  variant?: "badge" | "detail";
  /** Rendered next to the detail line (e.g. an "Update card" button). */
  action?: React.ReactNode;
  className?: string;
}

const DAY = 86_400_000;

/** Subscription lifecycle indicator: status pill plus a date-aware line (trial ends in N days, renews on, grace period, cancels on). */
export function SubscriptionStatus({
  status,
  periodEnd,
  cancelAtPeriodEnd,
  retryCount,
  now,
  locale,
  variant = "detail",
  action,
  className,
}: SubscriptionStatusProps) {
  const m = meta[status];
  const end = periodEnd ? new Date(periodEnd) : null;
  const valid = end && !Number.isNaN(end.getTime()) ? end : null;
  const today = now ?? new Date();
  const days = valid ? Math.ceil((valid.getTime() - today.getTime()) / DAY) : null;
  const date = valid
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
        valid,
      )
    : null;
  const rel = (d: number) =>
    new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(d, "day");

  const canceling = status === "active" && cancelAtPeriodEnd;
  const label = canceling ? "Canceling" : m.label;
  const dot = canceling ? "bg-crm-warning" : m.dot;
  const urgent =
    status === "past_due" ||
    status === "unpaid" ||
    (status === "trialing" && days !== null && days <= 3);

  let detail: string | null = null;
  if (date && days !== null) {
    switch (status) {
      case "trialing":
        detail = days >= 0 ? `Trial ends ${rel(days)} (${date})` : `Trial ended ${date}`;
        break;
      case "active":
        detail = canceling ? `Access ends ${date} (${rel(days)})` : `Renews ${date}`;
        break;
      case "past_due":
        detail = `Payment failed${retryCount ? ` ${retryCount}x` : ""}. Grace period ends ${rel(days)}`;
        break;
      case "unpaid":
        detail = `Access suspended since ${date}`;
        break;
      case "paused":
        detail = `Resumes ${date}`;
        break;
      case "canceled":
        detail = days >= 0 ? `Access until ${date}` : `Ended ${date}`;
        break;
      case "incomplete":
        detail = `Awaiting first payment, expires ${rel(days)}`;
        break;
    }
  }

  const pill = (
    <span
      className={cn(
        "crm-caption inline-flex shrink-0 items-center gap-1 rounded-full border border-crm-border bg-crm-muted py-[3px] pr-[6px] pl-[4px] font-crm text-crm-fg",
        variant === "badge" && className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot, urgent && "animate-pulse")} aria-hidden />
      <span className="sr-only">Subscription status: </span>
      {label}
    </span>
  );

  if (variant === "badge") return pill;

  return (
    <div
      role="status"
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 font-crm", className)}
    >
      {pill}
      {detail ? (
        <span className={cn("text-xs", urgent ? m.tone : "text-crm-soft")}>{detail}</span>
      ) : null}
      {action ? <span className="ml-auto">{action}</span> : null}
    </div>
  );
}
