import * as React from "react";
import { Avatar } from "@/components/crm/avatar";
import { type PresenceStatus } from "@/components/crm/status-dot";
import { formatRelative } from "@/components/crm/relative-time";
import { cn } from "@/lib/utils";

const dot: Record<PresenceStatus, string> = {
  online: "bg-crm-success",
  away: "bg-crm-warning",
  busy: "bg-crm-danger",
  offline: "bg-crm-faint",
};
const labels: Record<PresenceStatus, string> = {
  online: "Online",
  away: "Away",
  busy: "Do not disturb",
  offline: "Offline",
};

const dotSize = {
  sm: "size-2 ring-[1.5px]",
  md: "size-2.5 ring-2",
  lg: "size-3.5 ring-2",
} as const;
const avatarSize = { sm: "sm", md: "md", lg: "lg" } as const;

export interface PresenceIndicatorProps {
  name: string;
  src?: string;
  /** Reported status. "online" auto-degrades to "away" when `lastActiveAt` is older than `idleAfter`. */
  status: PresenceStatus;
  /** Last activity timestamp; drives idle detection and the "Active 12m ago" line. */
  lastActiveAt?: Date | string | number;
  /** Minutes of inactivity before an online user is shown as away. */
  idleAfter?: number;
  /** Custom status, e.g. "On a customer call". */
  message?: string;
  emoji?: string;
  /** When the custom status / DND clears ("until 3:30 PM"). Expired messages are hidden. */
  until?: Date | string | number;
  /** User's IANA time zone; shows their local time when it differs from the viewer's. */
  timeZone?: string;
  size?: keyof typeof dotSize;
  /** "avatar" = avatar + dot only; "inline" = name + status line; "card" = with message and local time. */
  layout?: "avatar" | "inline" | "card";
  /** Refresh interval for relative times / idle detection (ms). */
  tick?: number;
  className?: string;
}

const toDate = (v?: Date | string | number) => (v === undefined ? undefined : new Date(v));

/** Derive the effective presence from reported status + last activity. */
export function effectivePresence(
  status: PresenceStatus,
  lastActiveAt: Date | undefined,
  idleAfterMin: number,
  now: Date,
): PresenceStatus {
  if (
    status === "online" &&
    lastActiveAt &&
    now.getTime() - lastActiveAt.getTime() > idleAfterMin * 60_000
  )
    return "away";
  return status;
}

/**
 * Avatar with a live presence dot. Online users go "away" automatically after `idleAfter` minutes
 * of inactivity; offline users show "Active 3h ago"; custom status messages expire at `until`; the
 * user's local time is shown for teammates in other time zones.
 */
export function PresenceIndicator({
  name,
  src,
  status,
  lastActiveAt,
  idleAfter = 10,
  message,
  emoji,
  until,
  timeZone,
  size = "md",
  layout = "avatar",
  tick = 30_000,
  className,
}: PresenceIndicatorProps) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    if (!tick) return;
    const t = setInterval(() => setNow(new Date()), tick);
    return () => clearInterval(t);
  }, [tick]);

  const last = toDate(lastActiveAt);
  const end = toDate(until);
  const effective = effectivePresence(status, last, idleAfter, now);
  const expired = !!end && end <= now;
  const showMessage = !!message && !expired;
  const untilText =
    end && !expired
      ? `until ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
      : null;

  const secondary =
    effective === "offline" || (effective === "away" && status === "online")
      ? last
        ? `Active ${formatRelative(last, now, { style: "short" })}`
        : labels[effective]
      : effective === "busy" && untilText
        ? `${labels.busy} ${untilText}`
        : labels[effective];

  let localTime: string | null = null;
  if (timeZone) {
    try {
      const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (viewerTz !== timeZone)
        localTime = now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone,
        });
    } catch {
      localTime = null;
    }
  }

  const summary = [name, secondary, showMessage ? `${emoji ? `${emoji} ` : ""}${message}` : null]
    .filter(Boolean)
    .join(", ");

  const avatar = (
    <span className="relative inline-flex shrink-0" role="img" aria-label={summary}>
      <Avatar name={name} src={src} size={avatarSize[size]} />
      <span
        aria-hidden
        className={cn(
          "absolute right-0 bottom-0 rounded-full ring-crm-bg",
          dotSize[size],
          dot[effective],
          effective === "busy" &&
            "after:absolute after:inset-x-[25%] after:top-1/2 after:h-px after:-translate-y-1/2 after:bg-white",
        )}
      />
    </span>
  );

  if (layout === "avatar")
    return (
      <span className={cn("inline-flex", className)} title={summary}>
        {avatar}
      </span>
    );

  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-2.5 font-crm",
        layout === "card" && "rounded-crm border border-crm-border bg-crm-card p-3",
        className,
      )}
    >
      {avatar}
      <div aria-hidden className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm text-crm-fg">{name}</span>
        <span className="text-xs leading-snug break-words text-crm-soft">
          {secondary}
          {localTime && layout === "card" ? ` · ${localTime} local` : null}
        </span>
        {layout === "card" && showMessage ? (
          <span className="text-xs leading-snug break-words text-crm-muted-fg">
            {emoji ? `${emoji} ` : null}
            {message}
            {untilText && effective !== "busy" ? ` · ${untilText}` : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}
