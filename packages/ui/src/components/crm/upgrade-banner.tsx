import * as React from "react";
import { Check, Clock, Sparkles, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/crm/button";

export interface UpgradeUsage {
  /** e.g. "Contacts", "Seats", "Emails this month". */
  label: string;
  used: number;
  limit: number;
}

export type UpgradeSeverity = "info" | "approaching" | "exceeded" | "trial-ending";

export interface UpgradeBannerProps {
  /** Current plan name, e.g. "Starter". */
  plan: string;
  /** Plan being upsold, e.g. "Growth". */
  targetPlan: string;
  /** Price text for the target plan, e.g. "$49/seat/mo". */
  targetPrice?: string;
  /** Usage meters; the one closest to its limit decides severity. */
  usage?: UpgradeUsage[];
  /** Days left in trial; overrides usage severity when ≤ `trialWarnDays`. */
  trialDaysLeft?: number;
  trialWarnDays?: number;
  /** Ratio (0-1) at which usage counts as "approaching". */
  warnAt?: number;
  /** Features unlocked by the target plan. */
  features?: string[];
  onUpgrade?: () => void | Promise<void>;
  /** Called with the snooze length in days (0 = dismiss for this session only). */
  onDismiss?: (snoozeDays: number) => void;
  /** Exceeded banners cannot be dismissed unless this is true. */
  allowDismissWhenExceeded?: boolean;
  variant?: "banner" | "card";
  className?: string;
}

/** Work out what message to show from usage and trial state. */
export function upgradeSeverity(
  usage: UpgradeUsage[] = [],
  trialDaysLeft?: number,
  warnAt = 0.8,
  trialWarnDays = 7,
): { severity: UpgradeSeverity; worst?: UpgradeUsage; ratio: number } {
  const worst = [...usage].sort((a, b) => b.used / b.limit - a.used / a.limit)[0];
  const ratio = worst ? worst.used / Math.max(worst.limit, 1) : 0;
  if (ratio >= 1) return { severity: "exceeded", worst, ratio };
  if (trialDaysLeft !== undefined && trialDaysLeft <= trialWarnDays)
    return { severity: "trial-ending", worst, ratio };
  if (ratio >= warnAt) return { severity: "approaching", worst, ratio };
  return { severity: "info", worst, ratio };
}

const tone = {
  info: "border-crm-border bg-crm-card",
  approaching: "border-tag-amber-border bg-tag-amber-bg/40",
  exceeded: "border-tag-red-border bg-tag-red-bg/40",
  "trial-ending": "border-tag-purple-border bg-tag-purple-bg/40",
} as const;

const bar = {
  info: "bg-crm-primary",
  approaching: "bg-crm-warning",
  exceeded: "bg-crm-danger",
  "trial-ending": "bg-crm-primary",
} as const;

/** Contextual upsell: reacts to usage limits and trial end, with meters, unlocked features, snooze and async upgrade. */
export function UpgradeBanner({
  plan,
  targetPlan,
  targetPrice,
  usage = [],
  trialDaysLeft,
  trialWarnDays = 7,
  warnAt = 0.8,
  features = [],
  onUpgrade,
  onDismiss,
  allowDismissWhenExceeded,
  variant = "banner",
  className,
}: UpgradeBannerProps) {
  const [hidden, setHidden] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [snoozeOpen, setSnoozeOpen] = React.useState(false);
  const { severity, worst } = upgradeSeverity(usage, trialDaysLeft, warnAt, trialWarnDays);
  const titleId = React.useId();

  if (hidden) return null;

  const title =
    severity === "exceeded" && worst
      ? `You've hit your ${worst.label.toLowerCase()} limit on ${plan}`
      : severity === "trial-ending"
        ? trialDaysLeft === 0
          ? `Your ${targetPlan} trial ends today`
          : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your ${targetPlan} trial`
        : severity === "approaching" && worst
          ? `You're at ${Math.round((worst.used / worst.limit) * 100)}% of your ${worst.label.toLowerCase()} limit`
          : `Get more out of ${targetPlan}`;

  const body =
    severity === "exceeded"
      ? `New records are paused until you upgrade to ${targetPlan} or free up space.`
      : severity === "trial-ending"
        ? `Keep your automations and reports — upgrade before the trial ends to avoid losing access.`
        : `Upgrade to ${targetPlan} to raise limits and unlock advanced features.`;

  const canDismiss = !!onDismiss && (severity !== "exceeded" || allowDismissWhenExceeded);

  const upgrade = async () => {
    if (!onUpgrade) return;
    setBusy(true);
    setError(undefined);
    try {
      await onUpgrade();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upgrade failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = (days: number) => {
    onDismiss?.(days);
    setHidden(true);
  };

  const Icon = severity === "trial-ending" ? Clock : severity === "info" ? Sparkles : Zap;

  return (
    <section
      role={severity === "exceeded" ? "alert" : "region"}
      aria-labelledby={titleId}
      className={cn(
        "relative flex gap-4 rounded-crm border p-4 font-crm text-crm-fg",
        variant === "banner" ? "flex-col md:flex-row md:items-center" : "max-w-sm flex-col",
        tone[severity],
        className,
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-crm-muted shadow-crm-raised [&_svg]:size-4">
        <Icon aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <h3 id={titleId} className="text-sm font-medium">
            {title}
          </h3>
          <p className="text-xs text-crm-muted-fg">{body}</p>
        </div>
        {usage.length ? (
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {usage.map((u) => {
              const pct = Math.min(100, (u.used / Math.max(u.limit, 1)) * 100);
              const s = upgradeSeverity([u], undefined, warnAt).severity;
              return (
                <li key={u.label} className="flex min-w-[140px] flex-col gap-1">
                  <span className="flex justify-between gap-2 text-[11px] text-crm-soft">
                    <span>{u.label}</span>
                    <span className="tabular-nums">
                      {u.used.toLocaleString()} / {u.limit.toLocaleString()}
                    </span>
                  </span>
                  <span
                    role="progressbar"
                    aria-label={`${u.label} usage`}
                    aria-valuemin={0}
                    aria-valuemax={u.limit}
                    aria-valuenow={u.used}
                    className="h-1 overflow-hidden rounded-full bg-crm-track"
                  >
                    <span
                      className={cn("block h-full rounded-full", bar[s])}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {features.length ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-crm-soft">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-1">
                <Check aria-hidden className="size-3 text-crm-success" />
                {f}
              </li>
            ))}
          </ul>
        ) : null}
        {error ? (
          <p role="alert" className="text-xs text-crm-danger">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {targetPrice ? <span className="text-xs text-crm-muted-fg">{targetPrice}</span> : null}
        <Button variant="primary" loading={busy} onClick={upgrade} disabled={!onUpgrade}>
          Upgrade to {targetPlan}
        </Button>
        {canDismiss ? (
          <div className="relative">
            <Button
              variant="ghost"
              aria-haspopup="menu"
              aria-expanded={snoozeOpen}
              onClick={() => setSnoozeOpen((o) => !o)}
            >
              Later
            </Button>
            {snoozeOpen ? (
              <div
                role="menu"
                aria-label="Remind me"
                onKeyDown={(e) => e.key === "Escape" && setSnoozeOpen(false)}
                className="absolute right-0 z-10 mt-1 flex w-40 flex-col rounded-crm border border-crm-border bg-crm-popover p-1 shadow-crm-overlay"
              >
                {[
                  [1, "Tomorrow"],
                  [7, "In a week"],
                  [0, "Hide for now"],
                ].map(([d, l]) => (
                  <button
                    key={l}
                    type="button"
                    role="menuitem"
                    autoFocus={d === 1}
                    onClick={() => dismiss(d as number)}
                    className="rounded-md px-2 py-1.5 text-left text-xs text-crm-fg outline-none hover:bg-crm-muted focus-visible:bg-crm-muted"
                  >
                    {l}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {canDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => dismiss(0)}
          className="absolute top-2 right-2 rounded-full p-1 text-crm-subtle outline-none hover:text-crm-fg focus-visible:ring-2 focus-visible:ring-crm-ring/60"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </section>
  );
}
