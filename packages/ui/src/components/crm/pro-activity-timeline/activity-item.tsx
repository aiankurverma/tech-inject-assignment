import { memo, useId } from "react";
import { AnimatePresence, motion } from "motion/react";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Mail,
  MailOpen,
  Phone,
  Pin,
  PinOff,
  StickyNote,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  toDate,
  type ActivityType,
  type TimeMode,
  type TimelineActivity,
} from "@/components/crm/pro-activity-timeline/types";

export const TYPE_META: Record<ActivityType, { label: string; icon: typeof Mail; tone: string }> = {
  email: { label: "Email", icon: Mail, tone: "text-sky-400 bg-sky-400/10" },
  call: { label: "Call", icon: Phone, tone: "text-crm-success bg-crm-success/10" },
  meeting: { label: "Meeting", icon: CalendarDays, tone: "text-violet-400 bg-violet-400/10" },
  note: { label: "Note", icon: StickyNote, tone: "text-crm-warning bg-crm-warning/10" },
  stage: { label: "Stage change", icon: TrendingUp, tone: "text-crm-status bg-crm-status/10" },
  task: { label: "Task", icon: CheckSquare, tone: "text-crm-soft bg-crm-muted" },
};

const COLLAPSE_AT = 220;

function duration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export function ActivityTime({
  at,
  mode,
  now,
}: {
  at: TimelineActivity["at"];
  mode: TimeMode;
  now: number;
}) {
  const d = toDate(at);
  const abs = format(d, "d MMM yyyy, HH:mm");
  // `now` is a ticking clock so relative labels refresh without re-fetching.
  void now;
  return (
    <time
      dateTime={d.toISOString()}
      title={abs}
      className="shrink-0 tabular-nums text-xs text-crm-muted-fg"
    >
      {mode === "relative" ? `${formatDistanceToNowStrict(d)} ago` : format(d, "HH:mm")}
    </time>
  );
}

export interface ActivityItemProps {
  item: TimelineActivity;
  posinset: number;
  setsize: number;
  timeMode: TimeMode;
  now: number;
  expanded: boolean;
  pinned: boolean;
  onToggleExpanded: (id: string) => void;
  onTogglePin?: (id: string) => void;
  compact?: boolean;
}

export const ActivityItem = memo(function ActivityItem({
  item,
  posinset,
  setsize,
  timeMode,
  now,
  expanded,
  pinned,
  onToggleExpanded,
  onTogglePin,
  compact,
}: ActivityItemProps) {
  const id = useId();
  const meta = TYPE_META[item.type];
  const Icon = item.type === "email" && item.email?.direction === "inbound" ? MailOpen : meta.icon;
  const long = (item.body?.length ?? 0) > COLLAPSE_AT || item.type === "email";
  const bodyId = `${id}-body`;

  return (
    <article
      aria-labelledby={`${id}-title`}
      aria-describedby={item.body ? bodyId : undefined}
      aria-posinset={posinset}
      aria-setsize={setsize}
      tabIndex={-1}
      data-activity-id={item.id}
      className={cn(
        "group relative flex gap-3 rounded-crm px-3 py-2.5 outline-none",
        "focus-visible:ring-2 focus-visible:ring-crm-ring hover:bg-crm-raised/60",
        pinned && !compact && "bg-crm-warning/[0.04]",
      )}
    >
      <div className="relative flex flex-col items-center">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", meta.tone)}>
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p id={`${id}-title`} className="min-w-0 flex-1 text-sm text-crm-fg">
            <span className="sr-only">{meta.label}: </span>
            <span className="font-medium">{item.actor.name}</span>{" "}
            <span className="text-crm-soft">{item.title}</span>
          </p>
          <ActivityTime at={item.at} mode={timeMode} now={now} />
          {onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(item.id)}
              aria-pressed={pinned}
              aria-label={pinned ? "Unpin" : "Pin to top"}
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-crm text-crm-muted-fg hover:bg-crm-muted hover:text-crm-fg",
                "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring",
                pinned
                  ? "text-crm-warning"
                  : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
              )}
            >
              {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </button>
          )}
        </div>

        <Details item={item} />

        {item.body && (
          <div className="mt-1.5">
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={expanded ? "open" : "closed"}
                id={bodyId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className={cn(
                  "whitespace-pre-line text-sm leading-relaxed text-crm-soft",
                  !expanded && long && "line-clamp-2",
                  item.type === "note" &&
                    "rounded-crm border border-crm-border bg-crm-card px-3 py-2",
                )}
              >
                {item.body}
              </motion.div>
            </AnimatePresence>
            {long && !compact && (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={bodyId}
                onClick={() => onToggleExpanded(item.id)}
                className="mt-1 inline-flex items-center gap-1 rounded-crm text-xs font-medium text-crm-muted-fg hover:text-crm-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crm-ring"
              >
                <ChevronDown
                  className={cn("size-3 transition-transform", expanded && "rotate-180")}
                  aria-hidden
                />
                {expanded ? "Show less" : item.type === "email" ? "Show full email" : "Show more"}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
});

function Details({ item }: { item: TimelineActivity }) {
  if (item.email)
    return (
      <p className="mt-0.5 truncate text-xs text-crm-muted-fg">
        {item.email.direction === "inbound" ? "From" : "To"}{" "}
        {item.email.direction === "inbound" ? item.email.from : item.email.to.join(", ")}
        {item.email.cc?.length ? ` · cc ${item.email.cc.length}` : ""}
      </p>
    );
  if (item.call)
    return (
      <p className="mt-0.5 text-xs text-crm-muted-fg">
        {item.call.outcome === "connected"
          ? `Connected · ${duration(item.call.durationSec)}`
          : item.call.outcome === "voicemail"
            ? "Left voicemail"
            : "No answer"}
      </p>
    );
  if (item.stage)
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs">
        <span className="rounded-full border border-crm-border px-2 py-0.5 text-crm-muted-fg">
          {item.stage.from}
        </span>
        <ArrowRight className="size-3 text-crm-muted-fg" aria-label="to" />
        <span className="rounded-full bg-crm-status/15 px-2 py-0.5 text-crm-status">
          {item.stage.to}
        </span>
      </p>
    );
  if (item.task)
    return (
      <p
        className={cn("mt-0.5 text-xs", item.task.done ? "text-crm-success" : "text-crm-muted-fg")}
      >
        {item.task.done ? "Completed" : "Open"}
        {item.task.due ? ` · due ${format(toDate(item.task.due), "d MMM")}` : ""}
      </p>
    );
  if (item.meeting)
    return (
      <p className="mt-0.5 text-xs text-crm-muted-fg">
        {item.meeting.attendees} attendees
        {item.meeting.location ? ` · ${item.meeting.location}` : ""}
      </p>
    );
  return null;
}
