import * as React from "react";
import { Avatar } from "@/components/crm/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/crm/popover";
import { StatusDot, type PresenceStatus } from "@/components/crm/status-dot";
import { cn } from "@/lib/utils";

export interface PresenceViewer {
  id: string;
  name: string;
  src?: string;
  status?: PresenceStatus;
  /** What the person is doing right now, e.g. "Editing Amount". */
  activity?: string;
  /** Last heartbeat. Viewers idle longer than `idleAfterMs` render as away. */
  lastActiveAt?: Date | string | number;
  /** Ring colour used for their cursor / field highlight elsewhere in the app. */
  color?: string;
}

export interface PresenceAvatarsProps {
  viewers: PresenceViewer[];
  /** Id of the current user; they are excluded from the stack. */
  currentUserId?: string;
  max?: number;
  /** Heartbeat age after which an online viewer is shown as away. */
  idleAfterMs?: number;
  /** Clock override, mainly for tests and stories. */
  now?: Date;
  size?: "sm" | "md";
  onViewerClick?: (viewer: PresenceViewer) => void;
  className?: string;
}

const rank: Record<PresenceStatus, number> = { online: 0, busy: 1, away: 2, offline: 3 };

function effectiveStatus(v: PresenceViewer, now: number, idle: number): PresenceStatus {
  const s = v.status ?? "online";
  if (s === "online" && v.lastActiveAt !== undefined) {
    if (now - new Date(v.lastActiveAt).getTime() > idle) return "away";
  }
  return s;
}

/**
 * Live "who is viewing this record" stack. Sorts active people first, fades idle ones, shows a
 * coloured ring per collaborator and a popover listing everyone with what they are doing.
 */
export function PresenceAvatars({
  viewers,
  currentUserId,
  max = 4,
  idleAfterMs = 5 * 60_000,
  now,
  size = "sm",
  onViewerClick,
  className,
}: PresenceAvatarsProps) {
  const [tick, setTick] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (now) return;
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [now]);
  const t = now ? now.getTime() : tick;

  const list = viewers
    .filter((v) => v.id !== currentUserId)
    .map((v) => ({ ...v, eff: effectiveStatus(v, t, idleAfterMs) }))
    .filter((v) => v.eff !== "offline")
    .sort((a, b) => rank[a.eff] - rank[b.eff] || a.name.localeCompare(b.name));

  if (list.length === 0) {
    return <span className={cn("crm-caption text-crm-subtle", className)}>Only you</span>;
  }

  const shown = list.slice(0, max);
  const hidden = list.length - shown.length;
  const active = list.filter((v) => v.eff === "online").length;
  const avatarSize = size === "sm" ? "md" : "lg";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${list.length} ${list.length === 1 ? "person" : "people"} viewing, ${active} active. Show list`}
          className={cn(
            "inline-flex items-center rounded-full p-1 font-crm outline-none focus-visible:ring-2 focus-visible:ring-crm-ring/60",
            className,
          )}
        >
          {shown.map((v, i) => (
            <span
              key={v.id}
              className={cn(
                "relative shrink-0 rounded-full transition-opacity",
                !v.color && "ring-2 ring-crm-card",
                i > 0 &&
                  (v.color || shown[i - 1]?.color ? "ml-2" : size === "sm" ? "-ml-2" : "-ml-3"),
                v.eff !== "online" && "opacity-55",
              )}
              style={{
                boxShadow: v.color
                  ? `0 0 0 2px var(--color-crm-card), 0 0 0 4px ${v.color}`
                  : undefined,
              }}
            >
              <Avatar name={v.name} src={v.src} size={avatarSize} />
              <StatusDot
                status={v.eff}
                size="md"
                className="absolute right-0 bottom-0 rounded-full ring-2 ring-crm-card"
                aria-hidden
              />
            </span>
          ))}
          {hidden > 0 ? (
            <span
              aria-hidden
              className={cn(
                "grid shrink-0 place-items-center rounded-full bg-crm-raised font-medium text-crm-soft ring-2 ring-crm-card",
                size === "sm" ? "-ml-2 size-8 text-[11px]" : "-ml-3 size-12 text-sm",
              )}
            >
              +{hidden}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        title="Viewing now"
        description={`${active} active · ${list.length - active} idle`}
      >
        <ul className="-mx-2 flex max-h-64 flex-col overflow-y-auto">
          {list.map((v) => {
            const Row = onViewerClick ? "button" : "div";
            return (
              <li key={v.id}>
                <Row
                  {...(onViewerClick
                    ? { type: "button" as const, onClick: () => onViewerClick(v) }
                    : {})}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none hover:bg-crm-muted focus-visible:bg-crm-muted"
                >
                  <Avatar name={v.name} src={v.src} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-crm-fg">{v.name}</span>
                    <span className="block truncate crm-caption text-crm-soft">
                      {v.activity ?? (v.eff === "online" ? "Viewing" : "Idle")}
                    </span>
                  </span>
                  <StatusDot status={v.eff} />
                </Row>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
